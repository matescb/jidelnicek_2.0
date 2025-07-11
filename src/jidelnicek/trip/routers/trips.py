"""
Trip management API endpoints.

This module provides comprehensive endpoints for trip management:
- Create trip with participants
- List trips with pagination and filtering
- Get trip details
- Update trip (owner only)
- Delete trip (owner only)
- Duplicate trip
- Share trip with token
- View shared trips
"""

from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime
import logging

from fastapi import APIRouter, Depends, HTTPException, status, Query, Path, Body, Response
from sqlalchemy.ext.asyncio import AsyncSession

from jidelnicek.core.dependencies import get_db
from jidelnicek.auth.dependencies.auth import get_current_user, get_current_user_optional
from jidelnicek.auth.models import AuthUser
from jidelnicek.trip.services.trip_service import TripService
from jidelnicek.trip.services.participant_service import ParticipantService
from jidelnicek.trip.services.meal_slot_service import MealSlotService
from jidelnicek.trip.services.meal_assignment_service import MealAssignmentService
from jidelnicek.trip.services.template_service import TripTemplateService
from jidelnicek.trip.schemas.trip import (
    TripCreate, TripUpdate, TripResponse, TripListResponse,
    TripSearchFilters, TripDuplicateRequest, TripCloneRequest, TripStatsResponse,
    TripListItem, TripParticipantResponse, TripDaySummary,
    MealParticipantSummaryResponse, DailyParticipantSummaryResponse,
    TripCoefficientSummaryResponse
)
from jidelnicek.trip.schemas.template import (
    TripTemplateCreate, TripTemplateUpdate, TripTemplate as TripTemplateResponse,
    TripTemplatePreview, TripTemplateList, CreateTripFromTemplate,
    TripTemplateSearchFilters
)
from jidelnicek.trip.schemas.participant import (
    ParticipantCreate, ParticipantUpdate, Participant, DayParticipants
)
from jidelnicek.trip.schemas.meal_slot import (
    MealSlotCreate, MealSlotUpdate, MealSlot, DayMealSlots,
    TripMealPattern, MealSlotBulkCreate
)
from jidelnicek.trip.schemas.meal import (
    MealAssignmentCreate, MealAssignmentUpdate, MealAssignment,
    MealAssignmentBulkCreate, MealAssignmentBulkUpdate, MealAssignmentSwap,
    PortionCalculation, DayMealAssignments, TripMealPlan, MealPlanningStatus
)
from jidelnicek.trip.schemas.day_plan import (
    ParticipantAttendance, MealIngredientSummary, MealNutritionalSummary,
    MealSlotPlan, DayShoppingItem, DayShoppingList, DayPlanSummary,
    TripDayByDayPlan, MealSlotAssignmentRequest, DayPlanUpdateRequest
)
from jidelnicek.core.exceptions import NotFoundError, PermissionError, ValidationError, ConflictError, BusinessLogicError

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/trips",
    tags=["trips"],
    responses={404: {"description": "Trip not found"}},
)


@router.post(
    "/",
    response_model=TripResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new trip",
    description="Create a new trip with optional participants"
)
async def create_trip(
    trip_data: TripCreate,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new trip.
    
    - **name**: Trip name (required)
    - **start_date**: Trip start date (required)
    - **end_date**: Trip end date (required)
    - **meal_slots**: Meal slot names (default: Breakfast, Lunch, Dinner)
    - **participants**: List of participants with names/numbers and coefficients
    """
    service = TripService(db)
    
    try:
        trip = await service.create_trip(current_user.id, trip_data)
        
        # Convert to response model
        return TripResponse(
            id=trip.id,
            user_id=trip.user_id,
            name=trip.name,
            start_date=trip.start_date,
            end_date=trip.end_date,
            meal_slots=trip.meal_slots,
            recipe_storage_mode="snapshot",  # Default for now
            notes=None,
            is_archived=trip.is_archived,
            created_at=trip.created_at,
            updated_at=trip.updated_at,
            duration_days=trip.duration_days,
            participants=[],  # TODO: Add when participants are available
            days=[],  # TODO: Add when days are available
            has_stove=False,
            stove_efficiency=None,
            total_meals_planned=0,
            completion_percentage=0.0,
            total_calories=None,
            total_weight_g=None,
            total_water_ml=None,
            total_fuel_g=None
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error creating trip: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while creating the trip"
        )


@router.get(
    "/",
    response_model=TripListResponse,
    summary="List user's trips",
    description="Get paginated list of user's trips with optional filtering"
)
async def list_trips(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    query: Optional[str] = Query(None, description="Search query for trip name"),
    start_date_from: Optional[str] = Query(None, description="Filter trips starting from this date"),
    start_date_to: Optional[str] = Query(None, description="Filter trips starting until this date"),
    end_date_from: Optional[str] = Query(None, description="Filter trips ending from this date"),
    end_date_to: Optional[str] = Query(None, description="Filter trips ending until this date"),
    min_duration_days: Optional[int] = Query(None, ge=1, description="Minimum trip duration"),
    max_duration_days: Optional[int] = Query(None, ge=1, description="Maximum trip duration"),
    is_archived: Optional[bool] = Query(None, description="Filter by archived status"),
    current_user: Optional[AuthUser] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    """
    List user's trips with optional filtering and pagination.
    
    Returns paginated list of trips with summary information.
    """
    service = TripService(db)
    
    # Build filters
    filters = TripSearchFilters(
        query=query,
        start_date_from=start_date_from,
        start_date_to=start_date_to,
        end_date_from=end_date_from,
        end_date_to=end_date_to,
        min_duration_days=min_duration_days,
        max_duration_days=max_duration_days,
        is_archived=is_archived
    )
    
    try:
        # If no user is authenticated, return empty results
        if current_user is None:
            return TripListResponse(
                items=[],
                total=0,
                page=page,
                page_size=page_size,
                total_pages=0,
                has_next=False,
                has_prev=False
            )
        
        return await service.list_trips(
            user_id=current_user.id,
            filters=filters,
            page=page,
            page_size=page_size
        )
    except Exception as e:
        logger.error(f"Error listing trips: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while listing trips"
        )


@router.get(
    "/stats",
    response_model=TripStatsResponse,
    summary="Get user's trip statistics",
    description="Get aggregated statistics about user's trips"
)
async def get_trip_stats(
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get user's trip statistics including counts, averages, and patterns."""
    service = TripService(db)
    
    try:
        stats = await service.get_user_stats(current_user.id)
        return TripStatsResponse(**stats)
    except Exception as e:
        logger.error(f"Error getting trip stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while getting trip statistics"
        )


@router.get(
    "/shared/{share_token}",
    response_model=TripResponse,
    summary="View shared trip",
    description="Get trip details using a share token (no authentication required)"
)
async def get_shared_trip(
    share_token: str,
    db: AsyncSession = Depends(get_db)
):
    """
    View a shared trip using its share token.
    
    No authentication required, but the share link must be valid and not expired.
    """
    service = TripService(db)
    
    try:
        trip = await service.get_shared_trip(share_token)
        
        # Convert to response model
        return TripResponse(
            id=trip.id,
            user_id=trip.user_id,
            name=trip.name,
            start_date=trip.start_date,
            end_date=trip.end_date,
            meal_slots=trip.meal_slots,
            recipe_storage_mode="snapshot",
            notes=None,
            is_archived=trip.is_archived,
            created_at=trip.created_at,
            updated_at=trip.updated_at,
            duration_days=trip.duration_days,
            participants=[],  # TODO: Add when participants are available
            days=[],  # TODO: Add when days are available
            has_stove=False,
            stove_efficiency=None,
            total_meals_planned=0,
            completion_percentage=0.0,
            total_calories=None,
            total_weight_g=None,
            total_water_ml=None,
            total_fuel_g=None
        )
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Share link not found or expired"
        )
    except Exception as e:
        logger.error(f"Error getting shared trip: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while retrieving the shared trip"
        )


@router.get(
    "/{trip_id}",
    response_model=TripResponse,
    summary="Get trip details",
    description="Get detailed information about a specific trip"
)
async def get_trip(
    trip_id: UUID,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get detailed trip information.
    
    Returns full trip details including participants, days, and meals.
    """
    service = TripService(db)
    
    try:
        trip = await service.get_trip(trip_id, current_user.id)
        
        # Convert to response model
        return TripResponse(
            id=trip.id,
            user_id=trip.user_id,
            name=trip.name,
            start_date=trip.start_date,
            end_date=trip.end_date,
            meal_slots=trip.meal_slots,
            recipe_storage_mode="snapshot",
            notes=None,
            is_archived=trip.is_archived,
            created_at=trip.created_at,
            updated_at=trip.updated_at,
            duration_days=trip.duration_days,
            participants=[],  # TODO: Add when participants are available
            days=[],  # TODO: Add when days are available
            has_stove=False,
            stove_efficiency=None,
            total_meals_planned=0,
            completion_percentage=0.0,
            total_calories=None,
            total_weight_g=None,
            total_water_ml=None,
            total_fuel_g=None
        )
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip {trip_id} not found"
        )
    except PermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to view this trip"
        )
    except Exception as e:
        logger.error(f"Error getting trip {trip_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while retrieving the trip"
        )


@router.put(
    "/{trip_id}",
    response_model=TripResponse,
    summary="Update trip",
    description="Update trip information (owner only)"
)
async def update_trip(
    trip_id: UUID,
    update_data: TripUpdate,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update trip information.
    
    Only the trip owner can update the trip.
    All fields are optional - only provided fields will be updated.
    """
    service = TripService(db)
    
    try:
        trip = await service.update_trip(trip_id, current_user.id, update_data)
        
        # Convert to response model
        return TripResponse(
            id=trip.id,
            user_id=trip.user_id,
            name=trip.name,
            start_date=trip.start_date,
            end_date=trip.end_date,
            meal_slots=trip.meal_slots,
            recipe_storage_mode="snapshot",
            notes=None,
            is_archived=trip.is_archived,
            created_at=trip.created_at,
            updated_at=trip.updated_at,
            duration_days=trip.duration_days,
            participants=[],  # TODO: Add when participants are available
            days=[],  # TODO: Add when days are available
            has_stove=False,
            stove_efficiency=None,
            total_meals_planned=0,
            completion_percentage=0.0,
            total_calories=None,
            total_weight_g=None,
            total_water_ml=None,
            total_fuel_g=None
        )
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip {trip_id} not found"
        )
    except PermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update your own trips"
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error updating trip {trip_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while updating the trip"
        )


@router.delete(
    "/{trip_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete trip",
    description="Delete (archive) a trip (owner only)"
)
async def delete_trip(
    trip_id: UUID,
    permanent: bool = Query(False, description="Permanently delete instead of archiving"),
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a trip.
    
    By default, trips are soft-deleted (archived).
    Use permanent=true to permanently delete the trip.
    """
    service = TripService(db)
    
    try:
        await service.delete_trip(
            trip_id=trip_id,
            user_id=current_user.id,
            soft_delete=not permanent
        )
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip {trip_id} not found"
        )
    except PermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own trips"
        )
    except Exception as e:
        logger.error(f"Error deleting trip {trip_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while deleting the trip"
        )


@router.post(
    "/{trip_id}/duplicate",
    response_model=TripResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Duplicate trip",
    description="Create a copy of an existing trip"
)
async def duplicate_trip(
    trip_id: UUID,
    duplicate_data: TripDuplicateRequest,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Duplicate an existing trip.
    
    Creates a new trip with the same structure but optionally:
    - New name
    - New start date (end date adjusted accordingly)
    - With or without participants
    - With or without meal assignments
    """
    service = TripService(db)
    
    try:
        trip = await service.duplicate_trip(trip_id, current_user.id, duplicate_data)
        
        # Convert to response model
        return TripResponse(
            id=trip.id,
            user_id=trip.user_id,
            name=trip.name,
            start_date=trip.start_date,
            end_date=trip.end_date,
            meal_slots=trip.meal_slots,
            recipe_storage_mode="snapshot",
            notes=None,
            is_archived=trip.is_archived,
            created_at=trip.created_at,
            updated_at=trip.updated_at,
            duration_days=trip.duration_days,
            participants=[],  # TODO: Add when participants are available
            days=[],  # TODO: Add when days are available
            has_stove=False,
            stove_efficiency=None,
            total_meals_planned=0,
            completion_percentage=0.0,
            total_calories=None,
            total_weight_g=None,
            total_water_ml=None,
            total_fuel_g=None
        )
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip {trip_id} not found"
        )
    except PermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only duplicate your own trips"
        )
    except Exception as e:
        logger.error(f"Error duplicating trip {trip_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while duplicating the trip"
        )


@router.post(
    "/{trip_id}/clone",
    response_model=TripResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Clone trip",
    description="Create a clone of an existing trip with advanced configuration options"
)
async def clone_trip(
    trip_id: UUID = Path(..., description="ID of the trip to clone"),
    clone_data: TripCloneRequest = Body(..., description="Clone configuration"),
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Clone an existing trip with configurable options.
    
    This endpoint provides more advanced cloning options than the duplicate endpoint:
    - **new_name**: Name for the cloned trip (required)
    - **start_date**: Start date for the cloned trip (required)
    - **clone_participants**: Whether to clone participants (default: true)
    - **clone_meal_slots**: Whether to clone meal slot configuration (default: true)
    - **clone_meal_assignments**: Whether to clone meal assignments (default: true)
    - **participant_overrides**: Override participants (replaces cloned participants if provided)
    
    The cloned trip will:
    - Have the same duration as the original
    - Be owned by the current user
    - Optionally copy participants, meal slots, and meal assignments
    - Allow overriding participants with new ones
    """
    service = TripService(db)
    
    try:
        trip = await service.clone_trip(trip_id, current_user.id, clone_data)
        
        # Convert to response model
        return TripResponse(
            id=trip.id,
            user_id=trip.user_id,
            name=trip.name,
            start_date=trip.start_date,
            end_date=trip.end_date,
            meal_slots=trip.meal_slots,
            recipe_storage_mode="snapshot",
            notes=trip.notes,
            is_archived=trip.is_archived,
            created_at=trip.created_at,
            updated_at=trip.updated_at,
            duration_days=trip.duration_days,
            participants=[],  # TODO: Add when participants are available
            days=[],  # TODO: Add when days are available
            has_stove=trip.has_stove,
            stove_efficiency=trip.stove_efficiency,
            total_meals_planned=0,
            completion_percentage=0.0,
            total_calories=None,
            total_weight_g=None,
            total_water_ml=None,
            total_fuel_g=None
        )
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip {trip_id} not found"
        )
    except PermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to clone this trip"
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error cloning trip {trip_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while cloning the trip"
        )


@router.post(
    "/{trip_id}/share",
    response_model=dict,
    summary="Generate share link",
    description="Generate a temporary share link for a trip"
)
async def share_trip(
    trip_id: UUID,
    expires_hours: int = Query(24, ge=1, le=168, description="Hours until link expires (max 7 days)"),
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Generate a share link for a trip.
    
    The link will expire after the specified number of hours (default 24, max 168).
    Anyone with the link can view the trip without authentication.
    """
    service = TripService(db)
    
    try:
        share_info = await service.share_trip(trip_id, current_user.id, expires_hours)
        
        return {
            "share_token": share_info["share_token"],
            "expires_at": share_info["expires_at"].isoformat(),
            "expires_hours": share_info["expires_hours"],
            "share_url": f"/trips/shared/{share_info['share_token']}"
        }
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip {trip_id} not found"
        )
    except PermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only share your own trips"
        )
    except Exception as e:
        logger.error(f"Error sharing trip {trip_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while generating the share link"
        )


@router.get(
    "/{trip_id}/coefficients",
    response_model=TripCoefficientSummaryResponse,
    summary="Get trip coefficient summary",
    description="Calculate overall coefficient summary for trip participants"
)
async def get_trip_coefficients(
    trip_id: UUID,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get comprehensive coefficient summary for a trip.
    
    This includes:
    - Daily participant summaries
    - Meal-specific effective counts
    - Total effective participant-days
    - Meal slot totals for shopping lists
    """
    service = TripService(db)
    
    try:
        summary = await service.calculate_trip_coefficients(
            trip_id=trip_id,
            user_id=current_user.id
        )
        
        # Convert to response model
        return TripCoefficientSummaryResponse(
            trip_id=summary.trip_id,
            total_participants=summary.total_participants,
            daily_summaries=[
                DailyParticipantSummaryResponse(
                    day_id=daily.day_id,
                    day_number=daily.day_number,
                    date=daily.date,
                    total_participants=daily.total_participants,
                    meal_summaries={
                        meal_slot: MealParticipantSummaryResponse(
                            day_id=meal.day_id,
                            day_number=meal.day_number,
                            date=meal.date,
                            meal_slot=meal.meal_slot,
                            participant_count=meal.participant_count,
                            effective_count=meal.effective_count,
                            participants=meal.participants
                        )
                        for meal_slot, meal in daily.meal_summaries.items()
                    },
                    average_effective_count=daily.average_effective_count
                )
                for daily in summary.daily_summaries
            ],
            meal_slot_totals=summary.meal_slot_totals,
            total_effective_days=summary.total_effective_days
        )
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip {trip_id} not found"
        )
    except PermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to view this trip"
        )
    except Exception as e:
        logger.error(f"Error calculating trip coefficients {trip_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while calculating coefficients"
        )


@router.get(
    "/{trip_id}/days/{day_id}/coefficients",
    response_model=DailyParticipantSummaryResponse,
    summary="Get daily participant summary",
    description="Calculate participant summary for a specific day"
)
async def get_daily_coefficients(
    trip_id: UUID,
    day_id: UUID,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get participant summary for a specific day.
    
    This includes:
    - Total participants for the day
    - Meal-specific participant counts and coefficients
    - Average effective count across all meals
    """
    service = TripService(db)
    
    try:
        summary = await service.calculate_daily_participants(
            trip_id=trip_id,
            day_id=day_id,
            user_id=current_user.id
        )
        
        # Convert to response model
        return DailyParticipantSummaryResponse(
            day_id=summary.day_id,
            day_number=summary.day_number,
            date=summary.date,
            total_participants=summary.total_participants,
            meal_summaries={
                meal_slot: MealParticipantSummaryResponse(
                    day_id=meal.day_id,
                    day_number=meal.day_number,
                    date=meal.date,
                    meal_slot=meal.meal_slot,
                    participant_count=meal.participant_count,
                    effective_count=meal.effective_count,
                    participants=meal.participants
                )
                for meal_slot, meal in summary.meal_summaries.items()
            },
            average_effective_count=summary.average_effective_count
        )
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip {trip_id} or day {day_id} not found"
        )
    except PermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to view this trip"
        )
    except Exception as e:
        logger.error(f"Error calculating daily coefficients for trip {trip_id}, day {day_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while calculating daily coefficients"
        )


@router.get(
    "/{trip_id}/days/{day_id}/meals/{meal_slot}/coefficients",
    response_model=MealParticipantSummaryResponse,
    summary="Get meal participant summary",
    description="Calculate effective participant count for a specific meal"
)
async def get_meal_coefficients(
    trip_id: UUID,
    day_id: UUID,
    meal_slot: str,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get participant summary for a specific meal.
    
    This includes:
    - Participant count for the meal
    - Effective count based on coefficients
    - List of participants with their coefficients
    """
    service = TripService(db)
    
    try:
        summary = await service.calculate_meal_participants(
            trip_id=trip_id,
            day_id=day_id,
            meal_slot=meal_slot,
            user_id=current_user.id
        )
        
        # Convert to response model
        return MealParticipantSummaryResponse(
            day_id=summary.day_id,
            day_number=summary.day_number,
            date=summary.date,
            meal_slot=summary.meal_slot,
            participant_count=summary.participant_count,
            effective_count=summary.effective_count,
            participants=summary.participants
        )
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip {trip_id}, day {day_id}, or meal slot {meal_slot} not found"
        )
    except PermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to view this trip"
        )
    except Exception as e:
        logger.error(f"Error calculating meal coefficients for trip {trip_id}, day {day_id}, meal {meal_slot}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while calculating meal coefficients"
        )


# Participant management endpoints

@router.post(
    "/{trip_id}/participants",
    response_model=Participant,
    status_code=status.HTTP_201_CREATED,
    summary="Add participant to trip",
    description="Add a new participant to the trip (max 20 participants)"
)
async def add_participant(
    trip_id: UUID,
    participant_data: ParticipantCreate,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Add a participant to a trip.
    
    - Either **name** or **number** must be provided (not both)
    - **coefficient**: Default meal coefficient (100 = 1.0)
    - **meal_coefficients**: Optional meal-specific coefficients
    - **arrival_date**: Optional date when participant arrives
    - **departure_date**: Optional date when participant departs
    - **email**: Optional contact email
    
    Maximum 20 participants per trip.
    """
    # Verify user owns the trip
    trip_service = TripService(db)
    try:
        await trip_service.get_trip(trip_id, current_user.id)
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip {trip_id} not found"
        )
    except PermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only add participants to your own trips"
        )
    
    participant_service = ParticipantService(db)
    
    try:
        participant = await participant_service.add_participant(trip_id, participant_data)
        return participant
    except ConflictError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error adding participant to trip {trip_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while adding the participant"
        )


@router.get(
    "/{trip_id}/participants",
    response_model=list[Participant],
    summary="List trip participants",
    description="Get all participants for a trip"
)
async def list_participants(
    trip_id: UUID,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all participants for a trip."""
    # Verify user owns the trip
    trip_service = TripService(db)
    try:
        await trip_service.get_trip(trip_id, current_user.id)
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip {trip_id} not found"
        )
    except PermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view participants of your own trips"
        )
    
    participant_service = ParticipantService(db)
    
    try:
        participants = await participant_service.list_participants(trip_id)
        return participants
    except Exception as e:
        logger.error(f"Error listing participants for trip {trip_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while listing participants"
        )


@router.get(
    "/{trip_id}/participants/day/{day_number}",
    response_model=DayParticipants,
    summary="Get participants for specific day",
    description="Get participants present on a specific day of the trip"
)
async def get_day_participants(
    trip_id: UUID,
    day_number: int = Path(..., ge=1, description="Day number (1-based)"),
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get participants present on a specific day.
    
    Returns list of participants who are present on the specified day,
    taking into account arrival and departure dates.
    """
    # Verify user owns the trip
    trip_service = TripService(db)
    try:
        await trip_service.get_trip(trip_id, current_user.id)
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip {trip_id} not found"
        )
    except PermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view participants of your own trips"
        )
    
    participant_service = ParticipantService(db)
    
    try:
        day_participants = await participant_service.get_participants_for_day(trip_id, day_number)
        return day_participants
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error getting participants for day {day_number} of trip {trip_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while getting day participants"
        )


@router.put(
    "/{trip_id}/participants/{participant_id}",
    response_model=Participant,
    summary="Update participant",
    description="Update participant information"
)
async def update_participant(
    trip_id: UUID,
    participant_id: UUID,
    participant_data: ParticipantUpdate,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update participant information.
    
    All fields are optional - only provided fields will be updated.
    """
    # Verify user owns the trip
    trip_service = TripService(db)
    try:
        await trip_service.get_trip(trip_id, current_user.id)
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip {trip_id} not found"
        )
    except PermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update participants in your own trips"
        )
    
    participant_service = ParticipantService(db)
    
    try:
        participant = await participant_service.update_participant(
            trip_id, participant_id, participant_data
        )
        return participant
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error updating participant {participant_id} in trip {trip_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while updating the participant"
        )


@router.delete(
    "/{trip_id}/participants/{participant_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove participant",
    description="Remove participant from trip"
)
async def remove_participant(
    trip_id: UUID,
    participant_id: UUID,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Remove a participant from the trip."""
    # Verify user owns the trip
    trip_service = TripService(db)
    try:
        await trip_service.get_trip(trip_id, current_user.id)
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip {trip_id} not found"
        )
    except PermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only remove participants from your own trips"
        )
    
    participant_service = ParticipantService(db)
    
    try:
        await participant_service.remove_participant(trip_id, participant_id)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error removing participant {participant_id} from trip {trip_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while removing the participant"
        )


# ============================================================================
# Meal Slot Management Endpoints
# ============================================================================

@router.post(
    "/{trip_id}/meal-slots/default",
    response_model=list[MealSlot],
    status_code=status.HTTP_201_CREATED,
    summary="Create default meal slots",
    description="Create default meal slots for all days in the trip"
)
async def create_default_meal_slots(
    trip_id: UUID,
    meal_types: Optional[List[str]] = Body(
        default=None,
        description="List of meal types (defaults to Breakfast, Lunch, Dinner)"
    ),
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create default meal slots for all days in the trip.
    
    If meal_types is not provided, defaults to ["Breakfast", "Lunch", "Dinner"].
    """
    # Verify user owns the trip
    trip_service = TripService(db)
    try:
        await trip_service.get_trip(trip_id, current_user.id)
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip {trip_id} not found"
        )
    except PermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only manage meal slots in your own trips"
        )
    
    meal_slot_service = MealSlotService(db)
    
    try:
        meal_slots = await meal_slot_service.create_default_meal_slots(
            trip_id, meal_types
        )
        return meal_slots
    except Exception as e:
        logger.error(f"Error creating default meal slots for trip {trip_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while creating meal slots"
        )


@router.post(
    "/{trip_id}/meal-slots",
    response_model=MealSlot,
    status_code=status.HTTP_201_CREATED,
    summary="Create meal slot",
    description="Create a single meal slot for a specific day"
)
async def create_meal_slot(
    trip_id: UUID,
    meal_slot_data: MealSlotCreate,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a meal slot for a specific day in the trip."""
    # Verify user owns the trip
    trip_service = TripService(db)
    try:
        await trip_service.get_trip(trip_id, current_user.id)
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip {trip_id} not found"
        )
    except PermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only manage meal slots in your own trips"
        )
    
    meal_slot_service = MealSlotService(db)
    
    try:
        meal_slot = await meal_slot_service.create_meal_slot(trip_id, meal_slot_data)
        return meal_slot
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except ConflictError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error creating meal slot for trip {trip_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while creating the meal slot"
        )


@router.post(
    "/{trip_id}/meal-slots/bulk",
    response_model=list[MealSlot],
    status_code=status.HTTP_201_CREATED,
    summary="Create meal slots in bulk",
    description="Create multiple meal slots at once"
)
async def create_meal_slots_bulk(
    trip_id: UUID,
    bulk_data: MealSlotBulkCreate,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create multiple meal slots at once."""
    # Verify user owns the trip
    trip_service = TripService(db)
    try:
        await trip_service.get_trip(trip_id, current_user.id)
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip {trip_id} not found"
        )
    except PermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only manage meal slots in your own trips"
        )
    
    meal_slot_service = MealSlotService(db)
    
    try:
        meal_slots = await meal_slot_service.create_meal_slots_bulk(trip_id, bulk_data)
        return meal_slots
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except ConflictError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error creating meal slots in bulk for trip {trip_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while creating meal slots"
        )


@router.get(
    "/{trip_id}/meal-slots",
    response_model=list[MealSlot],
    summary="List meal slots",
    description="Get all meal slots for a trip with optional filters"
)
async def list_meal_slots(
    trip_id: UUID,
    day_number: Optional[int] = Query(None, ge=1, description="Filter by day number"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all meal slots for a trip with optional filters."""
    # Verify user owns the trip
    trip_service = TripService(db)
    try:
        await trip_service.get_trip(trip_id, current_user.id)
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip {trip_id} not found"
        )
    except PermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view meal slots in your own trips"
        )
    
    meal_slot_service = MealSlotService(db)
    
    try:
        meal_slots = await meal_slot_service.list_trip_meal_slots(
            trip_id, day_number, is_active
        )
        return meal_slots
    except Exception as e:
        logger.error(f"Error listing meal slots for trip {trip_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while listing meal slots"
        )


@router.get(
    "/{trip_id}/meal-slots/by-day",
    response_model=list[DayMealSlots],
    summary="Get meal slots by day",
    description="Get meal slots grouped by day"
)
async def get_meal_slots_by_day(
    trip_id: UUID,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get meal slots grouped by day for easier meal planning."""
    # Verify user owns the trip
    trip_service = TripService(db)
    try:
        await trip_service.get_trip(trip_id, current_user.id)
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip {trip_id} not found"
        )
    except PermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view meal slots in your own trips"
        )
    
    meal_slot_service = MealSlotService(db)
    
    try:
        day_meal_slots = await meal_slot_service.get_meal_slots_by_day(trip_id)
        return day_meal_slots
    except Exception as e:
        logger.error(f"Error getting meal slots by day for trip {trip_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while retrieving meal slots"
        )


@router.get(
    "/{trip_id}/meal-slots/pattern",
    response_model=TripMealPattern,
    summary="Get trip meal pattern",
    description="Get analysis of meal patterns across the trip"
)
async def get_trip_meal_pattern(
    trip_id: UUID,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get meal pattern analysis for the trip."""
    # Verify user owns the trip
    trip_service = TripService(db)
    try:
        await trip_service.get_trip(trip_id, current_user.id)
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip {trip_id} not found"
        )
    except PermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view meal patterns in your own trips"
        )
    
    meal_slot_service = MealSlotService(db)
    
    try:
        pattern = await meal_slot_service.get_trip_meal_pattern(trip_id)
        return pattern
    except Exception as e:
        logger.error(f"Error getting meal pattern for trip {trip_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while analyzing meal patterns"
        )


@router.put(
    "/{trip_id}/meal-slots/{meal_slot_id}",
    response_model=MealSlot,
    summary="Update meal slot",
    description="Update meal slot configuration"
)
async def update_meal_slot(
    trip_id: UUID,
    meal_slot_id: UUID,
    update_data: MealSlotUpdate,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update a meal slot configuration."""
    # Verify user owns the trip
    trip_service = TripService(db)
    try:
        await trip_service.get_trip(trip_id, current_user.id)
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip {trip_id} not found"
        )
    except PermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update meal slots in your own trips"
        )
    
    meal_slot_service = MealSlotService(db)
    
    try:
        meal_slot = await meal_slot_service.update_meal_slot(
            trip_id, meal_slot_id, update_data
        )
        return meal_slot
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error updating meal slot {meal_slot_id} in trip {trip_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while updating the meal slot"
        )


@router.post(
    "/{trip_id}/meal-slots/{meal_slot_id}/toggle",
    response_model=MealSlot,
    summary="Toggle meal slot",
    description="Toggle meal slot active status"
)
async def toggle_meal_slot(
    trip_id: UUID,
    meal_slot_id: UUID,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Toggle a meal slot's active status."""
    # Verify user owns the trip
    trip_service = TripService(db)
    try:
        await trip_service.get_trip(trip_id, current_user.id)
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip {trip_id} not found"
        )
    except PermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only toggle meal slots in your own trips"
        )
    
    meal_slot_service = MealSlotService(db)
    
    try:
        meal_slot = await meal_slot_service.toggle_meal_slot(trip_id, meal_slot_id)
        return meal_slot
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error toggling meal slot {meal_slot_id} in trip {trip_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while toggling the meal slot"
        )


@router.delete(
    "/{trip_id}/meal-slots/{meal_slot_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete meal slot",
    description="Delete a meal slot (only if no meals assigned)"
)
async def delete_meal_slot(
    trip_id: UUID,
    meal_slot_id: UUID,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a meal slot if it has no assigned meals."""
    # Verify user owns the trip
    trip_service = TripService(db)
    try:
        await trip_service.get_trip(trip_id, current_user.id)
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip {trip_id} not found"
        )
    except PermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete meal slots in your own trips"
        )
    
    meal_slot_service = MealSlotService(db)
    
    try:
        await meal_slot_service.delete_meal_slot(trip_id, meal_slot_id)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except ConflictError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error deleting meal slot {meal_slot_id} from trip {trip_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while deleting the meal slot"
        )


@router.post(
    "/{trip_id}/meal-slots/copy-from/{source_trip_id}",
    response_model=list[MealSlot],
    status_code=status.HTTP_201_CREATED,
    summary="Copy meal pattern",
    description="Copy meal pattern from another trip"
)
async def copy_meal_pattern(
    trip_id: UUID,
    source_trip_id: UUID,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Copy meal pattern from another trip.
    
    The source trip must also belong to the user.
    The target trip must not have any meal slots configured yet.
    """
    # Verify user owns both trips
    trip_service = TripService(db)
    
    # Check target trip
    try:
        await trip_service.get_trip(trip_id, current_user.id)
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Target trip {trip_id} not found"
        )
    except PermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only copy meal patterns to your own trips"
        )
    
    # Check source trip
    try:
        await trip_service.get_trip(source_trip_id, current_user.id)
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Source trip {source_trip_id} not found"
        )
    except PermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only copy meal patterns from your own trips"
        )
    
    meal_slot_service = MealSlotService(db)
    
    try:
        meal_slots = await meal_slot_service.copy_meal_pattern(
            source_trip_id, trip_id
        )
        return meal_slots
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except ConflictError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error copying meal pattern from {source_trip_id} to {trip_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while copying the meal pattern"
        )


# ============================================================================
# Meal Assignment Management Endpoints
# ============================================================================

@router.post(
    "/{trip_id}/meals",
    response_model=MealAssignment,
    status_code=status.HTTP_201_CREATED,
    summary="Assign recipe to meal slot",
    description="Assign a recipe to a specific meal slot in the trip"
)
async def assign_recipe_to_meal(
    trip_id: UUID,
    assignment_data: MealAssignmentCreate,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Assign a recipe to a meal slot.
    
    - **day_id**: ID of the trip day
    - **recipe_id**: ID of the recipe to assign
    - **meal_slot**: Meal slot name (e.g., Breakfast, Lunch, Dinner)
    - **servings_override**: Optional override for recipe servings
    - **notes**: Optional notes for this meal
    
    The meal slot must be active and not already have an assignment.
    """
    # Verify user owns the trip
    trip_service = TripService(db)
    try:
        await trip_service.get_trip(trip_id, current_user.id)
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip {trip_id} not found"
        )
    except PermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only assign meals in your own trips"
        )
    
    meal_service = MealAssignmentService(db)
    
    try:
        meal = await meal_service.assign_recipe(trip_id, assignment_data)
        return meal
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except ConflictError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e)
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error assigning recipe to meal in trip {trip_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while assigning the recipe"
        )


@router.get(
    "/{trip_id}/meals",
    response_model=list[MealAssignment],
    summary="List meal assignments",
    description="Get all meal assignments for a trip with optional filters"
)
async def list_meal_assignments(
    trip_id: UUID,
    day_id: Optional[UUID] = Query(None, description="Filter by day ID"),
    meal_slot: Optional[str] = Query(None, description="Filter by meal slot"),
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    List all meal assignments for a trip.
    
    Optionally filter by:
    - **day_id**: Specific day
    - **meal_slot**: Specific meal slot (e.g., Breakfast)
    
    Results are ordered by day number and meal slot.
    """
    # Verify user owns the trip
    trip_service = TripService(db)
    try:
        await trip_service.get_trip(trip_id, current_user.id)
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip {trip_id} not found"
        )
    except PermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view meals in your own trips"
        )
    
    meal_service = MealAssignmentService(db)
    
    try:
        meals = await meal_service.list_trip_meals(trip_id, day_id, meal_slot)
        return meals
    except Exception as e:
        logger.error(f"Error listing meals for trip {trip_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while listing meal assignments"
        )


@router.get(
    "/{trip_id}/meals/{meal_id}",
    response_model=MealAssignment,
    summary="Get meal assignment",
    description="Get details of a specific meal assignment"
)
async def get_meal_assignment(
    trip_id: UUID,
    meal_id: UUID,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get details of a specific meal assignment."""
    # Verify user owns the trip
    trip_service = TripService(db)
    try:
        await trip_service.get_trip(trip_id, current_user.id)
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip {trip_id} not found"
        )
    except PermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view meals in your own trips"
        )
    
    meal_service = MealAssignmentService(db)
    
    try:
        meal = await meal_service.get_meal_assignment(trip_id, meal_id)
        return meal
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error getting meal {meal_id} from trip {trip_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while retrieving the meal assignment"
        )


@router.put(
    "/{trip_id}/meals/{meal_id}",
    response_model=MealAssignment,
    summary="Update meal assignment",
    description="Update a meal assignment (recipe, servings, or notes)"
)
async def update_meal_assignment(
    trip_id: UUID,
    meal_id: UUID,
    update_data: MealAssignmentUpdate,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update a meal assignment.
    
    All fields are optional:
    - **recipe_id**: Change to a different recipe
    - **servings_override**: Update servings override
    - **notes**: Update meal notes
    """
    # Verify user owns the trip
    trip_service = TripService(db)
    try:
        await trip_service.get_trip(trip_id, current_user.id)
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip {trip_id} not found"
        )
    except PermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update meals in your own trips"
        )
    
    meal_service = MealAssignmentService(db)
    
    try:
        meal = await meal_service.update_assignment(trip_id, meal_id, update_data)
        return meal
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error updating meal {meal_id} in trip {trip_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while updating the meal assignment"
        )


@router.delete(
    "/{trip_id}/meals/{meal_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove meal assignment",
    description="Remove a meal assignment from the trip"
)
async def remove_meal_assignment(
    trip_id: UUID,
    meal_id: UUID,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Remove a meal assignment from the trip."""
    # Verify user owns the trip
    trip_service = TripService(db)
    try:
        await trip_service.get_trip(trip_id, current_user.id)
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip {trip_id} not found"
        )
    except PermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only remove meals from your own trips"
        )
    
    meal_service = MealAssignmentService(db)
    
    try:
        await meal_service.remove_assignment(trip_id, meal_id)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error removing meal {meal_id} from trip {trip_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while removing the meal assignment"
        )


@router.post(
    "/{trip_id}/meals/bulk",
    response_model=list[MealAssignment],
    status_code=status.HTTP_201_CREATED,
    summary="Bulk assign recipes",
    description="Assign multiple recipes to meal slots at once"
)
async def bulk_assign_recipes(
    trip_id: UUID,
    bulk_data: MealAssignmentBulkCreate,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create multiple meal assignments at once.
    
    Provide a list of assignments, each with:
    - **day_id**: ID of the trip day
    - **recipe_id**: ID of the recipe to assign
    - **meal_slot**: Meal slot name
    - **servings_override**: Optional servings override
    - **notes**: Optional notes
    
    All assignments are created in a single transaction.
    If any assignment fails, all are rolled back.
    """
    # Verify user owns the trip
    trip_service = TripService(db)
    try:
        await trip_service.get_trip(trip_id, current_user.id)
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip {trip_id} not found"
        )
    except PermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only assign meals in your own trips"
        )
    
    meal_service = MealAssignmentService(db)
    
    try:
        meals = await meal_service.bulk_assign_recipes(trip_id, bulk_data)
        return meals
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except ConflictError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e)
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error bulk assigning recipes in trip {trip_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while bulk assigning recipes"
        )


@router.put(
    "/{trip_id}/meals/bulk",
    response_model=list[MealAssignment],
    summary="Bulk update assignments",
    description="Update multiple meal assignments with the same changes"
)
async def bulk_update_assignments(
    trip_id: UUID,
    bulk_data: MealAssignmentBulkUpdate,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Apply the same updates to multiple meal assignments.
    
    - **meal_ids**: List of meal assignment IDs to update
    - **update_data**: Changes to apply to all meals
    
    All updates are applied in a single transaction.
    """
    # Verify user owns the trip
    trip_service = TripService(db)
    try:
        await trip_service.get_trip(trip_id, current_user.id)
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip {trip_id} not found"
        )
    except PermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update meals in your own trips"
        )
    
    meal_service = MealAssignmentService(db)
    
    try:
        meals = await meal_service.bulk_update_assignments(trip_id, bulk_data)
        return meals
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error bulk updating meals in trip {trip_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while bulk updating meal assignments"
        )


@router.post(
    "/{trip_id}/meals/swap",
    response_model=list[MealAssignment],
    summary="Swap meal assignments",
    description="Swap recipes between two meal assignments"
)
async def swap_meal_assignments(
    trip_id: UUID,
    swap_data: MealAssignmentSwap,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Swap recipes between two meal assignments.
    
    - **meal_id_1**: First meal assignment ID
    - **meal_id_2**: Second meal assignment ID
    
    This swaps the recipes, servings overrides, and notes between the two meals.
    """
    # Verify user owns the trip
    trip_service = TripService(db)
    try:
        await trip_service.get_trip(trip_id, current_user.id)
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip {trip_id} not found"
        )
    except PermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only swap meals in your own trips"
        )
    
    meal_service = MealAssignmentService(db)
    
    try:
        meal1, meal2 = await meal_service.swap_meals(trip_id, swap_data)
        return [meal1, meal2]
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except BusinessLogicError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error swapping meals in trip {trip_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while swapping meal assignments"
        )


@router.get(
    "/{trip_id}/meals/by-day",
    response_model=list[DayMealAssignments],
    summary="Get meals by day",
    description="Get meal assignments grouped by day"
)
async def get_meals_by_day(
    trip_id: UUID,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get meal assignments grouped by day.
    
    Returns a list of days with their assigned meals,
    ordered by day number.
    """
    # Verify user owns the trip
    trip_service = TripService(db)
    try:
        await trip_service.get_trip(trip_id, current_user.id)
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip {trip_id} not found"
        )
    except PermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view meals in your own trips"
        )
    
    meal_service = MealAssignmentService(db)
    
    try:
        day_meals = await meal_service.get_meals_by_day(trip_id)
        return day_meals
    except Exception as e:
        logger.error(f"Error getting meals by day for trip {trip_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while retrieving meals by day"
        )


@router.get(
    "/{trip_id}/meals/plan",
    response_model=TripMealPlan,
    summary="Get complete meal plan",
    description="Get the complete meal plan for the trip"
)
async def get_trip_meal_plan(
    trip_id: UUID,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get the complete meal plan for the trip.
    
    Includes:
    - All days with their meal assignments
    - Summary statistics (total meals, unique recipes)
    - Trip metadata
    """
    # Verify user owns the trip
    trip_service = TripService(db)
    try:
        await trip_service.get_trip(trip_id, current_user.id)
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip {trip_id} not found"
        )
    except PermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view meal plans for your own trips"
        )
    
    meal_service = MealAssignmentService(db)
    
    try:
        meal_plan = await meal_service.get_trip_meal_plan(trip_id)
        return meal_plan
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error getting meal plan for trip {trip_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while retrieving the meal plan"
        )


@router.post(
    "/{trip_id}/meals/{meal_id}/portions",
    response_model=PortionCalculation,
    summary="Calculate portions",
    description="Calculate portion details for a meal assignment"
)
async def calculate_meal_portions(
    trip_id: UUID,
    meal_id: UUID,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Calculate portion details for a meal assignment.
    
    Takes into account:
    - Number of participants present for the meal
    - Participant coefficients (children, etc.)
    - Servings override if set
    
    Returns scaling factor to apply to recipe ingredients.
    """
    # Verify user owns the trip
    trip_service = TripService(db)
    try:
        await trip_service.get_trip(trip_id, current_user.id)
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip {trip_id} not found"
        )
    except PermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only calculate portions for your own trips"
        )
    
    meal_service = MealAssignmentService(db)
    
    try:
        portions = await meal_service.calculate_portions(trip_id, meal_id)
        return portions
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error calculating portions for meal {meal_id} in trip {trip_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while calculating portions"
        )


@router.get(
    "/{trip_id}/meals/status",
    response_model=MealPlanningStatus,
    summary="Get meal planning status",
    description="Get meal planning completion status for the trip"
)
async def get_meal_planning_status(
    trip_id: UUID,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get meal planning status for the trip.
    
    Shows:
    - Total meal slots (active only)
    - Number of assigned meals
    - Completion percentage
    - Details of unassigned slots
    """
    # Verify user owns the trip
    trip_service = TripService(db)
    try:
        await trip_service.get_trip(trip_id, current_user.id)
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip {trip_id} not found"
        )
    except PermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view meal status for your own trips"
        )
    
    meal_service = MealAssignmentService(db)
    
    try:
        status = await meal_service.get_planning_status(trip_id)
        return status
    except Exception as e:
        logger.error(f"Error getting meal planning status for trip {trip_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while retrieving planning status"
        )


# ============================================================================
# Day Plan Management Endpoints
# ============================================================================

@router.get(
    "/{trip_id}/days/{day_id}/plan",
    response_model=DayPlanSummary,
    summary="Get complete day plan",
    description="Get comprehensive plan for a single day including meals, participants, and shopping"
)
async def get_day_plan(
    trip_id: UUID,
    day_id: UUID,
    include_shopping: bool = Query(True, description="Include shopping list aggregation"),
    include_nutrition: bool = Query(True, description="Include nutritional calculations"),
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get complete meal plan for a single day.
    
    Includes:
    - All meal slots with assigned recipes
    - Participant attendance for each meal
    - Scaled ingredient quantities
    - Aggregated shopping list (optional)
    - Nutritional information (optional)
    
    The plan accounts for:
    - Mid-trip arrivals/departures
    - Participant coefficients (children, etc.)
    - Recipe scaling based on effective participant count
    """
    # Verify user owns the trip
    trip_service = TripService(db)
    try:
        await trip_service.get_trip(trip_id, current_user.id)
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip {trip_id} not found"
        )
    except PermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view plans for your own trips"
        )
    
    from jidelnicek.trip.services.day_plan_service import DayPlanService
    day_plan_service = DayPlanService(db)
    
    try:
        day_plan = await day_plan_service.get_day_plan(
            trip_id=trip_id,
            day_id=day_id,
            include_shopping=include_shopping,
            include_nutrition=include_nutrition
        )
        return day_plan
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error getting day plan for trip {trip_id}, day {day_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while retrieving the day plan"
        )


@router.get(
    "/{trip_id}/day-plans",
    response_model=TripDayByDayPlan,
    summary="Get day-by-day plans",
    description="Get comprehensive day-by-day plans for the entire trip or a date range"
)
async def get_trip_day_plans(
    trip_id: UUID,
    start_day: Optional[int] = Query(None, ge=1, description="Start day number (1-based)"),
    end_day: Optional[int] = Query(None, ge=1, description="End day number (inclusive)"),
    include_shopping: bool = Query(True, description="Include shopping lists"),
    include_nutrition: bool = Query(True, description="Include nutritional info"),
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get complete day-by-day plan for entire trip or date range.
    
    Returns:
    - Detailed plan for each day
    - Trip-wide statistics and summaries
    - Overall completion percentage
    - Unique recipe count
    - Meal type distribution
    - Average daily nutrition (if available)
    
    Use start_day and end_day to limit the range of days returned.
    """
    # Verify user owns the trip
    trip_service = TripService(db)
    try:
        await trip_service.get_trip(trip_id, current_user.id)
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip {trip_id} not found"
        )
    except PermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view plans for your own trips"
        )
    
    from jidelnicek.trip.services.day_plan_service import DayPlanService
    day_plan_service = DayPlanService(db)
    
    try:
        trip_plan = await day_plan_service.get_trip_day_by_day_plan(
            trip_id=trip_id,
            include_shopping=include_shopping,
            include_nutrition=include_nutrition,
            start_day=start_day,
            end_day=end_day
        )
        return trip_plan
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error getting day-by-day plan for trip {trip_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while retrieving the trip plan"
        )


@router.get(
    "/{trip_id}/days/{day_id}/shopping",
    response_model=DayShoppingList,
    summary="Get day shopping list",
    description="Get aggregated shopping list for a specific day"
)
async def get_day_shopping_list(
    trip_id: UUID,
    day_id: UUID,
    group_by_category: bool = Query(True, description="Group items by category"),
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get aggregated shopping list for a specific day.
    
    Returns:
    - All ingredients needed for the day's meals
    - Quantities scaled based on participant count and coefficients
    - Items grouped by category (optional)
    - Meal sources for each ingredient
    
    The list aggregates ingredients across all meals for the day,
    combining quantities where the same ingredient is used multiple times.
    """
    # Verify user owns the trip
    trip_service = TripService(db)
    try:
        await trip_service.get_trip(trip_id, current_user.id)
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip {trip_id} not found"
        )
    except PermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view shopping lists for your own trips"
        )
    
    from jidelnicek.trip.services.day_plan_service import DayPlanService
    day_plan_service = DayPlanService(db)
    
    try:
        shopping_list = await day_plan_service.get_day_shopping_list(
            trip_id=trip_id,
            day_id=day_id,
            group_by_category=group_by_category
        )
        return shopping_list
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error getting shopping list for trip {trip_id}, day {day_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while generating the shopping list"
        )


@router.get(
    "/{trip_id}/days/{day_id}/meals/{meal_slot}/participants",
    response_model=List[ParticipantAttendance],
    summary="Get meal participants",
    description="Get participant attendance details for a specific meal"
)
async def get_meal_participants(
    trip_id: UUID,
    day_id: UUID,
    meal_slot: str = Path(..., description="Meal slot name (e.g., Breakfast, Lunch, Dinner)"),
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get participant attendance for a specific meal.
    
    Returns detailed information for each participant:
    - Whether they are present for this meal
    - Base coefficient (default portion size)
    - Meal-specific coefficient (if different)
    - Effective coefficient (0 if not present)
    
    This accounts for:
    - Mid-trip arrivals/departures
    - Meal-specific dietary adjustments
    - Child portions or other coefficient modifications
    """
    # Verify user owns the trip
    trip_service = TripService(db)
    try:
        await trip_service.get_trip(trip_id, current_user.id)
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip {trip_id} not found"
        )
    except PermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view participants for your own trips"
        )
    
    from jidelnicek.trip.services.day_plan_service import DayPlanService
    day_plan_service = DayPlanService(db)
    
    try:
        participants = await day_plan_service.get_participants_for_meal(
            trip_id=trip_id,
            day_id=day_id,
            meal_slot=meal_slot
        )
        return participants
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error getting meal participants for trip {trip_id}, day {day_id}, meal {meal_slot}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while retrieving meal participants"
        )


@router.put(
    "/{trip_id}/days/{day_id}/meals",
    response_model=DayPlanSummary,
    summary="Bulk update day meals",
    description="Update multiple meal assignments for a day in a single request"
)
async def update_day_meals(
    trip_id: UUID,
    day_id: UUID,
    update_data: DayPlanUpdateRequest,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Bulk update meal assignments for a day.
    
    Provide a mapping of meal types to assignment details:
    ```json
    {
      "meal_assignments": {
        "Breakfast": {
          "recipe_id": "...",
          "servings_override": 10
        },
        "Lunch": {
          "recipe_id": "..."
        }
      }
    }
    ```
    
    This allows updating multiple meals in a single transaction.
    If any assignment fails, all are rolled back.
    """
    # Verify user owns the trip
    trip_service = TripService(db)
    try:
        await trip_service.get_trip(trip_id, current_user.id)
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip {trip_id} not found"
        )
    except PermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update meals in your own trips"
        )
    
    from jidelnicek.trip.services.day_plan_service import DayPlanService
    day_plan_service = DayPlanService(db)
    
    try:
        updated_plan = await day_plan_service.update_day_meals(
            trip_id=trip_id,
            day_id=day_id,
            update_data=update_data
        )
        return updated_plan
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error updating meals for trip {trip_id}, day {day_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while updating meal assignments"
        )


@router.get(
    "/{trip_id}/days/{day_id}/nutrition",
    response_model=MealNutritionalSummary,
    summary="Get day nutrition summary",
    description="Get aggregated nutritional information for a day"
)
async def get_day_nutrition(
    trip_id: UUID,
    day_id: UUID,
    per_person: bool = Query(False, description="Calculate per person averages"),
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Calculate nutritional totals for a day.
    
    Returns aggregated nutritional information:
    - Total calories, protein, carbs, fat, etc.
    - Either total for all participants or per-person average
    
    Note: Only available if recipes have nutritional information.
    Returns 404 if no nutritional data is available.
    """
    # Verify user owns the trip
    trip_service = TripService(db)
    try:
        await trip_service.get_trip(trip_id, current_user.id)
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip {trip_id} not found"
        )
    except PermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view nutrition for your own trips"
        )
    
    from jidelnicek.trip.services.day_plan_service import DayPlanService
    day_plan_service = DayPlanService(db)
    
    try:
        nutrition = await day_plan_service.calculate_day_nutrition(
            trip_id=trip_id,
            day_id=day_id,
            per_person=per_person
        )
        
        if not nutrition:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No nutritional data available for this day"
            )
        
        return nutrition
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error calculating nutrition for trip {trip_id}, day {day_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while calculating nutritional information"
        )


@router.get(
    "/{trip_id}/days/{day_id}/plan/export",
    response_model=str,
    response_class=Response,
    summary="Export day plan",
    description="Export day plan in various formats (JSON, CSV, Markdown)"
)
async def export_day_plan(
    trip_id: UUID,
    day_id: UUID,
    format: str = Query("json", regex="^(json|csv|markdown)$", description="Export format"),
    include_details: bool = Query(True, description="Include detailed information"),
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Export day plan in various formats.
    
    Supported formats:
    - **json**: Full structured data
    - **csv**: Tabular format for spreadsheets
    - **markdown**: Human-readable documentation format
    
    Use include_details=false for a more compact export.
    """
    # Verify user owns the trip
    trip_service = TripService(db)
    try:
        await trip_service.get_trip(trip_id, current_user.id)
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip {trip_id} not found"
        )
    except PermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only export plans for your own trips"
        )
    
    from jidelnicek.trip.services.day_plan_service import DayPlanService
    day_plan_service = DayPlanService(db)
    
    try:
        export_data = await day_plan_service.export_day_plan(
            trip_id=trip_id,
            day_id=day_id,
            format=format,
            include_details=include_details
        )
        
        # Set appropriate content type
        content_types = {
            "json": "application/json",
            "csv": "text/csv",
            "markdown": "text/markdown"
        }
        
        return Response(
            content=export_data,
            media_type=content_types[format],
            headers={
                "Content-Disposition": f"attachment; filename=day_{day_id}_plan.{format}"
            }
        )
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error exporting day plan for trip {trip_id}, day {day_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while exporting the day plan"
        )


# Template endpoints

@router.post(
    "/templates",
    response_model=TripTemplateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a trip template",
    description="Create a new reusable trip template with participants and meal configurations"
)
async def create_template(
    template_data: TripTemplateCreate,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new trip template.
    
    - **name**: Template name (required)
    - **description**: Template description
    - **duration_days**: Number of days in the trip (required)
    - **meal_slots**: Meal slot names (default: Breakfast, Lunch, Dinner)
    - **participants**: List of participant configurations
    - **meal_assignments**: Optional pre-configured meal assignments
    - **is_public**: Whether template is available to all users
    - **category**: Template category for organization
    - **tags**: Tags for template search and filtering
    """
    service = TripTemplateService(db)
    
    try:
        template = await service.create_template(current_user.id, template_data)
        return template
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error creating template: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while creating the template"
        )


@router.get(
    "/templates",
    response_model=TripTemplateList,
    summary="List trip templates",
    description="List templates including user's own and public templates"
)
async def list_templates(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    query: Optional[str] = Query(None, description="Search query for name or description"),
    is_public: Optional[bool] = Query(None, description="Filter by public/private status"),
    category: Optional[str] = Query(None, description="Filter by category"),
    tags: Optional[List[str]] = Query(None, description="Filter by tags (OR condition)"),
    min_duration_days: Optional[int] = Query(None, ge=1, description="Minimum duration"),
    max_duration_days: Optional[int] = Query(None, ge=1, description="Maximum duration"),
    min_participants: Optional[int] = Query(None, ge=0, description="Minimum participants"),
    max_participants: Optional[int] = Query(None, ge=0, description="Maximum participants"),
    created_by_me: Optional[bool] = Query(None, description="Filter templates created by current user"),
    created_after: Optional[datetime] = Query(None, description="Filter by creation date (after)"),
    created_before: Optional[datetime] = Query(None, description="Filter by creation date (before)"),
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    List trip templates with filtering and pagination.
    
    Returns templates created by the current user and public templates from other users.
    """
    service = TripTemplateService(db)
    
    # Build filters
    filters = TripTemplateSearchFilters(
        query=query,
        is_public=is_public,
        category=category,
        tags=tags,
        min_duration_days=min_duration_days,
        max_duration_days=max_duration_days,
        min_participants=min_participants,
        max_participants=max_participants,
        created_by_me=created_by_me,
        created_after=created_after,
        created_before=created_before
    )
    
    try:
        result = await service.list_templates(
            user_id=current_user.id,
            filters=filters,
            page=page,
            page_size=page_size
        )
        return result
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error listing templates: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while retrieving templates"
        )


@router.get(
    "/templates/public",
    response_model=TripTemplateList,
    summary="Browse public templates",
    description="Browse all public templates from the community"
)
async def browse_public_templates(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    query: Optional[str] = Query(None, description="Search query for name or description"),
    category: Optional[str] = Query(None, description="Filter by category"),
    tags: Optional[List[str]] = Query(None, description="Filter by tags (OR condition)"),
    min_duration_days: Optional[int] = Query(None, ge=1, description="Minimum duration"),
    max_duration_days: Optional[int] = Query(None, ge=1, description="Maximum duration"),
    min_participants: Optional[int] = Query(None, ge=0, description="Minimum participants"),
    max_participants: Optional[int] = Query(None, ge=0, description="Maximum participants"),
    current_user: Optional[AuthUser] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    """
    Browse public templates from all users.
    
    This endpoint is accessible without authentication.
    """
    service = TripTemplateService(db)
    
    # Build filters for public templates only
    filters = TripTemplateSearchFilters(
        query=query,
        is_public=True,  # Force public only
        category=category,
        tags=tags,
        min_duration_days=min_duration_days,
        max_duration_days=max_duration_days,
        min_participants=min_participants,
        max_participants=max_participants
    )
    
    try:
        result = await service.get_public_templates(
            filters=filters,
            page=page,
            page_size=page_size
        )
        return result
    except Exception as e:
        logger.error(f"Error browsing public templates: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while retrieving public templates"
        )


@router.get(
    "/templates/{template_id}",
    response_model=TripTemplateResponse,
    summary="Get template details",
    description="Get detailed information about a specific template"
)
async def get_template(
    template_id: UUID = Path(..., description="Template ID"),
    current_user: Optional[AuthUser] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    """
    Get template details by ID.
    
    - Private templates require authentication and ownership
    - Public templates are accessible to all users
    """
    service = TripTemplateService(db)
    
    try:
        template = await service.get_template(
            template_id=template_id,
            user_id=current_user.id if current_user else None
        )
        return template
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template {template_id} not found"
        )
    except PermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to view this template"
        )
    except Exception as e:
        logger.error(f"Error retrieving template {template_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while retrieving the template"
        )


@router.put(
    "/templates/{template_id}",
    response_model=TripTemplateResponse,
    summary="Update template",
    description="Update an existing template (owner only)"
)
async def update_template(
    template_id: UUID = Path(..., description="Template ID"),
    template_data: TripTemplateUpdate = Body(...),
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update a template.
    
    Only the template owner can update it.
    All fields are optional - only provided fields will be updated.
    """
    service = TripTemplateService(db)
    
    try:
        template = await service.update_template(
            template_id=template_id,
            user_id=current_user.id,
            template_data=template_data
        )
        return template
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template {template_id} not found"
        )
    except PermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update your own templates"
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error updating template {template_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while updating the template"
        )


@router.delete(
    "/templates/{template_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete template",
    description="Delete a template (owner only)"
)
async def delete_template(
    template_id: UUID = Path(..., description="Template ID"),
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a template.
    
    Only the template owner can delete it.
    This operation is permanent and cannot be undone.
    """
    service = TripTemplateService(db)
    
    try:
        await service.delete_template(
            template_id=template_id,
            user_id=current_user.id
        )
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template {template_id} not found"
        )
    except PermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own templates"
        )
    except Exception as e:
        logger.error(f"Error deleting template {template_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while deleting the template"
        )


@router.post(
    "/templates/{template_id}/duplicate",
    response_model=TripTemplateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Duplicate template",
    description="Create a copy of an existing template"
)
async def duplicate_template(
    template_id: UUID = Path(..., description="Template ID to duplicate"),
    name: str = Body(..., min_length=1, max_length=200, description="Name for the new template"),
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Duplicate a template.
    
    - Can duplicate your own templates
    - Can duplicate public templates from other users
    - The new template will be owned by the current user
    """
    service = TripTemplateService(db)
    
    try:
        template = await service.duplicate_template(
            template_id=template_id,
            user_id=current_user.id,
            new_name=name
        )
        return template
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template {template_id} not found"
        )
    except PermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only duplicate your own templates or public templates"
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error duplicating template {template_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while duplicating the template"
        )


@router.post(
    "/from-template",
    response_model=TripResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create trip from template",
    description="Create a new trip based on a template"
)
async def create_trip_from_template(
    trip_data: CreateTripFromTemplate,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new trip from a template.
    
    - **template_id**: ID of the template to use
    - **trip_name**: Name for the new trip
    - **start_date**: Start date for the new trip
    - **include_meal_assignments**: Whether to copy meal assignments
    - **participant_overrides**: Optional custom participants
    - **meal_slot_overrides**: Optional custom meal slots
    - **notes**: Initial trip notes
    """
    service = TripTemplateService(db)
    
    try:
        trip = await service.create_trip_from_template(
            template_id=trip_data.template_id,
            user_id=current_user.id,
            create_data=trip_data
        )
        
        # Convert to TripResponse
        duration_days = (trip.end_date - trip.start_date).days + 1
        
        return TripResponse(
            id=trip.id,
            user_id=trip.user_id,
            name=trip.name,
            start_date=trip.start_date,
            end_date=trip.end_date,
            meal_slots=trip.meal_slots,
            recipe_storage_mode=trip.recipe_storage_mode,
            notes=trip.notes,
            is_archived=trip.is_archived,
            created_at=trip.created_at,
            updated_at=trip.updated_at,
            duration_days=duration_days,
            days=[],  # Will be populated by separate endpoint
            participants=[],  # Will be populated by separate endpoint
            has_stove=False,  # Default values
            stove_efficiency=None,
            total_meals_planned=0,
            completion_percentage=0.0,
            total_calories=None,
            total_weight_g=None
        )
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error creating trip from template: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while creating the trip from template"
        )


@router.get(
    "/templates/{template_id}/stats",
    response_model=Dict[str, Any],
    summary="Get template usage statistics",
    description="Get usage statistics for a template"
)
async def get_template_stats(
    template_id: UUID = Path(..., description="Template ID"),
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get usage statistics for a template.
    
    - Total number of trips created from this template
    - Last used date
    - Average rating (if implemented)
    
    Only template owner can view stats for private templates.
    """
    service = TripTemplateService(db)
    
    try:
        stats = await service.get_template_usage_stats(
            template_id=template_id,
            user_id=current_user.id
        )
        return stats
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template {template_id} not found"
        )
    except PermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view stats for your own templates or public templates"
        )
    except Exception as e:
        logger.error(f"Error getting template stats for {template_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while retrieving template statistics"
        )
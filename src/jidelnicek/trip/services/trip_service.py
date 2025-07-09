"""
Trip service for managing multi-day expeditions with meal planning.

This module provides business logic for trip management including:
- CRUD operations for trips
- Participant management
- Trip sharing functionality
- Duplication and templates
- Authorization and permission checks
"""

import secrets
from datetime import datetime, timedelta, timezone, date
from typing import Optional, List, Dict, Any, Tuple
from uuid import UUID
from decimal import Decimal

from sqlalchemy import select, func, and_, or_, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from jidelnicek.core.services.base import BaseService
from jidelnicek.trip.models.trip import Trip
from jidelnicek.trip.models.participant import TripParticipant
from jidelnicek.trip.models.day import TripDay
from jidelnicek.trip.models.meal import TripMeal
from jidelnicek.trip.schemas.trip import (
    TripCreate, TripUpdate, TripResponse, TripListItem, TripListResponse,
    TripSearchFilters, TripDuplicateRequest, TripCloneRequest
)
from jidelnicek.trip.schemas.participant import (
    ParticipantCreate as TripParticipantCreate,
    Participant as TripParticipantResponse
)
from jidelnicek.core.exceptions import (
    NotFoundError, PermissionError, ValidationError, ConflictError
)
from jidelnicek.trip.utils.coefficient_calculator import (
    CoefficientCalculator, 
    TripCoefficientSummary,
    DailyParticipantSummary,
    MealParticipantSummary
)


class TripService(BaseService):
    """Service class for trip management operations."""
    
    @property
    def model(self):
        """Return the Trip model class."""
        return Trip
    
    def __init__(self, session: AsyncSession):
        """
        Initialize trip service.
        
        Args:
            session: AsyncSession instance for database operations
        """
        super().__init__(session)
    
    async def create_trip(
        self, 
        user_id: UUID, 
        trip_data: TripCreate
    ) -> Trip:
        """
        Create a new trip with participants.
        
        Args:
            user_id: ID of the user creating the trip
            trip_data: Trip creation data including participants
            
        Returns:
            Created trip instance with participants
            
        Raises:
            ValidationError: If trip data is invalid
        """
        async with self.session.begin():
            # Create trip instance
            trip_dict = trip_data.model_dump(exclude={'participants'})
            trip = Trip(
                user_id=user_id,
                **trip_dict
            )
            
            self.session.add(trip)
            await self.session.flush()  # Get trip ID
            
            # TODO: Add participants when TripParticipant model is available
            # if trip_data.participants:
            #     for idx, participant_data in enumerate(trip_data.participants):
            #         participant = TripParticipant(
            #             trip_id=trip.id,
            #             name=participant_data.name,
            #             number=participant_data.number,
            #             coefficient=participant_data.coefficient,
            #             display_order=idx
            #         )
            #         self.session.add(participant)
            
            await self.session.commit()
            
            # Load relationships for response
            await self.session.refresh(trip)
            
            return trip
    
    async def list_trips(
        self,
        user_id: UUID,
        filters: Optional[TripSearchFilters] = None,
        page: int = 1,
        page_size: int = 20
    ) -> TripListResponse:
        """
        List user's trips with pagination and filtering.
        
        Args:
            user_id: ID of the user
            filters: Optional search filters
            page: Page number (1-based)
            page_size: Number of items per page
            
        Returns:
            Paginated trip list response
        """
        # Base query
        query = select(Trip).where(
            and_(
                Trip.user_id == user_id,
                Trip.is_archived == (filters.is_archived if filters and filters.is_archived is not None else False)
            )
        )
        
        # Apply filters
        if filters:
            if filters.query:
                query = query.where(
                    Trip.name.ilike(f"%{filters.query}%")
                )
            
            if filters.start_date_from:
                query = query.where(Trip.start_date >= filters.start_date_from)
            
            if filters.start_date_to:
                query = query.where(Trip.start_date <= filters.start_date_to)
            
            if filters.end_date_from:
                query = query.where(Trip.end_date >= filters.end_date_from)
            
            if filters.end_date_to:
                query = query.where(Trip.end_date <= filters.end_date_to)
            
            if filters.min_duration_days:
                query = query.where(
                    func.date_part('day', Trip.end_date - Trip.start_date) + 1 >= filters.min_duration_days
                )
            
            if filters.max_duration_days:
                query = query.where(
                    func.date_part('day', Trip.end_date - Trip.start_date) + 1 <= filters.max_duration_days
                )
            
            if filters.created_after:
                query = query.where(Trip.created_at >= filters.created_after)
            
            if filters.created_before:
                query = query.where(Trip.created_at <= filters.created_before)
        
        # Order by start date descending
        query = query.order_by(Trip.start_date.desc())
        
        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await self.session.execute(count_query)
        total_count = total_result.scalar() or 0
        
        # Apply pagination
        offset = (page - 1) * page_size
        query = query.offset(offset).limit(page_size)
        
        # Execute query
        result = await self.session.execute(query)
        trips = result.scalars().all()
        
        # Convert to response items
        items = []
        for trip in trips:
            items.append(TripListItem(
                id=trip.id,
                name=trip.name,
                start_date=trip.start_date,
                end_date=trip.end_date,
                duration_days=trip.duration_days,
                participant_count=trip.participant_count,
                meal_slot_count=len(trip.meal_slots) if trip.meal_slots else 0,
                recipe_storage_mode="snapshot",  # Default for now
                is_archived=trip.is_archived,
                created_at=trip.created_at,
                updated_at=trip.updated_at,
                has_stove=False,  # TODO: Update when stove model is available
                total_meals_planned=0,  # TODO: Calculate from days
                completion_percentage=0.0  # TODO: Calculate from days
            ))
        
        # Calculate pagination metadata
        total_pages = (total_count + page_size - 1) // page_size
        
        return TripListResponse(
            items=items,
            total=total_count,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            has_next=page < total_pages,
            has_prev=page > 1
        )
    
    async def get_trip(
        self,
        trip_id: UUID,
        user_id: Optional[UUID] = None,
        include_shared: bool = False
    ) -> Trip:
        """
        Get trip details with participants.
        
        Args:
            trip_id: ID of the trip
            user_id: ID of the requesting user (for permission check)
            include_shared: Whether to include trips shared with the user
            
        Returns:
            Trip instance with loaded relationships
            
        Raises:
            NotFoundError: If trip not found
            PermissionError: If user doesn't have access
        """
        # Build query with eager loading
        query = select(Trip).where(Trip.id == trip_id)
        
        # TODO: Add eager loading when relationships are available
        # query = query.options(
        #     selectinload(Trip.participants),
        #     selectinload(Trip.days).selectinload(TripDay.meals),
        #     selectinload(Trip.stove)
        # )
        
        result = await self.session.execute(query)
        trip = result.scalar_one_or_none()
        
        if not trip:
            raise NotFoundError(f"Trip {trip_id} not found")
        
        # Check permissions
        if user_id and trip.user_id != user_id:
            # Check if trip is shared and not expired
            if not include_shared or not trip.is_shareable:
                raise PermissionError("You don't have permission to view this trip")
        
        return trip
    
    async def update_trip(
        self,
        trip_id: UUID,
        user_id: UUID,
        update_data: TripUpdate
    ) -> Trip:
        """
        Update trip information.
        
        Args:
            trip_id: ID of the trip to update
            user_id: ID of the requesting user
            update_data: Update data
            
        Returns:
            Updated trip instance
            
        Raises:
            NotFoundError: If trip not found
            PermissionError: If user doesn't own the trip
            ValidationError: If update data is invalid
        """
        # Get trip and verify ownership
        trip = await self.get_trip(trip_id, user_id)
        
        if trip.user_id != user_id:
            raise PermissionError("You can only update your own trips")
        
        # Update fields
        update_dict = update_data.model_dump(exclude_unset=True, exclude_none=True)
        
        # Handle date updates specially to ensure consistency
        if 'start_date' in update_dict or 'end_date' in update_dict:
            new_start = update_dict.get('start_date', trip.start_date)
            new_end = update_dict.get('end_date', trip.end_date)
            
            if new_end < new_start:
                raise ValidationError("End date cannot be before start date")
        
        # TODO: Handle participant updates when model is available
        # if 'participants' in update_dict:
        #     participants_data = update_dict.pop('participants')
        #     await self._update_participants(trip, participants_data)
        
        # Update trip fields
        for field, value in update_dict.items():
            setattr(trip, field, value)
        
        await self.session.commit()
        await self.session.refresh(trip)
        
        return trip
    
    async def delete_trip(
        self,
        trip_id: UUID,
        user_id: UUID,
        soft_delete: bool = True
    ) -> bool:
        """
        Delete trip (soft delete by default).
        
        Args:
            trip_id: ID of the trip to delete
            user_id: ID of the requesting user
            soft_delete: Whether to soft delete (archive) or hard delete
            
        Returns:
            True if deleted successfully
            
        Raises:
            NotFoundError: If trip not found
            PermissionError: If user doesn't own the trip
        """
        # Get trip and verify ownership
        trip = await self.get_trip(trip_id, user_id)
        
        if trip.user_id != user_id:
            raise PermissionError("You can only delete your own trips")
        
        if soft_delete:
            trip.is_archived = True
            await self.session.commit()
        else:
            await self.session.delete(trip)
            await self.session.commit()
        
        return True
    
    async def duplicate_trip(
        self,
        trip_id: UUID,
        user_id: UUID,
        duplicate_data: TripDuplicateRequest
    ) -> Trip:
        """
        Duplicate an existing trip.
        
        Args:
            trip_id: ID of the trip to duplicate
            user_id: ID of the requesting user
            duplicate_data: Duplication options
            
        Returns:
            New duplicated trip instance
            
        Raises:
            NotFoundError: If trip not found
            PermissionError: If user doesn't own the trip
        """
        # Get source trip
        source_trip = await self.get_trip(trip_id, user_id)
        
        if source_trip.user_id != user_id:
            raise PermissionError("You can only duplicate your own trips")
        
        # Create new trip
        new_trip = Trip(
            user_id=user_id,
            name=duplicate_data.new_name or f"{source_trip.name} (Copy)",
            start_date=duplicate_data.new_start_date or source_trip.start_date,
            end_date=(duplicate_data.new_start_date + timedelta(days=source_trip.duration_days - 1)) 
                     if duplicate_data.new_start_date else source_trip.end_date,
            meal_slots=source_trip.meal_slots
        )
        
        self.session.add(new_trip)
        await self.session.flush()
        
        # TODO: Duplicate participants if requested
        # if duplicate_data.include_participants and source_trip.participants:
        #     for participant in source_trip.participants:
        #         new_participant = TripParticipant(
        #             trip_id=new_trip.id,
        #             name=participant.name,
        #             number=participant.number,
        #             coefficient=participant.coefficient,
        #             display_order=participant.display_order
        #         )
        #         self.session.add(new_participant)
        
        # TODO: Duplicate meals if requested
        # if duplicate_data.include_meals and source_trip.days:
        #     for day in source_trip.days:
        #         new_day = TripDay(
        #             trip_id=new_trip.id,
        #             day_number=day.day_number,
        #             date=new_trip.start_date + timedelta(days=day.day_number - 1)
        #         )
        #         self.session.add(new_day)
        #         await self.session.flush()
        #         
        #         for meal in day.meals:
        #             new_meal = TripMeal(
        #                 trip_day_id=new_day.id,
        #                 meal_slot=meal.meal_slot,
        #                 recipe_id=meal.recipe_id
        #             )
        #             self.session.add(new_meal)
        
        await self.session.commit()
        await self.session.refresh(new_trip)
        
        return new_trip
    
    async def clone_trip(
        self,
        trip_id: UUID,
        user_id: UUID,
        clone_data: TripCloneRequest
    ) -> Trip:
        """
        Clone an existing trip with full configuration options.
        
        Args:
            trip_id: ID of the trip to clone
            user_id: ID of the requesting user  
            clone_data: Clone configuration including what to copy
            
        Returns:
            New cloned trip instance
            
        Raises:
            NotFoundError: If trip not found
            PermissionError: If user doesn't have access to the trip
            ValidationError: If clone data is invalid
        """
        # Get source trip with all relationships
        query = select(Trip).where(Trip.id == trip_id).options(
            selectinload(Trip.participants),
            selectinload(Trip.days).selectinload(TripDay.meals),
        )
        
        result = await self.session.execute(query)
        source_trip = result.scalar_one_or_none()
        
        if not source_trip:
            raise NotFoundError(f"Trip {trip_id} not found")
        
        # Check permissions - user must own the trip or have share access
        if source_trip.user_id != user_id:
            if not source_trip.is_shareable:
                raise PermissionError("You don't have permission to clone this trip")
        
        # Calculate new trip duration based on original
        duration_days = source_trip.duration_days
        new_end_date = clone_data.start_date + timedelta(days=duration_days - 1)
        
        # Create new trip
        new_trip = Trip(
            user_id=user_id,  # New trip belongs to the cloning user
            name=clone_data.new_name,
            start_date=clone_data.start_date,
            end_date=new_end_date,
            meal_slots=source_trip.meal_slots if clone_data.clone_meal_slots else ["Breakfast", "Lunch", "Dinner"]
        )
        
        self.session.add(new_trip)
        await self.session.flush()  # Get the new trip ID
        
        # Clone or create participants
        if clone_data.participant_overrides:
            # Use provided participant overrides
            for idx, participant_data in enumerate(clone_data.participant_overrides):
                participant = TripParticipant(
                    trip_id=new_trip.id,
                    name=participant_data.name,
                    number=participant_data.number,
                    coefficient=participant_data.coefficient or Decimal('100.00'),
                    email=participant_data.email,
                    meal_coefficients=participant_data.meal_coefficients,
                    arrival_date=participant_data.arrival_date,
                    departure_date=participant_data.departure_date
                )
                self.session.add(participant)
        elif clone_data.clone_participants and source_trip.participants:
            # Clone participants from source trip
            for participant in source_trip.participants:
                new_participant = TripParticipant(
                    trip_id=new_trip.id,
                    name=participant.name,
                    number=participant.number,
                    coefficient=participant.coefficient,
                    email=participant.email,
                    meal_coefficients=participant.meal_coefficients,
                    # Don't copy arrival/departure dates as they're trip-specific
                    arrival_date=None,
                    departure_date=None
                )
                self.session.add(new_participant)
        
        # Clone meal assignments if requested
        if clone_data.clone_meal_assignments and source_trip.days:
            # Create days for the new trip
            for source_day in source_trip.days:
                # Calculate new date for this day
                new_day_date = new_trip.start_date + timedelta(days=source_day.day_number - 1)
                
                new_day = TripDay(
                    trip_id=new_trip.id,
                    day_number=source_day.day_number,
                    date=new_day_date,
                    notes=source_day.notes
                )
                self.session.add(new_day)
                await self.session.flush()  # Get the new day ID
                
                # Clone meals for this day
                if source_day.meals:
                    for meal in source_day.meals:
                        new_meal = TripMeal(
                            day_id=new_day.id,
                            recipe_id=meal.recipe_id,
                            meal_slot=meal.meal_slot,
                            servings_override=meal.servings_override,
                            notes=meal.notes,
                            recipe_snapshot=meal.recipe_snapshot  # Copy snapshot if exists
                        )
                        self.session.add(new_meal)
        
        await self.session.commit()
        
        # Refresh to load all relationships
        await self.session.refresh(new_trip)
        
        return new_trip
    
    async def share_trip(
        self,
        trip_id: UUID,
        user_id: UUID,
        expires_hours: int = 24
    ) -> Dict[str, Any]:
        """
        Generate share link for a trip.
        
        Args:
            trip_id: ID of the trip to share
            user_id: ID of the requesting user
            expires_hours: Hours until the share link expires
            
        Returns:
            Dictionary with share token and expiration
            
        Raises:
            NotFoundError: If trip not found
            PermissionError: If user doesn't own the trip
        """
        # Get trip and verify ownership
        trip = await self.get_trip(trip_id, user_id)
        
        if trip.user_id != user_id:
            raise PermissionError("You can only share your own trips")
        
        # Generate share token
        share_token = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + timedelta(hours=expires_hours)
        
        # Update trip
        trip.share_token = share_token
        trip.share_expires_at = expires_at
        
        await self.session.commit()
        
        return {
            "share_token": share_token,
            "expires_at": expires_at,
            "expires_hours": expires_hours
        }
    
    async def get_shared_trip(
        self,
        share_token: str
    ) -> Trip:
        """
        Get trip by share token.
        
        Args:
            share_token: Share token
            
        Returns:
            Trip instance
            
        Raises:
            NotFoundError: If trip not found or share link expired
        """
        query = select(Trip).where(
            and_(
                Trip.share_token == share_token,
                Trip.share_expires_at > datetime.now(timezone.utc)
            )
        )
        
        # TODO: Add eager loading when relationships are available
        # query = query.options(
        #     selectinload(Trip.participants),
        #     selectinload(Trip.days).selectinload(TripDay.meals)
        # )
        
        result = await self.session.execute(query)
        trip = result.scalar_one_or_none()
        
        if not trip:
            raise NotFoundError("Share link not found or expired")
        
        return trip
    
    async def get_user_stats(
        self,
        user_id: UUID
    ) -> Dict[str, Any]:
        """
        Get user's trip statistics.
        
        Args:
            user_id: ID of the user
            
        Returns:
            Dictionary with trip statistics
        """
        # Base query for user's trips
        base_query = select(Trip).where(Trip.user_id == user_id)
        
        # Get counts
        total_trips = await self.session.scalar(
            select(func.count(Trip.id)).where(Trip.user_id == user_id)
        )
        
        active_trips = await self.session.scalar(
            select(func.count(Trip.id)).where(
                and_(
                    Trip.user_id == user_id,
                    Trip.is_archived == False
                )
            )
        )
        
        archived_trips = await self.session.scalar(
            select(func.count(Trip.id)).where(
                and_(
                    Trip.user_id == user_id,
                    Trip.is_archived == True
                )
            )
        )
        
        # Calculate total trip days
        total_days_result = await self.session.execute(
            select(
                func.sum(
                    func.date_part('day', Trip.end_date - Trip.start_date) + 1
                )
            ).where(Trip.user_id == user_id)
        )
        total_trip_days = total_days_result.scalar() or 0
        
        # Calculate average duration
        avg_duration = float(total_trip_days) / total_trips if total_trips > 0 else 0
        
        # Get most common meal slots
        meal_slots_result = await self.session.execute(
            select(
                func.unnest(Trip.meal_slots).label('slot'),
                func.count('*').label('count')
            )
            .where(Trip.user_id == user_id)
            .group_by('slot')
            .order_by(func.count('*').desc())
            .limit(5)
        )
        
        most_common_meal_slots = [
            {"slot": row.slot, "count": row.count}
            for row in meal_slots_result
        ]
        
        return {
            "total_trips": total_trips,
            "active_trips": active_trips,
            "archived_trips": archived_trips,
            "total_trip_days": int(total_trip_days),
            "average_trip_duration": round(avg_duration, 1),
            "average_participants": 0.0,  # TODO: Calculate when participants are available
            "most_common_meal_slots": most_common_meal_slots,
            "trips_with_stoves": 0,  # TODO: Calculate when stove model is available
            "snapshot_mode_trips": total_trips,  # Default for now
            "track_changes_mode_trips": 0
        }
    
    async def calculate_meal_participants(
        self,
        trip_id: UUID,
        day_id: UUID,
        meal_slot: str,
        user_id: Optional[UUID] = None
    ) -> MealParticipantSummary:
        """
        Calculate effective participant count for a specific meal.
        
        Args:
            trip_id: ID of the trip
            day_id: ID of the day
            meal_slot: Name of the meal slot
            user_id: Optional user ID for permission check
            
        Returns:
            MealParticipantSummary with effective counts
            
        Raises:
            NotFoundError: If trip or day not found
            PermissionError: If user doesn't have access
        """
        # Verify trip access
        trip = await self.get_trip(trip_id, user_id)
        
        calculator = CoefficientCalculator(self.session)
        return await calculator.calculate_meal_participants(
            trip_id=trip_id,
            day_id=day_id,
            meal_slot=meal_slot
        )
    
    async def calculate_daily_participants(
        self,
        trip_id: UUID,
        day_id: UUID,
        user_id: Optional[UUID] = None
    ) -> DailyParticipantSummary:
        """
        Calculate participant summary for a specific day.
        
        Args:
            trip_id: ID of the trip
            day_id: ID of the day
            user_id: Optional user ID for permission check
            
        Returns:
            DailyParticipantSummary with meal breakdowns
            
        Raises:
            NotFoundError: If trip or day not found
            PermissionError: If user doesn't have access
        """
        # Verify trip access
        trip = await self.get_trip(trip_id, user_id)
        
        calculator = CoefficientCalculator(self.session)
        return await calculator.calculate_daily_participants(
            trip_id=trip_id,
            day_id=day_id
        )
    
    async def calculate_trip_coefficients(
        self,
        trip_id: UUID,
        user_id: Optional[UUID] = None,
        attendance_dates: Optional[Dict[UUID, Tuple[date, date]]] = None
    ) -> TripCoefficientSummary:
        """
        Calculate overall coefficient summary for a trip.
        
        Args:
            trip_id: ID of the trip
            user_id: Optional user ID for permission check
            attendance_dates: Optional dict of participant attendance ranges
            
        Returns:
            TripCoefficientSummary with complete analysis
            
        Raises:
            NotFoundError: If trip not found
            PermissionError: If user doesn't have access
        """
        # Verify trip access
        trip = await self.get_trip(trip_id, user_id)
        
        calculator = CoefficientCalculator(self.session)
        return await calculator.calculate_trip_summary(
            trip_id=trip_id,
            attendance_dates=attendance_dates
        )
    
    async def calculate_ingredient_quantities(
        self,
        trip_id: UUID,
        ingredient_base_quantity: Decimal,
        meal_slots: Optional[List[str]] = None,
        user_id: Optional[UUID] = None,
        attendance_dates: Optional[Dict[UUID, Tuple[date, date]]] = None
    ) -> Dict[str, Decimal]:
        """
        Calculate ingredient quantities based on participant coefficients.
        
        Args:
            trip_id: ID of the trip
            ingredient_base_quantity: Base quantity per person
            meal_slots: Optional list of meal slots to consider
            user_id: Optional user ID for permission check
            attendance_dates: Optional dict of participant attendance ranges
            
        Returns:
            Dict of meal slot to total quantity needed
            
        Raises:
            NotFoundError: If trip not found
            PermissionError: If user doesn't have access
        """
        # Verify trip access
        trip = await self.get_trip(trip_id, user_id)
        
        calculator = CoefficientCalculator(self.session)
        return await calculator.calculate_shopping_quantities(
            trip_id=trip_id,
            base_quantity=ingredient_base_quantity,
            meal_slots=meal_slots,
            attendance_dates=attendance_dates
        )
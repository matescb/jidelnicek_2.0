"""
API endpoints for recipe scaling preview functionality.
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from jidelnicek.core.dependencies import get_db
from jidelnicek.core.exceptions import NotFoundError, ValidationError, PermissionError
from jidelnicek.auth.dependencies.auth import get_current_user
from jidelnicek.auth.models import AuthUser
from jidelnicek.recipe.services.scaling_service import ScalingService
from jidelnicek.recipe.services.recipe_service import RecipeService
from jidelnicek.recipe.schemas.scaling import (
    ScalingPreviewRequest,
    ScalingPreviewResponse,
    CalorieScalingRequest,
    CalorieScalingResponse,
    ParticipantScalingRequest,
    ParticipantScalingResponse
)


router = APIRouter(prefix="/recipes", tags=["recipe-scaling"])


async def verify_recipe_access(
    recipe_id: UUID,
    user: AuthUser,
    db: AsyncSession
) -> None:
    """
    Verify user has access to view the recipe.
    
    Raises:
        HTTPException: If recipe not found or user doesn't have access
    """
    recipe_service = RecipeService(db)
    try:
        recipe = await recipe_service.get_recipe(recipe_id, user.id)
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipe not found"
        )
    except PermissionError:
        # Check if recipe is public
        try:
            recipe = await recipe_service.get_public_recipe(recipe_id)
        except (NotFoundError, PermissionError):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to access this recipe"
            )


@router.post(
    "/{recipe_id}/scaling/preview",
    response_model=ScalingPreviewResponse,
    summary="Preview basic recipe scaling",
    description="Preview how a recipe's ingredients will be scaled for different serving sizes"
)
async def preview_recipe_scaling(
    recipe_id: UUID,
    request: ScalingPreviewRequest,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> ScalingPreviewResponse:
    """Preview basic recipe scaling with intelligent rounding and constraints."""
    # Verify access
    await verify_recipe_access(recipe_id, current_user, db)
    
    # Get scaling preview
    scaling_service = ScalingService(db)
    try:
        preview_data = await scaling_service.preview_recipe_scaling(
            recipe_id=recipe_id,
            target_servings=request.target_servings,
            use_rounding=request.use_rounding,
            use_constraints=request.use_constraints
        )
        
        # Convert to response model
        ingredients = [
            {
                "name": ing["name"],
                "original_quantity": ing["original_quantity"],
                "scaled_quantity": ing["scaled_quantity"],
                "unit": ing["unit"],
                "was_rounded": ing["was_rounded"],
                "unrounded_quantity": ing.get("unrounded_quantity"),
                "rounding_difference": ing.get("rounding_difference")
            }
            for ing in preview_data["ingredients"]
        ]
        
        return ScalingPreviewResponse(
            recipe_id=preview_data["recipe_id"],
            recipe_name=preview_data["recipe_name"],
            original_servings=preview_data["original_servings"],
            target_servings=preview_data["target_servings"],
            scaling_factor=preview_data["scaling_factor"],
            ingredients=ingredients,
            warnings=preview_data["warnings"],
            constraints_applied=preview_data["constraints_applied"],
            rounding_applied=preview_data["rounding_applied"]
        )
        
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating scaling preview: {str(e)}"
        )


@router.post(
    "/{recipe_id}/scaling/preview/calories",
    response_model=CalorieScalingResponse,
    summary="Preview calorie-based recipe scaling",
    description="Preview how a recipe will be scaled to meet specific calorie targets"
)
async def preview_calorie_scaling(
    recipe_id: UUID,
    request: CalorieScalingRequest,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> CalorieScalingResponse:
    """Preview calorie-based recipe scaling."""
    # Verify access
    await verify_recipe_access(recipe_id, current_user, db)
    
    # Get scaling preview
    scaling_service = ScalingService(db)
    try:
        preview_data = await scaling_service.preview_calorie_scaling(
            recipe_id=recipe_id,
            target_calories=request.target_calories,
            target_servings=request.target_servings
        )
        
        return CalorieScalingResponse(**preview_data)
        
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating calorie scaling preview: {str(e)}"
        )


@router.post(
    "/{recipe_id}/scaling/preview/participants",
    response_model=ParticipantScalingResponse,
    summary="Preview participant-based recipe scaling",
    description="Preview how a recipe will be scaled based on participant coefficients and requirements"
)
async def preview_participant_scaling(
    recipe_id: UUID,
    request: ParticipantScalingRequest,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> ParticipantScalingResponse:
    """Preview participant-based recipe scaling with optional calorie targets."""
    # Verify access
    await verify_recipe_access(recipe_id, current_user, db)
    
    # Get scaling preview
    scaling_service = ScalingService(db)
    try:
        # Convert participants to dict format
        participants = [p.dict() for p in request.participants]
        
        preview_data = await scaling_service.preview_participant_scaling(
            recipe_id=recipe_id,
            participants=participants,
            meal_type=request.meal_type,
            target_calories_per_person=request.target_calories_per_person
        )
        
        # Convert participant details to response format
        participant_details = [
            {
                "name": pd["name"],
                "base_coefficient": pd["base_coefficient"],
                "meal_coefficient": pd["meal_coefficient"],
                "attendance_factor": pd["attendance_factor"],
                "effective_coefficient": pd["effective_coefficient"],
                "calories_allocated": pd["calories_allocated"]
            }
            for pd in preview_data["participant_details"]
        ]
        
        return ParticipantScalingResponse(
            recipe_id=preview_data["recipe_id"],
            recipe_name=preview_data["recipe_name"],
            original_servings=preview_data["original_servings"],
            participant_count=preview_data["participant_count"],
            effective_participants=preview_data["effective_participants"],
            meal_type=preview_data["meal_type"],
            scaling_factor=preview_data["scaling_factor"],
            ingredients=preview_data["ingredients"],
            participant_details=participant_details,
            warnings=preview_data["warnings"],
            target_calories_per_person=preview_data.get("target_calories_per_person"),
            total_calories=preview_data.get("total_calories"),
            calories_per_effective_participant=preview_data.get("calories_per_effective_participant")
        )
        
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating participant scaling preview: {str(e)}"
        )
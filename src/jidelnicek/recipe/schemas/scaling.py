"""
Pydantic schemas for recipe scaling preview and operations.
"""

from typing import List, Optional, Dict, Any
from decimal import Decimal
from pydantic import BaseModel, Field, validator
from uuid import UUID


class ScalingPreviewRequest(BaseModel):
    """Base request for recipe scaling preview."""
    target_servings: int = Field(..., ge=1, le=100, description="Target number of servings")
    use_rounding: bool = Field(True, description="Apply intelligent rounding rules")
    use_constraints: bool = Field(True, description="Apply scaling constraints")


class IngredientScalingPreview(BaseModel):
    """Preview of how an ingredient will be scaled."""
    name: str
    original_quantity: float
    scaled_quantity: float
    unit: str
    was_rounded: bool
    unrounded_quantity: Optional[float] = None
    rounding_difference: Optional[float] = None


class ScalingPreviewResponse(BaseModel):
    """Response for recipe scaling preview."""
    recipe_id: str
    recipe_name: str
    original_servings: int
    target_servings: int
    scaling_factor: float
    ingredients: List[IngredientScalingPreview]
    warnings: List[str]
    constraints_applied: bool
    rounding_applied: bool


class CalorieScalingRequest(BaseModel):
    """Request for calorie-based scaling preview."""
    target_calories: float = Field(..., gt=0, le=5000, description="Target calories per serving")
    target_servings: int = Field(1, ge=1, le=100, description="Number of servings")
    
    @validator('target_calories')
    def validate_calories(cls, v):
        """Ensure reasonable calorie targets."""
        if v < 50:
            raise ValueError("Target calories must be at least 50")
        if v > 5000:
            raise ValueError("Target calories cannot exceed 5000 per serving")
        return v


class CalorieScalingResponse(BaseModel):
    """Response for calorie-based scaling preview."""
    recipe_id: str
    recipe_name: str
    original_servings: int
    target_servings: int
    target_calories: float
    original_calories_total: float
    original_calories_per_serving: float
    scaled_calories_total: float
    scaled_calories_per_serving: float
    scaling_factor: float
    ingredients: List[Dict[str, Any]]
    warnings: List[str]


class ParticipantData(BaseModel):
    """Data for a single participant in scaling."""
    name: str = Field(..., min_length=1, max_length=100)
    coefficient: int = Field(100, ge=10, le=300, description="Base coefficient percentage")
    meal_coefficients: Optional[Dict[str, int]] = Field(None, description="Meal-specific coefficients")
    attendance_factor: Optional[float] = Field(1.0, ge=0, le=1, description="Partial attendance factor")
    
    @validator('meal_coefficients')
    def validate_meal_coefficients(cls, v):
        """Ensure meal coefficients are reasonable."""
        if v:
            for meal, coef in v.items():
                if not 10 <= coef <= 300:
                    raise ValueError(f"Meal coefficient for {meal} must be between 10 and 300")
        return v


class ParticipantDetail(BaseModel):
    """Detailed participant information in response."""
    name: str
    base_coefficient: int
    meal_coefficient: Optional[int]
    attendance_factor: float
    effective_coefficient: float
    calories_allocated: Optional[float]


class ParticipantScalingRequest(BaseModel):
    """Request for participant-based scaling preview."""
    participants: List[ParticipantData] = Field(..., min_items=1, max_items=20)
    meal_type: Optional[str] = Field(None, description="Meal type for meal-specific coefficients")
    target_calories_per_person: Optional[float] = Field(None, gt=0, le=2000)
    
    @validator('meal_type')
    def validate_meal_type(cls, v):
        """Ensure valid meal type."""
        if v and v not in ['Breakfast', 'Lunch', 'Dinner', 'Snack']:
            raise ValueError("Invalid meal type")
        return v


class ParticipantScalingResponse(BaseModel):
    """Response for participant-based scaling preview."""
    recipe_id: str
    recipe_name: str
    original_servings: int
    participant_count: int
    effective_participants: float
    meal_type: Optional[str]
    scaling_factor: float
    ingredients: List[Dict[str, Any]]
    participant_details: List[ParticipantDetail]
    warnings: List[str]
    # Calorie fields (only when target_calories_per_person is provided)
    target_calories_per_person: Optional[float]
    total_calories: Optional[float]
    calories_per_effective_participant: Optional[float]
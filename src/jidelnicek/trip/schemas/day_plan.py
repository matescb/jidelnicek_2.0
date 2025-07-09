"""
Trip day plan schemas.

This module defines Pydantic schemas for organizing meals by day with participant
attendance tracking, providing comprehensive views for meal planning and shopping.
"""

from datetime import date, datetime
from typing import Optional, List, Dict, Any
from uuid import UUID
from decimal import Decimal

from pydantic import BaseModel, Field, ConfigDict, field_validator, model_validator

from .meal import MealAssignment, RecipeSnapshot
from .participant import Participant


class ParticipantAttendance(BaseModel):
    """Track participant presence for each meal."""
    participant_id: UUID
    participant_name: str
    is_present: bool = Field(..., description="Whether participant is present for this meal")
    base_coefficient: Decimal = Field(..., description="Base coefficient (percentage)")
    meal_coefficient: Optional[Decimal] = Field(None, description="Meal-specific coefficient if different")
    effective_coefficient: Decimal = Field(..., description="Actual coefficient applied (0 if not present)")
    
    @model_validator(mode='after')
    def calculate_effective(self):
        """Calculate effective coefficient based on presence."""
        if not self.is_present:
            self.effective_coefficient = Decimal('0')
        else:
            self.effective_coefficient = self.meal_coefficient or self.base_coefficient
        return self
    
    @property
    def portion_multiplier(self) -> float:
        """Get portion multiplier (1.0 = 100%)."""
        return float(self.effective_coefficient) / 100.0
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "participant_id": "550e8400-e29b-41d4-a716-446655440000",
                "participant_name": "John Doe",
                "is_present": True,
                "base_coefficient": "100.00",
                "meal_coefficient": "75.00",
                "effective_coefficient": "75.00"
            }
        }
    )


class MealIngredientSummary(BaseModel):
    """Summary of an ingredient for a meal with scaled quantities."""
    ingredient_id: UUID
    name: str
    quantity: Decimal
    unit: str
    category: Optional[str] = None
    notes: Optional[str] = None
    scaling_factor: Decimal = Field(..., description="Factor applied to scale quantity")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "ingredient_id": "550e8400-e29b-41d4-a716-446655440000",
                "name": "Flour",
                "quantity": "2.5",
                "unit": "kg",
                "category": "Baking",
                "scaling_factor": "1.25"
            }
        }
    )


class MealNutritionalSummary(BaseModel):
    """Nutritional information for a meal."""
    calories: Optional[Decimal] = None
    protein_g: Optional[Decimal] = None
    carbs_g: Optional[Decimal] = None
    fat_g: Optional[Decimal] = None
    fiber_g: Optional[Decimal] = None
    sugar_g: Optional[Decimal] = None
    sodium_mg: Optional[Decimal] = None
    
    @property
    def has_data(self) -> bool:
        """Check if any nutritional data is available."""
        return any(
            value is not None 
            for value in [
                self.calories, self.protein_g, self.carbs_g,
                self.fat_g, self.fiber_g, self.sugar_g, self.sodium_mg
            ]
        )
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "calories": "350.0",
                "protein_g": "12.5",
                "carbs_g": "45.0",
                "fat_g": "15.0"
            }
        }
    )


class MealSlotPlan(BaseModel):
    """Detailed view of a meal slot with all planning information."""
    # Meal slot information
    meal_slot_id: UUID
    meal_type: str
    meal_slot_name: str = Field(..., description="Display name (custom or type)")
    is_active: bool
    display_order: int
    
    # Assigned meal information (if any)
    meal_assignment: Optional[MealAssignment] = None
    recipe_snapshot: Optional[RecipeSnapshot] = None
    
    # Participant information
    participant_count: int = Field(..., description="Number of participants present")
    effective_participant_count: Decimal = Field(..., description="Sum of participant coefficients")
    participant_attendance: List[ParticipantAttendance] = Field(default_factory=list)
    
    # Portion calculations
    base_servings: int = Field(0, description="Recipe's default servings")
    required_servings: int = Field(0, description="Calculated required servings")
    servings_override: Optional[int] = Field(None, description="Manual override if set")
    effective_servings: int = Field(0, description="Actual servings to prepare")
    scaling_factor: Decimal = Field(Decimal('1.0'), description="Ingredient scaling factor")
    
    # Shopping list for this meal
    ingredients: List[MealIngredientSummary] = Field(default_factory=list)
    
    # Nutritional information (per serving and total)
    nutrition_per_serving: Optional[MealNutritionalSummary] = None
    nutrition_total: Optional[MealNutritionalSummary] = None
    
    @model_validator(mode='after')
    def calculate_servings(self):
        """Calculate serving information."""
        if self.meal_assignment:
            self.base_servings = self.meal_assignment.recipe_servings or 0
            self.servings_override = self.meal_assignment.servings_override
            self.effective_servings = self.meal_assignment.effective_servings
            
            # Calculate required servings based on effective participant count
            if self.effective_participant_count > 0:
                self.required_servings = int(self.effective_participant_count.quantize(Decimal('1')))
                
                # Calculate scaling factor
                if self.base_servings > 0:
                    self.scaling_factor = Decimal(str(self.effective_servings)) / Decimal(str(self.base_servings))
        
        return self
    
    @property
    def needs_assignment(self) -> bool:
        """Check if this slot needs a meal assignment."""
        return self.is_active and self.meal_assignment is None
    
    @property
    def is_scaled(self) -> bool:
        """Check if portions need scaling."""
        return self.scaling_factor != Decimal('1.0')
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "meal_slot_id": "550e8400-e29b-41d4-a716-446655440000",
                "meal_type": "Breakfast",
                "meal_slot_name": "Breakfast",
                "is_active": True,
                "display_order": 1,
                "meal_assignment": None,
                "participant_count": 8,
                "effective_participant_count": "7.5",
                "participant_attendance": [],
                "base_servings": 4,
                "required_servings": 8,
                "effective_servings": 8,
                "scaling_factor": "2.0",
                "ingredients": []
            }
        }
    )


class DayShoppingItem(BaseModel):
    """Single shopping list item aggregated for a day."""
    ingredient_id: UUID
    name: str
    total_quantity: Decimal
    unit: str
    category: Optional[str] = None
    meal_sources: List[str] = Field(default_factory=list, description="Meals using this ingredient")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "ingredient_id": "550e8400-e29b-41d4-a716-446655440000",
                "name": "Milk",
                "total_quantity": "3.5",
                "unit": "L",
                "category": "Dairy",
                "meal_sources": ["Breakfast", "Dinner"]
            }
        }
    )


class DayShoppingList(BaseModel):
    """Aggregated shopping list for a day."""
    day_id: UUID
    day_number: int
    date: str  # ISO format
    total_items: int
    categories: Dict[str, List[DayShoppingItem]] = Field(
        default_factory=dict,
        description="Items grouped by category"
    )
    
    @model_validator(mode='after')
    def calculate_totals(self):
        """Calculate total items."""
        self.total_items = sum(
            len(items) for items in self.categories.values()
        )
        return self
    
    @property
    def all_items(self) -> List[DayShoppingItem]:
        """Get all items as a flat list."""
        items = []
        for category_items in self.categories.values():
            items.extend(category_items)
        return items
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "day_id": "550e8400-e29b-41d4-a716-446655440000",
                "day_number": 1,
                "date": "2024-07-01",
                "total_items": 15,
                "categories": {
                    "Dairy": [],
                    "Produce": [],
                    "Pantry": []
                }
            }
        }
    )


class DayPlanSummary(BaseModel):
    """Summary view of a single day with complete meal planning information."""
    # Day information
    day_id: UUID
    day_number: int
    date: str  # ISO format
    
    # Participant summary
    total_participants: int = Field(..., description="Unique participants for the day")
    average_effective_count: Decimal = Field(..., description="Average across all meals")
    
    # Meal slots with plans
    meal_slots: List[MealSlotPlan] = Field(default_factory=list)
    
    # Day statistics
    total_meal_slots: int = Field(0)
    active_meal_slots: int = Field(0)
    assigned_meals: int = Field(0)
    completion_percentage: float = Field(0.0)
    
    # Nutritional totals for the day
    nutrition_totals: Optional[MealNutritionalSummary] = None
    nutrition_per_person: Optional[MealNutritionalSummary] = None
    
    # Shopping list
    shopping_list: Optional[DayShoppingList] = None
    
    @model_validator(mode='after')
    def calculate_statistics(self):
        """Calculate day statistics."""
        self.total_meal_slots = len(self.meal_slots)
        self.active_meal_slots = sum(1 for slot in self.meal_slots if slot.is_active)
        self.assigned_meals = sum(
            1 for slot in self.meal_slots 
            if slot.is_active and slot.meal_assignment is not None
        )
        
        if self.active_meal_slots > 0:
            self.completion_percentage = (self.assigned_meals / self.active_meal_slots) * 100
        
        # Calculate nutritional totals
        if any(slot.nutrition_total for slot in self.meal_slots):
            self.nutrition_totals = MealNutritionalSummary()
            
            for slot in self.meal_slots:
                if slot.nutrition_total:
                    for field in ['calories', 'protein_g', 'carbs_g', 'fat_g', 
                                  'fiber_g', 'sugar_g', 'sodium_mg']:
                        current = getattr(self.nutrition_totals, field) or Decimal('0')
                        slot_value = getattr(slot.nutrition_total, field) or Decimal('0')
                        setattr(self.nutrition_totals, field, current + slot_value)
            
            # Calculate per person
            if self.average_effective_count > 0:
                self.nutrition_per_person = MealNutritionalSummary()
                for field in ['calories', 'protein_g', 'carbs_g', 'fat_g', 
                              'fiber_g', 'sugar_g', 'sodium_mg']:
                    total_value = getattr(self.nutrition_totals, field)
                    if total_value:
                        per_person = total_value / self.average_effective_count
                        setattr(self.nutrition_per_person, field, per_person)
        
        return self
    
    @property
    def is_fully_planned(self) -> bool:
        """Check if all active meal slots have assignments."""
        return self.active_meal_slots > 0 and self.assigned_meals == self.active_meal_slots
    
    @property
    def unassigned_slots(self) -> List[MealSlotPlan]:
        """Get list of unassigned active meal slots."""
        return [
            slot for slot in self.meal_slots 
            if slot.is_active and slot.meal_assignment is None
        ]
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "day_id": "550e8400-e29b-41d4-a716-446655440000",
                "day_number": 1,
                "date": "2024-07-01",
                "total_participants": 10,
                "average_effective_count": "9.5",
                "meal_slots": [],
                "total_meal_slots": 3,
                "active_meal_slots": 3,
                "assigned_meals": 2,
                "completion_percentage": 66.7,
                "nutrition_totals": None,
                "shopping_list": None
            }
        }
    )


class TripDayByDayPlan(BaseModel):
    """Complete day-by-day view of the trip with all planning details."""
    trip_id: UUID
    trip_name: str
    start_date: str
    end_date: str
    total_days: int
    
    # Overall statistics
    total_participants: int
    total_meal_slots: int
    total_assigned_meals: int
    overall_completion_percentage: float
    
    # Day plans
    days: List[DayPlanSummary] = Field(default_factory=list)
    
    # Trip-wide summaries
    total_unique_recipes: int = Field(0)
    total_shopping_items: int = Field(0)
    meal_type_distribution: Dict[str, int] = Field(
        default_factory=dict,
        description="Count of meals by type"
    )
    
    # Nutritional summary
    average_daily_nutrition: Optional[MealNutritionalSummary] = None
    
    @model_validator(mode='after')
    def calculate_trip_statistics(self):
        """Calculate trip-wide statistics."""
        self.total_days = len(self.days)
        
        # Calculate totals
        self.total_meal_slots = sum(day.total_meal_slots for day in self.days)
        self.total_assigned_meals = sum(day.assigned_meals for day in self.days)
        
        if self.total_meal_slots > 0:
            self.overall_completion_percentage = (
                self.total_assigned_meals / self.total_meal_slots
            ) * 100
        
        # Count unique recipes and meal types
        unique_recipes = set()
        meal_type_counts = {}
        
        for day in self.days:
            for slot in day.meal_slots:
                if slot.meal_assignment:
                    unique_recipes.add(slot.meal_assignment.recipe_id)
                    meal_type = slot.meal_type
                    meal_type_counts[meal_type] = meal_type_counts.get(meal_type, 0) + 1
        
        self.total_unique_recipes = len(unique_recipes)
        self.meal_type_distribution = meal_type_counts
        
        # Calculate shopping items
        shopping_items = set()
        for day in self.days:
            if day.shopping_list:
                for item in day.shopping_list.all_items:
                    shopping_items.add(item.ingredient_id)
        self.total_shopping_items = len(shopping_items)
        
        # Calculate average daily nutrition
        days_with_nutrition = [
            day for day in self.days 
            if day.nutrition_totals and day.nutrition_totals.has_data
        ]
        
        if days_with_nutrition:
            self.average_daily_nutrition = MealNutritionalSummary()
            
            for field in ['calories', 'protein_g', 'carbs_g', 'fat_g', 
                          'fiber_g', 'sugar_g', 'sodium_mg']:
                total = Decimal('0')
                count = 0
                
                for day in days_with_nutrition:
                    value = getattr(day.nutrition_totals, field)
                    if value is not None:
                        total += value
                        count += 1
                
                if count > 0:
                    average = total / count
                    setattr(self.average_daily_nutrition, field, average)
        
        return self
    
    @property
    def is_fully_planned(self) -> bool:
        """Check if all days are fully planned."""
        return all(day.is_fully_planned for day in self.days)
    
    @property
    def days_needing_meals(self) -> List[DayPlanSummary]:
        """Get days that still need meal assignments."""
        return [day for day in self.days if not day.is_fully_planned]
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "trip_id": "550e8400-e29b-41d4-a716-446655440001",
                "trip_name": "Summer Camp 2024",
                "start_date": "2024-07-01",
                "end_date": "2024-07-07",
                "total_days": 7,
                "total_participants": 20,
                "total_meal_slots": 21,
                "total_assigned_meals": 18,
                "overall_completion_percentage": 85.7,
                "days": [],
                "total_unique_recipes": 15,
                "total_shopping_items": 87,
                "meal_type_distribution": {
                    "Breakfast": 7,
                    "Lunch": 6,
                    "Dinner": 5
                },
                "average_daily_nutrition": None
            }
        }
    )


class MealSlotAssignmentRequest(BaseModel):
    """Request to assign a meal to a slot."""
    recipe_id: UUID
    servings_override: Optional[int] = Field(None, ge=1)
    notes: Optional[str] = None
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "recipe_id": "550e8400-e29b-41d4-a716-446655440000",
                "servings_override": 10,
                "notes": "Extra portions for hungry hikers"
            }
        }
    )


class DayPlanUpdateRequest(BaseModel):
    """Request to update meal assignments for a day."""
    meal_assignments: Dict[str, MealSlotAssignmentRequest] = Field(
        ...,
        description="Map of meal_type to assignment request"
    )
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "meal_assignments": {
                    "Breakfast": {
                        "recipe_id": "550e8400-e29b-41d4-a716-446655440000"
                    },
                    "Lunch": {
                        "recipe_id": "550e8400-e29b-41d4-a716-446655440001",
                        "servings_override": 12
                    }
                }
            }
        }
    )
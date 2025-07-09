"""
Ingredient management schemas for admin API.

This module defines Pydantic schemas for ingredient CRUD operations,
moderation, and bulk operations.
"""

from datetime import datetime
from typing import Optional, List, Dict, Any, Literal
from uuid import UUID
from decimal import Decimal

from pydantic import BaseModel, Field, ConfigDict, field_validator, model_validator


class NutritionalData(BaseModel):
    """Nutritional information per 100g."""
    calories: float = Field(..., ge=0, description="Calories (kcal)")
    proteins: float = Field(..., ge=0, le=100, description="Proteins (g)")
    carbs: float = Field(..., ge=0, le=100, description="Carbohydrates (g)")
    fats: float = Field(..., ge=0, le=100, description="Fats (g)")
    fiber: Optional[float] = Field(None, ge=0, le=100, description="Fiber (g)")
    sodium: Optional[float] = Field(None, ge=0, description="Sodium (mg)")
    sugar: Optional[float] = Field(None, ge=0, le=100, description="Sugar (g)")
    saturated_fats: Optional[float] = Field(None, ge=0, le=100, description="Saturated fats (g)")
    cholesterol: Optional[float] = Field(None, ge=0, description="Cholesterol (mg)")
    
    # Vitamins and minerals
    vitamin_a: Optional[float] = Field(None, ge=0, description="Vitamin A (µg)")
    vitamin_c: Optional[float] = Field(None, ge=0, description="Vitamin C (mg)")
    vitamin_d: Optional[float] = Field(None, ge=0, description="Vitamin D (µg)")
    vitamin_e: Optional[float] = Field(None, ge=0, description="Vitamin E (mg)")
    vitamin_k: Optional[float] = Field(None, ge=0, description="Vitamin K (µg)")
    calcium: Optional[float] = Field(None, ge=0, description="Calcium (mg)")
    iron: Optional[float] = Field(None, ge=0, description="Iron (mg)")
    potassium: Optional[float] = Field(None, ge=0, description="Potassium (mg)")
    
    @model_validator(mode='after')
    def validate_macros(self):
        """Validate that macronutrients don't exceed 100g."""
        total = self.proteins + self.carbs + self.fats
        if total > 100.5:  # Allow 0.5g tolerance for rounding
            raise ValueError(f"Total macronutrients ({total}g) cannot exceed 100g per 100g")
        return self


class UnitConversions(BaseModel):
    """Unit conversion factors to grams."""
    ml_to_g: Optional[float] = Field(None, gt=0, description="Milliliters to grams")
    cup_to_g: Optional[float] = Field(None, gt=0, description="Cup to grams")
    tbsp_to_g: Optional[float] = Field(None, gt=0, description="Tablespoon to grams")
    tsp_to_g: Optional[float] = Field(None, gt=0, description="Teaspoon to grams")
    piece_to_g: Optional[float] = Field(None, gt=0, description="Piece to grams")
    oz_to_g: Optional[float] = Field(None, gt=0, description="Ounce to grams")
    lb_to_g: Optional[float] = Field(None, gt=0, description="Pound to grams")


class DietaryFlags(BaseModel):
    """Dietary restriction flags."""
    vegan: Optional[bool] = None
    vegetarian: Optional[bool] = None
    gluten_free: Optional[bool] = None
    dairy_free: Optional[bool] = None
    nut_free: Optional[bool] = None
    kosher: Optional[bool] = None
    halal: Optional[bool] = None
    low_sodium: Optional[bool] = None
    low_sugar: Optional[bool] = None
    keto: Optional[bool] = None
    paleo: Optional[bool] = None


class IngredientBase(BaseModel):
    """Base ingredient information."""
    name: str = Field(..., min_length=1, max_length=100)
    brand: Optional[str] = Field(None, max_length=100)
    barcode: Optional[str] = Field(None, max_length=50)
    category: Optional[str] = Field(None, max_length=50)
    
    @field_validator('name', 'brand')
    @classmethod
    def strip_whitespace(cls, v: Optional[str]) -> Optional[str]:
        return v.strip() if v else v


class IngredientCreate(IngredientBase):
    """Request to create a new ingredient."""
    nutritional_data: NutritionalData
    unit_conversions: Optional[Dict[str, float]] = Field(default_factory=dict)
    allergens: Optional[List[str]] = Field(default_factory=list)
    dietary_flags: Optional[Dict[str, bool]] = Field(default_factory=dict)
    is_global: bool = Field(True, description="Make ingredient globally available")
    image_url: Optional[str] = Field(None, description="URL to ingredient image")
    
    @field_validator('allergens')
    @classmethod
    def normalize_allergens(cls, v: List[str]) -> List[str]:
        return [a.lower().strip() for a in v if a.strip()]


class IngredientUpdate(BaseModel):
    """Request to update an ingredient."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    brand: Optional[str] = Field(None, max_length=100)
    barcode: Optional[str] = Field(None, max_length=50)
    category: Optional[str] = Field(None, max_length=50)
    nutritional_data: Optional[NutritionalData] = None
    unit_conversions: Optional[Dict[str, float]] = None
    allergens: Optional[List[str]] = None
    dietary_flags: Optional[Dict[str, bool]] = None
    image_url: Optional[str] = None
    
    @field_validator('allergens')
    @classmethod
    def normalize_allergens(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        if v is None:
            return v
        return [a.lower().strip() for a in v if a.strip()]


class IngredientResponse(IngredientBase):
    """Ingredient response with full details."""
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    nutritional_data: Dict[str, Any]
    unit_conversions: Dict[str, float]
    allergens: List[str]
    dietary_flags: Dict[str, bool]
    is_global: bool
    is_archived: bool
    user_id: Optional[UUID]
    image_url: Optional[str]
    created_at: datetime
    updated_at: datetime
    
    # Computed fields
    quality_score: Optional[int] = None
    usage_count: Optional[int] = None
    moderation_status: Optional[str] = None


class IngredientSummary(BaseModel):
    """Summary ingredient information for listings."""
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    name: str
    brand: Optional[str]
    category: Optional[str]
    is_global: bool
    is_archived: bool
    created_at: datetime
    
    # Summary nutritional info
    calories: Optional[float] = None
    proteins: Optional[float] = None
    carbs: Optional[float] = None
    fats: Optional[float] = None
    
    @model_validator(mode='after')
    def extract_nutrition(self):
        """Extract basic nutrition from nutritional_data if available."""
        if hasattr(self, 'nutritional_data') and self.nutritional_data:
            self.calories = self.nutritional_data.get('calories')
            self.proteins = self.nutritional_data.get('proteins')
            self.carbs = self.nutritional_data.get('carbs')
            self.fats = self.nutritional_data.get('fats')
        return self


class IngredientFilter(BaseModel):
    """Filters for ingredient search."""
    query: Optional[str] = Field(None, description="Search in name, brand, barcode")
    category: Optional[str] = Field(None, description="Filter by category")
    brand: Optional[str] = Field(None, description="Filter by brand")
    allergens: Optional[List[str]] = Field(None, description="Filter by allergens (any match)")
    dietary_flags: Optional[Dict[str, bool]] = Field(None, description="Filter by dietary flags")
    is_global: Optional[bool] = Field(None, description="Filter by global/user-specific")
    is_archived: Optional[bool] = Field(False, description="Include archived ingredients")
    user_id: Optional[UUID] = Field(None, description="Filter by user ID")
    has_barcode: Optional[bool] = Field(None, description="Filter by barcode presence")
    quality_score_min: Optional[int] = Field(None, ge=0, le=100, description="Minimum quality score")


class IngredientSort(BaseModel):
    """Sorting options for ingredient listing."""
    field: Literal["name", "created_at", "updated_at", "category", "brand"] = "name"
    order: Literal["asc", "desc"] = "asc"


class IngredientListResponse(BaseModel):
    """Response for ingredient listing."""
    ingredients: List[IngredientSummary]
    total: int
    page: int
    per_page: int
    pages: int
    
    # Summary statistics
    stats: Dict[str, Any] = Field(default_factory=dict)


class IngredientMergeRequest(BaseModel):
    """Request to merge two ingredients."""
    source_id: UUID = Field(..., description="Source ingredient to merge from")
    target_id: UUID = Field(..., description="Target ingredient to merge into")
    update_recipes: bool = Field(True, description="Update recipes to use target")
    
    @model_validator(mode='after')
    def validate_different_ids(self):
        if self.source_id == self.target_id:
            raise ValueError("Source and target ingredients must be different")
        return self


class IngredientBulkOperation(BaseModel):
    """Request for bulk ingredient operations."""
    ingredient_ids: List[UUID] = Field(..., min_length=1, max_length=100)
    operation: Literal["delete", "archive", "unarchive", "approve", "reject"]
    reason: Optional[str] = Field(None, description="Reason for operation")


class IngredientImportRequest(BaseModel):
    """Request for ingredient import."""
    format: Literal["csv", "json"] = "csv"
    is_global: bool = Field(True, description="Import as global ingredients")
    update_existing: bool = Field(False, description="Update existing ingredients")
    validate_only: bool = Field(False, description="Validate without importing")


class IngredientImportResult(BaseModel):
    """Result of ingredient import operation."""
    total: int
    success: int
    failed: int
    errors: List[Dict[str, Any]] = Field(default_factory=list)
    warnings: List[Dict[str, Any]] = Field(default_factory=list)


class IngredientExportRequest(BaseModel):
    """Request for ingredient export."""
    format: Literal["csv", "json"] = "csv"
    filters: Optional[IngredientFilter] = None
    include_archived: bool = False
    include_nutrition: bool = True
    include_conversions: bool = True


class IngredientQualityReport(BaseModel):
    """Ingredient quality validation report."""
    ingredient_id: UUID
    name: str
    quality_score: int = Field(..., ge=0, le=100)
    issues: List[str]
    is_complete: bool
    suggestions: List[str] = Field(default_factory=list)


class IngredientUsageStats(BaseModel):
    """Usage statistics for an ingredient."""
    ingredient_id: UUID
    name: str
    total_recipes: int
    total_users: int
    recent_usage: List[Dict[str, Any]]
    popularity_rank: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    last_used: Optional[datetime] = None


class IngredientModerationRequest(BaseModel):
    """Request to submit ingredient for moderation."""
    ingredient_id: UUID
    priority: int = Field(0, ge=0, le=10, description="Priority level (0-10)")
    notes: Optional[str] = Field(None, max_length=1000)


class IngredientModerationReview(BaseModel):
    """Review decision for moderated ingredient."""
    status: Literal["approved", "rejected", "needs_review"]
    review_notes: Optional[str] = Field(None, max_length=1000)
    rejection_reason: Optional[str] = Field(None, max_length=500)
    suggested_changes: Optional[Dict[str, Any]] = None
    make_global: bool = Field(True, description="Make ingredient global if approved")


class IngredientModerationItem(BaseModel):
    """Moderation queue item."""
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    ingredient_id: UUID
    ingredient_name: str
    ingredient_brand: Optional[str]
    submitted_by: UUID
    submitter_email: str
    submitted_at: datetime
    status: str
    priority: int
    quality_score: Optional[int]
    quality_issues: Optional[List[str]]
    auto_check_passed: bool
    auto_check_issues: Optional[List[str]]
    reviewed_by: Optional[UUID]
    reviewed_at: Optional[datetime]


class IngredientModerationQueue(BaseModel):
    """Response for moderation queue listing."""
    items: List[IngredientModerationItem]
    total: int
    page: int
    per_page: int
    pages: int
    
    # Queue statistics
    stats: Dict[str, int] = Field(
        default_factory=dict,
        description="Queue statistics (pending, approved, rejected)"
    )


class IngredientCategoryStats(BaseModel):
    """Statistics for ingredient categories."""
    category: str
    count: int
    percentage: float
    top_brands: List[str]
    average_quality_score: Optional[float]


class IngredientDashboard(BaseModel):
    """Admin dashboard data for ingredients."""
    total_ingredients: int
    global_ingredients: int
    user_ingredients: int
    archived_ingredients: int
    
    pending_moderation: int
    approved_today: int
    rejected_today: int
    
    categories: List[IngredientCategoryStats]
    recent_submissions: List[IngredientSummary]
    quality_issues: List[IngredientQualityReport]
    popular_ingredients: List[IngredientUsageStats]
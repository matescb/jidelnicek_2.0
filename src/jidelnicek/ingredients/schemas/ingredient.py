"""
Pydantic schemas for ingredient DTOs.
"""

from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime

from pydantic import BaseModel, Field, validator, ConfigDict


class NutritionalData(BaseModel):
    """Schema for nutritional data per 100g."""
    calories: float = Field(..., ge=0, description="Calories per 100g")
    proteins: float = Field(..., ge=0, description="Proteins in grams per 100g")
    carbs: float = Field(..., ge=0, description="Carbohydrates in grams per 100g")
    fats: float = Field(..., ge=0, description="Fats in grams per 100g")
    fiber: Optional[float] = Field(None, ge=0, description="Fiber in grams per 100g")
    sodium: Optional[float] = Field(None, ge=0, description="Sodium in mg per 100g")
    sugars: Optional[float] = Field(None, ge=0, description="Sugars in grams per 100g")
    saturated_fats: Optional[float] = Field(None, ge=0, description="Saturated fats in grams per 100g")
    cholesterol: Optional[float] = Field(None, ge=0, description="Cholesterol in mg per 100g")
    
    @validator('calories', 'proteins', 'carbs', 'fats')
    def validate_required_nutrients(cls, v):
        if v is None:
            raise ValueError("Required nutritional values cannot be None")
        return v
    
    @validator('sugars')
    def validate_sugars(cls, v, values):
        if v is not None and 'carbs' in values and v > values['carbs']:
            raise ValueError("Sugars cannot exceed total carbohydrates")
        return v


class UnitConversions(BaseModel):
    """Schema for unit conversion factors to grams."""
    ml_to_g: Optional[float] = Field(None, gt=0, description="Milliliters to grams conversion factor")
    cup_to_g: Optional[float] = Field(None, gt=0, description="Cups to grams conversion factor")
    tbsp_to_g: Optional[float] = Field(None, gt=0, description="Tablespoons to grams conversion factor")
    tsp_to_g: Optional[float] = Field(None, gt=0, description="Teaspoons to grams conversion factor")
    piece_to_g: Optional[float] = Field(None, gt=0, description="Pieces to grams conversion factor")
    
    @validator('ml_to_g')
    def validate_ml_conversion(cls, v):
        if v is not None and (v < 0.1 or v > 10):
            raise ValueError("ml_to_g conversion factor seems unreasonable (should be between 0.1 and 10)")
        return v


class DietaryFlags(BaseModel):
    """Schema for dietary restriction flags."""
    vegan: bool = Field(False, description="Is the ingredient vegan")
    vegetarian: bool = Field(False, description="Is the ingredient vegetarian")
    gluten_free: bool = Field(False, description="Is the ingredient gluten-free")
    dairy_free: bool = Field(False, description="Is the ingredient dairy-free")
    nut_free: bool = Field(False, description="Is the ingredient nut-free")
    egg_free: bool = Field(False, description="Is the ingredient egg-free")
    soy_free: bool = Field(False, description="Is the ingredient soy-free")
    kosher: bool = Field(False, description="Is the ingredient kosher")
    halal: bool = Field(False, description="Is the ingredient halal")
    
    @validator('vegetarian')
    def validate_vegetarian(cls, v, values):
        if 'vegan' in values and values['vegan'] and not v:
            raise ValueError("Vegan ingredients must also be vegetarian")
        return v


class IngredientBase(BaseModel):
    """Base schema for ingredients."""
    name: str = Field(..., min_length=1, max_length=100, description="Ingredient name")
    brand: Optional[str] = Field(None, max_length=100, description="Brand name")
    barcode: Optional[str] = Field(None, max_length=50, description="Barcode (EAN/UPC)")
    category: Optional[str] = Field(None, max_length=50, description="Ingredient category")
    image_url: Optional[str] = Field(None, max_length=500, description="URL to ingredient image")
    
    @validator('name')
    def validate_name(cls, v):
        if not v.strip():
            raise ValueError("Ingredient name cannot be empty")
        return v.strip()


class IngredientCreate(IngredientBase):
    """Schema for creating ingredients."""
    nutritional_data: NutritionalData = Field(..., description="Nutritional data per 100g")
    unit_conversions: Optional[UnitConversions] = Field(None, description="Unit conversion factors")
    dietary_flags: Optional[DietaryFlags] = Field(None, description="Dietary restriction flags")
    allergens: Optional[List[str]] = Field(default_factory=list, description="List of allergens")
    is_global: bool = Field(False, description="Is this a global ingredient (available to all users)")


class IngredientUpdate(BaseModel):
    """Schema for updating ingredients."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    brand: Optional[str] = Field(None, max_length=100)
    barcode: Optional[str] = Field(None, max_length=50)
    category: Optional[str] = Field(None, max_length=50)
    image_url: Optional[str] = Field(None, max_length=500)
    nutritional_data: Optional[NutritionalData] = None
    unit_conversions: Optional[UnitConversions] = None
    dietary_flags: Optional[DietaryFlags] = None
    allergens: Optional[List[str]] = None
    
    @validator('name')
    def validate_name(cls, v):
        if v is not None and not v.strip():
            raise ValueError("Ingredient name cannot be empty")
        return v.strip() if v else v


class IngredientResponse(IngredientBase):
    """Schema for ingredient responses."""
    id: UUID
    user_id: Optional[UUID]
    nutritional_data: Dict[str, Any]
    unit_conversions: Dict[str, Any]
    dietary_flags: Dict[str, Any]
    allergens: List[str]
    is_global: bool
    is_archived: bool
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class IngredientListItem(BaseModel):
    """Schema for ingredient list items."""
    id: UUID
    name: str
    brand: Optional[str]
    category: Optional[str]
    barcode: Optional[str]
    has_nutritional_data: bool
    dietary_flags: Dict[str, Any]
    allergens: List[str]
    is_global: bool
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class IngredientListResponse(BaseModel):
    """Schema for paginated ingredient list responses."""
    items: List[IngredientListItem]
    total: int
    page: int
    page_size: int
    total_pages: int
    has_next: bool
    has_prev: bool


class IngredientFilter(BaseModel):
    """Schema for ingredient search filters."""
    query: Optional[str] = Field(None, description="Search query for name or brand")
    category: Optional[str] = Field(None, description="Filter by category")
    brand: Optional[str] = Field(None, description="Filter by brand")
    has_barcode: Optional[bool] = Field(None, description="Filter by barcode presence")
    vegan: Optional[bool] = Field(None, description="Filter by vegan status")
    vegetarian: Optional[bool] = Field(None, description="Filter by vegetarian status")
    gluten_free: Optional[bool] = Field(None, description="Filter by gluten-free status")
    dairy_free: Optional[bool] = Field(None, description="Filter by dairy-free status")
    allergen: Optional[str] = Field(None, description="Filter by specific allergen")
    has_nutritional_data: Optional[bool] = Field(None, description="Filter by nutritional data presence")
    is_global: Optional[bool] = Field(None, description="Filter by global/user-specific status")
    is_archived: Optional[bool] = Field(False, description="Include archived ingredients")
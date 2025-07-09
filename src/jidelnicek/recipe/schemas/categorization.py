"""
Categorization schemas for Jidelnicek 2.0 recipe system.

This module contains all Pydantic models for category and tag management,
including hierarchical categories and flexible tagging system.
"""

from datetime import datetime
from typing import Optional, List, TYPE_CHECKING
from uuid import UUID
import re
from pydantic import BaseModel, Field, field_validator, model_validator, ConfigDict

if TYPE_CHECKING:
    from jidelnicek.recipe.schemas import RecipeResponse


def generate_slug(name: str) -> str:
    """Generate URL-safe slug from name."""
    # Convert to lowercase
    slug = name.lower()
    # Replace spaces and special characters with hyphens
    slug = re.sub(r'[^\w\s-]', '', slug)
    slug = re.sub(r'[-\s]+', '-', slug)
    # Remove leading/trailing hyphens
    slug = slug.strip('-')
    return slug


class CategoryBase(BaseModel):
    """Base schema for categories."""
    
    name: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Category name (1-100 characters)"
    )
    slug: Optional[str] = Field(
        None,
        min_length=1,
        max_length=100,
        pattern=r'^[a-z0-9-]+$',
        description="URL-safe slug (auto-generated if not provided)"
    )
    description: Optional[str] = Field(
        None,
        max_length=500,
        description="Category description (max 500 characters)"
    )
    icon: Optional[str] = Field(
        None,
        max_length=50,
        description="Icon identifier for UI display"
    )
    parent_id: Optional[UUID] = Field(
        None,
        description="Parent category ID for hierarchical structure"
    )
    display_order: int = Field(
        default=0,
        ge=0,
        description="Order for displaying categories in UI"
    )
    
    @field_validator('name')
    @classmethod
    def validate_name(cls, v: str) -> str:
        """Validate and normalize category name."""
        v = v.strip()
        if not v:
            raise ValueError("Category name cannot be empty")
        return v
    
    @field_validator('slug')
    @classmethod
    def validate_slug(cls, v: Optional[str]) -> Optional[str]:
        """Validate slug format if provided."""
        if v is not None:
            v = v.strip()
            if not v:
                return None
            if not re.match(r'^[a-z0-9-]+$', v):
                raise ValueError("Slug must contain only lowercase letters, numbers, and hyphens")
        return v
    
    @field_validator('description')
    @classmethod
    def strip_description(cls, v: Optional[str]) -> Optional[str]:
        """Strip whitespace from description."""
        return v.strip() if v else None


class CategoryCreate(CategoryBase):
    """Schema for creating categories."""
    
    @model_validator(mode='after')
    def generate_slug_if_needed(self) -> 'CategoryCreate':
        """Generate slug from name if not provided."""
        if not self.slug:
            self.slug = generate_slug(self.name)
        return self


class CategoryUpdate(BaseModel):
    """Schema for updating categories."""
    
    name: Optional[str] = Field(
        None,
        min_length=1,
        max_length=100,
        description="Category name"
    )
    slug: Optional[str] = Field(
        None,
        min_length=1,
        max_length=100,
        pattern=r'^[a-z0-9-]+$',
        description="URL-safe slug"
    )
    description: Optional[str] = Field(
        None,
        max_length=500,
        description="Category description"
    )
    icon: Optional[str] = Field(
        None,
        max_length=50,
        description="Icon identifier"
    )
    parent_id: Optional[UUID] = Field(
        None,
        description="Parent category ID (set to null to make root category)"
    )
    display_order: Optional[int] = Field(
        None,
        ge=0,
        description="Display order"
    )
    
    model_config = ConfigDict(extra='forbid')
    
    @field_validator('name')
    @classmethod
    def validate_name_if_provided(cls, v: Optional[str]) -> Optional[str]:
        """Validate name if provided."""
        if v is not None:
            v = v.strip()
            if not v:
                raise ValueError("Category name cannot be empty")
        return v
    
    @field_validator('slug')
    @classmethod
    def validate_slug_if_provided(cls, v: Optional[str]) -> Optional[str]:
        """Validate slug if provided."""
        if v is not None:
            v = v.strip()
            if not v:
                raise ValueError("Slug cannot be empty")
            if not re.match(r'^[a-z0-9-]+$', v):
                raise ValueError("Slug must contain only lowercase letters, numbers, and hyphens")
        return v
    
    @field_validator('description')
    @classmethod
    def strip_description(cls, v: Optional[str]) -> Optional[str]:
        """Strip whitespace from description."""
        return v.strip() if v else None


class CategoryInDB(CategoryBase):
    """Schema for category database representation."""
    
    id: UUID
    recipe_count: int = Field(
        default=0,
        description="Number of recipes in this category"
    )
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class TagBase(BaseModel):
    """Base schema for tags."""
    
    name: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Tag name (1-100 characters)"
    )
    slug: Optional[str] = Field(
        None,
        min_length=1,
        max_length=100,
        pattern=r'^[a-z0-9-]+$',
        description="URL-safe slug (auto-generated if not provided)"
    )
    
    @field_validator('name')
    @classmethod
    def validate_name(cls, v: str) -> str:
        """Validate and normalize tag name."""
        v = v.strip()
        if not v:
            raise ValueError("Tag name cannot be empty")
        # Lowercase for case-insensitive comparison
        return v.lower()
    
    @field_validator('slug')
    @classmethod
    def validate_slug(cls, v: Optional[str]) -> Optional[str]:
        """Validate slug format if provided."""
        if v is not None:
            v = v.strip()
            if not v:
                return None
            if not re.match(r'^[a-z0-9-]+$', v):
                raise ValueError("Slug must contain only lowercase letters, numbers, and hyphens")
        return v


class TagCreate(TagBase):
    """Schema for creating tags."""
    
    @model_validator(mode='after')
    def generate_slug_if_needed(self) -> 'TagCreate':
        """Generate slug from name if not provided."""
        if not self.slug:
            self.slug = generate_slug(self.name)
        return self


class TagUpdate(BaseModel):
    """Schema for updating tags."""
    
    name: Optional[str] = Field(
        None,
        min_length=1,
        max_length=100,
        description="Tag name"
    )
    slug: Optional[str] = Field(
        None,
        min_length=1,
        max_length=100,
        pattern=r'^[a-z0-9-]+$',
        description="URL-safe slug"
    )
    
    model_config = ConfigDict(extra='forbid')
    
    @field_validator('name')
    @classmethod
    def validate_name_if_provided(cls, v: Optional[str]) -> Optional[str]:
        """Validate name if provided."""
        if v is not None:
            v = v.strip().lower()
            if not v:
                raise ValueError("Tag name cannot be empty")
        return v
    
    @field_validator('slug')
    @classmethod
    def validate_slug_if_provided(cls, v: Optional[str]) -> Optional[str]:
        """Validate slug if provided."""
        if v is not None:
            v = v.strip()
            if not v:
                raise ValueError("Slug cannot be empty")
            if not re.match(r'^[a-z0-9-]+$', v):
                raise ValueError("Slug must contain only lowercase letters, numbers, and hyphens")
        return v


class TagInDB(TagBase):
    """Schema for tag database representation."""
    
    id: UUID
    usage_count: int = Field(
        default=0,
        description="Number of recipes using this tag"
    )
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class RecipeCategoryAssignment(BaseModel):
    """Schema for assigning a recipe to a category."""
    
    category_id: UUID = Field(
        ...,
        description="ID of the category to assign"
    )


class RecipeTagAssignment(BaseModel):
    """Schema for assigning tags to a recipe."""
    
    tag_names: List[str] = Field(
        ...,
        min_length=1,
        max_length=20,
        description="List of tag names to assign (1-20 tags)"
    )
    
    @field_validator('tag_names')
    @classmethod
    def validate_tag_names(cls, v: List[str]) -> List[str]:
        """Validate and normalize tag names."""
        # Remove duplicates and normalize
        normalized = []
        seen = set()
        
        for tag in v:
            tag = tag.strip().lower()
            if not tag:
                continue
            if len(tag) > 100:
                raise ValueError(f"Tag name '{tag[:50]}...' exceeds 100 characters")
            if tag not in seen:
                normalized.append(tag)
                seen.add(tag)
        
        if not normalized:
            raise ValueError("At least one valid tag name is required")
        
        if len(normalized) > 20:
            raise ValueError("Maximum 20 tags allowed per recipe")
        
        return normalized


class CategoryTree(CategoryInDB):
    """Schema for hierarchical category display."""
    
    children: List['CategoryTree'] = Field(
        default=[],
        description="Child categories"
    )
    depth: int = Field(
        default=0,
        description="Depth in the category tree"
    )
    path: List[str] = Field(
        default=[],
        description="Path from root to this category (names)"
    )
    
    model_config = ConfigDict(from_attributes=True)


class TagWithCount(TagInDB):
    """Schema for tag with usage statistics."""
    
    recent_usage_count: int = Field(
        default=0,
        description="Usage count in the last 30 days"
    )
    trend: str = Field(
        default="stable",
        pattern=r'^(rising|stable|falling)$',
        description="Usage trend indicator"
    )
    
    model_config = ConfigDict(from_attributes=True)


class CategoryWithRecipes(CategoryInDB):
    """Schema for category with recipe list."""
    
    recipes: List[dict] = Field(
        default=[],
        description="Recipes in this category (RecipeResponse objects)"
    )
    total_recipes: int = Field(
        default=0,
        description="Total number of recipes (for pagination)"
    )
    
    model_config = ConfigDict(from_attributes=True)


class TagCloud(BaseModel):
    """Schema for tag cloud display."""
    
    tags: List[TagWithCount] = Field(
        ...,
        description="List of tags with usage counts"
    )
    min_count: int = Field(
        ...,
        ge=0,
        description="Minimum usage count in the set"
    )
    max_count: int = Field(
        ...,
        ge=0,
        description="Maximum usage count in the set"
    )
    total_tags: int = Field(
        ...,
        ge=0,
        description="Total number of unique tags"
    )


class RecipeCategorization(BaseModel):
    """Schema for complete recipe categorization info."""
    
    recipe_id: UUID
    category: Optional[CategoryInDB] = Field(
        None,
        description="Assigned category (if any)"
    )
    tags: List[TagInDB] = Field(
        default=[],
        description="Assigned tags"
    )
    suggested_categories: List[CategoryInDB] = Field(
        default=[],
        description="AI-suggested categories based on content"
    )
    suggested_tags: List[str] = Field(
        default=[],
        description="AI-suggested tags based on content"
    )
    
    model_config = ConfigDict(from_attributes=True)


# Update forward references after all definitions
CategoryTree.model_rebuild()
# CategoryWithRecipes needs RecipeResponse which may not be available during import
# So we'll let the router handle the rebuild when it imports both schemas
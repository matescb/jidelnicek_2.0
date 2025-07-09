"""
Recipe version model for Jidelnicek 2.0.

This module defines the RecipeVersion model for tracking changes to recipes
with support for different change types and comprehensive change data storage.
"""

from datetime import datetime
from typing import Optional, List, Dict, Any, TYPE_CHECKING
from uuid import UUID
from decimal import Decimal
import json

from sqlalchemy import (
    Boolean, Column, DateTime, String, Integer, ForeignKey, 
    CheckConstraint, UniqueConstraint, text, Index, Text, Numeric, JSON
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship, Mapped, mapped_column, validates
from sqlalchemy.ext.hybrid import hybrid_property

from jidelnicek.core.database import Base
from jidelnicek.core.utils import get_utc_now

if TYPE_CHECKING:
    from .recipe import Recipe


class RecipeVersion(Base):
    """
    Recipe version model for tracking recipe changes.
    
    Features:
    - Version tracking with sequential numbering
    - Change type categorization
    - JSON storage for change data
    - User tracking for changes
    - Timestamp tracking
    - Methods for version creation and history retrieval
    """
    __tablename__ = "recipe_versions"
    
    # Primary key
    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), 
        primary_key=True, 
        server_default=text("gen_random_uuid()")
    )
    
    # Recipe relationship
    recipe_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("recipe_recipes.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    # Version information
    version_number: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="Sequential version number starting from 1"
    )
    
    # Change type categorization
    change_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
        comment="Type of change: ingredient_change, title_change, instructions_change, nutritional_change, minor_change"
    )
    
    # Change data as JSON
    change_data: Mapped[dict] = mapped_column(
        JSON,
        nullable=False,
        default={},
        comment="Detailed change information including before/after values"
    )
    
    # User who made the change
    changed_by: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("auth_users.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    
    # Timestamp
    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=text('now()'),
        nullable=False,
        index=True
    )
    
    # Additional metadata
    description: Mapped[Optional[str]] = mapped_column(
        Text,
        comment="Optional description of the change"
    )
    
    # Relationships
    recipe: Mapped["Recipe"] = relationship(
        "Recipe",
        back_populates="versions"
    )
    
    user = relationship(
        "jidelnicek.auth.models.AuthUser",
        foreign_keys=[changed_by]
    )
    
    # Table constraints
    __table_args__ = (
        CheckConstraint('version_number > 0', name='recipe_versions_version_number_check'),
        CheckConstraint(
            "change_type IN ('ingredient_change', 'title_change', 'instructions_change', 'nutritional_change', 'minor_change')", 
            name='recipe_versions_change_type_check'
        ),
        UniqueConstraint('recipe_id', 'version_number', name='recipe_versions_recipe_version_unique'),
        Index('idx_recipe_versions_recipe_changed_at', 'recipe_id', 'changed_at'),
    )
    
    # Change type constants
    INGREDIENT_CHANGE = "ingredient_change"
    TITLE_CHANGE = "title_change"
    INSTRUCTIONS_CHANGE = "instructions_change"
    NUTRITIONAL_CHANGE = "nutritional_change"
    MINOR_CHANGE = "minor_change"
    
    @validates('change_type')
    def validate_change_type(self, key, change_type):
        """Validate change type is allowed."""
        allowed_types = [
            self.INGREDIENT_CHANGE,
            self.TITLE_CHANGE,
            self.INSTRUCTIONS_CHANGE,
            self.NUTRITIONAL_CHANGE,
            self.MINOR_CHANGE
        ]
        if change_type not in allowed_types:
            raise ValueError(f"Change type must be one of: {', '.join(allowed_types)}")
        return change_type
    
    @validates('version_number')
    def validate_version_number(self, key, version_number):
        """Validate version number is positive."""
        if version_number <= 0:
            raise ValueError("Version number must be greater than 0")
        return version_number
    
    @classmethod
    def create_version_from_recipe_changes(
        cls, 
        recipe: "Recipe", 
        old_data: Dict[str, Any], 
        new_data: Dict[str, Any], 
        user_id: Optional[UUID] = None,
        description: Optional[str] = None
    ) -> Optional["RecipeVersion"]:
        """
        Create a new version from recipe changes.
        
        Args:
            recipe: The recipe that was changed
            old_data: Dictionary containing old values
            new_data: Dictionary containing new values
            user_id: ID of user who made the change
            description: Optional description of the change
            
        Returns:
            RecipeVersion instance if significant changes detected, None otherwise
        """
        # Determine change type and build change data
        change_type, change_data = cls._analyze_changes(old_data, new_data)
        
        # Skip version creation if no significant changes
        if change_type is None:
            return None
        
        # Get next version number
        from sqlalchemy import func
        from jidelnicek.core.database import SessionLocal
        
        with SessionLocal() as session:
            last_version = session.query(func.max(cls.version_number)).filter(
                cls.recipe_id == recipe.id
            ).scalar()
            
            next_version = (last_version or 0) + 1
        
        # Create new version
        version = cls(
            recipe_id=recipe.id,
            version_number=next_version,
            change_type=change_type,
            change_data=change_data,
            changed_by=user_id,
            description=description
        )
        
        return version
    
    @classmethod
    def _analyze_changes(cls, old_data: Dict[str, Any], new_data: Dict[str, Any]) -> tuple[Optional[str], Dict[str, Any]]:
        """
        Analyze changes between old and new data to determine change type.
        
        Args:
            old_data: Dictionary containing old values
            new_data: Dictionary containing new values
            
        Returns:
            Tuple of (change_type, change_data) or (None, {}) if no significant changes
        """
        change_data = {
            "before": {},
            "after": {},
            "changes": []
        }
        
        significant_changes = []
        
        # Check for ingredient changes
        if "ingredients" in old_data and "ingredients" in new_data:
            ingredient_changes = cls._analyze_ingredient_changes(
                old_data["ingredients"], 
                new_data["ingredients"]
            )
            if ingredient_changes:
                significant_changes.append(cls.INGREDIENT_CHANGE)
                change_data["ingredient_changes"] = ingredient_changes
        
        # Check for title/name changes
        if old_data.get("name") != new_data.get("name"):
            significant_changes.append(cls.TITLE_CHANGE)
            change_data["before"]["name"] = old_data.get("name")
            change_data["after"]["name"] = new_data.get("name")
            change_data["changes"].append("Title changed")
        
        # Check for description changes
        if old_data.get("description") != new_data.get("description"):
            change_data["before"]["description"] = old_data.get("description")
            change_data["after"]["description"] = new_data.get("description")
            change_data["changes"].append("Description changed")
        
        # Check for instructions changes
        if old_data.get("instructions") != new_data.get("instructions"):
            significant_changes.append(cls.INSTRUCTIONS_CHANGE)
            change_data["before"]["instructions"] = old_data.get("instructions")
            change_data["after"]["instructions"] = new_data.get("instructions")
            change_data["changes"].append("Instructions changed")
        
        # Check for nutritional changes > 1%
        nutritional_changes = cls._analyze_nutritional_changes(old_data, new_data)
        if nutritional_changes:
            significant_changes.append(cls.NUTRITIONAL_CHANGE)
            change_data["nutritional_changes"] = nutritional_changes
        
        # Check for other significant changes
        other_changes = cls._analyze_other_changes(old_data, new_data)
        if other_changes:
            change_data.update(other_changes)
            change_data["changes"].extend(other_changes.get("changes", []))
        
        # Determine primary change type
        if cls.INGREDIENT_CHANGE in significant_changes:
            change_type = cls.INGREDIENT_CHANGE
        elif cls.INSTRUCTIONS_CHANGE in significant_changes:
            change_type = cls.INSTRUCTIONS_CHANGE
        elif cls.TITLE_CHANGE in significant_changes:
            change_type = cls.TITLE_CHANGE
        elif cls.NUTRITIONAL_CHANGE in significant_changes:
            change_type = cls.NUTRITIONAL_CHANGE
        elif change_data["changes"]:
            change_type = cls.MINOR_CHANGE
        else:
            return None, {}
        
        return change_type, change_data
    
    @classmethod
    def _analyze_ingredient_changes(cls, old_ingredients: List[Dict], new_ingredients: List[Dict]) -> Optional[Dict]:
        """Analyze changes in ingredients."""
        changes = {
            "added": [],
            "removed": [],
            "modified": []
        }
        
        # Convert to dicts for easier comparison
        old_by_id = {ing.get("id") or ing.get("ingredient_id"): ing for ing in old_ingredients}
        new_by_id = {ing.get("id") or ing.get("ingredient_id"): ing for ing in new_ingredients}
        
        # Find added ingredients
        for ing_id, ingredient in new_by_id.items():
            if ing_id not in old_by_id:
                changes["added"].append({
                    "name": ingredient.get("name"),
                    "quantity": ingredient.get("quantity"),
                    "unit": ingredient.get("unit")
                })
        
        # Find removed ingredients
        for ing_id, ingredient in old_by_id.items():
            if ing_id not in new_by_id:
                changes["removed"].append({
                    "name": ingredient.get("name"),
                    "quantity": ingredient.get("quantity"),
                    "unit": ingredient.get("unit")
                })
        
        # Find modified ingredients
        for ing_id in old_by_id:
            if ing_id in new_by_id:
                old_ing = old_by_id[ing_id]
                new_ing = new_by_id[ing_id]
                
                # Check for quantity changes
                if old_ing.get("quantity") != new_ing.get("quantity"):
                    changes["modified"].append({
                        "name": old_ing.get("name"),
                        "field": "quantity",
                        "old_value": old_ing.get("quantity"),
                        "new_value": new_ing.get("quantity")
                    })
                
                # Check for unit changes
                if old_ing.get("unit") != new_ing.get("unit"):
                    changes["modified"].append({
                        "name": old_ing.get("name"),
                        "field": "unit",
                        "old_value": old_ing.get("unit"),
                        "new_value": new_ing.get("unit")
                    })
        
        # Return changes if any significant changes found
        if changes["added"] or changes["removed"] or changes["modified"]:
            return changes
        
        return None
    
    @classmethod
    def _analyze_nutritional_changes(cls, old_data: Dict, new_data: Dict) -> Optional[Dict]:
        """Analyze changes in nutritional values > 1%."""
        changes = {}
        
        # Check for changes in nutritional fields
        nutritional_fields = ["calories", "proteins", "carbs", "fats", "fiber", "sodium"]
        
        for field in nutritional_fields:
            old_value = old_data.get(field)
            new_value = new_data.get(field)
            
            if old_value is not None and new_value is not None:
                try:
                    old_val = float(old_value)
                    new_val = float(new_value)
                    
                    # Calculate percentage change
                    if old_val > 0:
                        percent_change = abs((new_val - old_val) / old_val) * 100
                        
                        # Track changes > 1%
                        if percent_change > 1.0:
                            changes[field] = {
                                "old_value": old_val,
                                "new_value": new_val,
                                "percent_change": round(percent_change, 2)
                            }
                except (ValueError, TypeError):
                    continue
        
        return changes if changes else None
    
    @classmethod
    def _analyze_other_changes(cls, old_data: Dict, new_data: Dict) -> Dict:
        """Analyze other potentially significant changes."""
        changes = {"changes": []}
        
        # Check for servings changes
        if old_data.get("servings") != new_data.get("servings"):
            changes["before_servings"] = old_data.get("servings")
            changes["after_servings"] = new_data.get("servings")
            changes["changes"].append("Servings changed")
        
        # Check for time changes
        if old_data.get("prep_time_minutes") != new_data.get("prep_time_minutes"):
            changes["before_prep_time"] = old_data.get("prep_time_minutes")
            changes["after_prep_time"] = new_data.get("prep_time_minutes")
            changes["changes"].append("Prep time changed")
        
        if old_data.get("cook_time_minutes") != new_data.get("cook_time_minutes"):
            changes["before_cook_time"] = old_data.get("cook_time_minutes")
            changes["after_cook_time"] = new_data.get("cook_time_minutes")
            changes["changes"].append("Cook time changed")
        
        # Check for difficulty changes
        if old_data.get("difficulty_level") != new_data.get("difficulty_level"):
            changes["before_difficulty"] = old_data.get("difficulty_level")
            changes["after_difficulty"] = new_data.get("difficulty_level")
            changes["changes"].append("Difficulty level changed")
        
        return changes
    
    @classmethod
    def get_version_history(cls, recipe_id: UUID, limit: int = 50) -> List["RecipeVersion"]:
        """
        Get version history for a recipe.
        
        Args:
            recipe_id: The recipe ID
            limit: Maximum number of versions to return
            
        Returns:
            List of RecipeVersion instances, newest first
        """
        from jidelnicek.core.database import SessionLocal
        
        with SessionLocal() as session:
            versions = session.query(cls).filter(
                cls.recipe_id == recipe_id
            ).order_by(
                cls.version_number.desc()
            ).limit(limit).all()
            
            return versions
    
    @classmethod
    def get_latest_version(cls, recipe_id: UUID) -> Optional["RecipeVersion"]:
        """
        Get the latest version for a recipe.
        
        Args:
            recipe_id: The recipe ID
            
        Returns:
            Latest RecipeVersion instance or None if no versions exist
        """
        from jidelnicek.core.database import SessionLocal
        
        with SessionLocal() as session:
            version = session.query(cls).filter(
                cls.recipe_id == recipe_id
            ).order_by(
                cls.version_number.desc()
            ).first()
            
            return version
    
    def format_display(self) -> Dict[str, Any]:
        """Format version for display."""
        return {
            "id": str(self.id),
            "version_number": self.version_number,
            "change_type": self.change_type,
            "change_data": self.change_data,
            "changed_by": str(self.changed_by) if self.changed_by else None,
            "changed_at": self.changed_at.isoformat(),
            "description": self.description
        }
    
    def get_change_summary(self) -> str:
        """Get a human-readable summary of changes."""
        if self.change_type == self.INGREDIENT_CHANGE:
            changes = self.change_data.get("ingredient_changes", {})
            summary_parts = []
            
            if changes.get("added"):
                summary_parts.append(f"Added {len(changes['added'])} ingredient(s)")
            if changes.get("removed"):
                summary_parts.append(f"Removed {len(changes['removed'])} ingredient(s)")
            if changes.get("modified"):
                summary_parts.append(f"Modified {len(changes['modified'])} ingredient(s)")
            
            return ", ".join(summary_parts) if summary_parts else "Ingredient changes"
        
        elif self.change_type == self.TITLE_CHANGE:
            return "Title changed"
        
        elif self.change_type == self.INSTRUCTIONS_CHANGE:
            return "Instructions changed"
        
        elif self.change_type == self.NUTRITIONAL_CHANGE:
            changes = self.change_data.get("nutritional_changes", {})
            changed_fields = list(changes.keys())
            return f"Nutritional changes: {', '.join(changed_fields)}"
        
        elif self.change_type == self.MINOR_CHANGE:
            changes = self.change_data.get("changes", [])
            return ", ".join(changes) if changes else "Minor changes"
        
        return "Unknown change"
    
    def __repr__(self):
        return f"<RecipeVersion(id={self.id}, recipe_id={self.recipe_id}, version={self.version_number}, type={self.change_type})>"
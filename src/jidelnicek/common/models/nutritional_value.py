"""
NutritionalValue model for storing nutritional information.
"""

from typing import Optional, List, TYPE_CHECKING
from uuid import UUID
from decimal import Decimal

from sqlalchemy import text, Numeric
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship, Mapped, mapped_column, validates

from jidelnicek.core.database import Base

if TYPE_CHECKING:
    from .ingredient import Ingredient
    from .snack import Snack


class NutritionalValue(Base):
    """
    Nutritional value model storing comprehensive nutritional data per 100g.
    
    Features:
    - Required macronutrients (calories, proteins, carbs, fats)
    - Optional detailed nutrient breakdown
    - Vitamin and mineral tracking
    - Special dietary tracking (PKU with phe_mg)
    """
    __tablename__ = "common_nutritional_values"
    
    # Primary key
    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), 
        primary_key=True, 
        server_default=text("gen_random_uuid()")
    )
    
    # Required macronutrients (per 100g)
    calories: Mapped[Decimal] = mapped_column(
        Numeric(precision=10, scale=2),
        nullable=False
    )
    proteins_g: Mapped[Decimal] = mapped_column(
        Numeric(precision=10, scale=2),
        nullable=False
    )
    carbohydrates_g: Mapped[Decimal] = mapped_column(
        Numeric(precision=10, scale=2),
        nullable=False
    )
    fats_g: Mapped[Decimal] = mapped_column(
        Numeric(precision=10, scale=2),
        nullable=False
    )
    
    # Optional detailed nutrients
    sugars_g: Mapped[Optional[Decimal]] = mapped_column(Numeric(precision=10, scale=2))
    saturated_fats_g: Mapped[Optional[Decimal]] = mapped_column(Numeric(precision=10, scale=2))
    trans_fats_g: Mapped[Optional[Decimal]] = mapped_column(Numeric(precision=10, scale=2))
    monounsaturated_fats_g: Mapped[Optional[Decimal]] = mapped_column(Numeric(precision=10, scale=2))
    polyunsaturated_fats_g: Mapped[Optional[Decimal]] = mapped_column(Numeric(precision=10, scale=2))
    cholesterol_mg: Mapped[Optional[Decimal]] = mapped_column(Numeric(precision=10, scale=2))
    fiber_g: Mapped[Optional[Decimal]] = mapped_column(Numeric(precision=10, scale=2))
    salt_g: Mapped[Optional[Decimal]] = mapped_column(Numeric(precision=10, scale=2))
    calcium_mg: Mapped[Optional[Decimal]] = mapped_column(Numeric(precision=10, scale=2))
    sodium_mg: Mapped[Optional[Decimal]] = mapped_column(Numeric(precision=10, scale=2))
    water_g: Mapped[Optional[Decimal]] = mapped_column(Numeric(precision=10, scale=2))
    phe_mg: Mapped[Optional[Decimal]] = mapped_column(Numeric(precision=10, scale=2))  # For PKU
    
    # Vitamins (all optional)
    vitamin_a_ug: Mapped[Optional[Decimal]] = mapped_column(Numeric(precision=10, scale=2))
    vitamin_b1_mg: Mapped[Optional[Decimal]] = mapped_column(Numeric(precision=10, scale=2))
    vitamin_b2_mg: Mapped[Optional[Decimal]] = mapped_column(Numeric(precision=10, scale=2))
    vitamin_b3_mg: Mapped[Optional[Decimal]] = mapped_column(Numeric(precision=10, scale=2))
    vitamin_b5_mg: Mapped[Optional[Decimal]] = mapped_column(Numeric(precision=10, scale=2))
    vitamin_b6_mg: Mapped[Optional[Decimal]] = mapped_column(Numeric(precision=10, scale=2))
    vitamin_b7_ug: Mapped[Optional[Decimal]] = mapped_column(Numeric(precision=10, scale=2))
    vitamin_b9_ug: Mapped[Optional[Decimal]] = mapped_column(Numeric(precision=10, scale=2))
    vitamin_b12_ug: Mapped[Optional[Decimal]] = mapped_column(Numeric(precision=10, scale=2))
    vitamin_c_mg: Mapped[Optional[Decimal]] = mapped_column(Numeric(precision=10, scale=2))
    vitamin_d_ug: Mapped[Optional[Decimal]] = mapped_column(Numeric(precision=10, scale=2))
    vitamin_e_mg: Mapped[Optional[Decimal]] = mapped_column(Numeric(precision=10, scale=2))
    vitamin_k_ug: Mapped[Optional[Decimal]] = mapped_column(Numeric(precision=10, scale=2))
    
    # Relationships
    ingredients: Mapped[List["Ingredient"]] = relationship(
        "Ingredient",
        back_populates="nutritional_value",
        cascade="all, delete-orphan"
    )
    
    snacks: Mapped[List["Snack"]] = relationship(
        "Snack",
        back_populates="nutritional_value",
        cascade="all, delete-orphan"
    )
    
    @validates('calories', 'proteins_g', 'carbohydrates_g', 'fats_g')
    def validate_required_nutrients(self, key, value):
        """Validate required nutrients are non-negative."""
        if value < 0:
            raise ValueError(f"{key} cannot be negative")
        return value
    
    def __repr__(self):
        return f"<NutritionalValue(id={self.id}, calories={self.calories})>"
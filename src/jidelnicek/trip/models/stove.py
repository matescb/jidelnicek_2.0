"""
Trip stove model.

This module defines the TripStove model for managing stove configurations in trips.
"""

from datetime import datetime
from typing import Optional, TYPE_CHECKING
from uuid import UUID
from decimal import Decimal

from sqlalchemy import (
    Column, DateTime, String, Text, ForeignKey, 
    CheckConstraint, UniqueConstraint, text, Numeric
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship, Mapped, mapped_column, validates

from jidelnicek.core.database import Base
from jidelnicek.core.utils import get_utc_now

if TYPE_CHECKING:
    from .trip import Trip


# Stove types and their compatible fuel types
STOVE_TYPES = {
    "gas_canister": ["isobutane", "butane_propane"],
    "liquid_fuel": ["white_gas", "kerosene", "unleaded"],
    "alcohol": ["ethanol", "methanol"],
    "wood": ["wood"],
    "solid_fuel": ["esbit", "hexamine"]
}

# Fuel consumption rates (g/ml of water)
FUEL_CONSUMPTION_RATES = {
    "isobutane": 0.1,        # 10g per 100ml water
    "butane_propane": 0.11,  # 11g per 100ml water
    "white_gas": 0.08,       # 8g per 100ml water
    "kerosene": 0.09,        # 9g per 100ml water
    "unleaded": 0.09,        # 9g per 100ml water
    "ethanol": 0.15,         # 15g per 100ml water
    "methanol": 0.13,        # 13g per 100ml water
    "wood": 0.2,             # 20g per 100ml water (estimate)
    "esbit": 0.14,           # 14g per 100ml water
    "hexamine": 0.14         # 14g per 100ml water
}


class TripStove(Base):
    """
    Trip stove model.
    
    Represents stove configuration for a trip including fuel calculations.
    """
    __tablename__ = "trip_stoves"
    
    # Primary key
    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), 
        primary_key=True, 
        server_default=text("gen_random_uuid()")
    )
    
    # Foreign keys
    trip_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("trip_trips.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,  # One stove per trip
        index=True
    )
    
    # Stove details
    stove_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False
    )
    
    fuel_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False
    )
    
    efficiency_percentage: Mapped[Decimal] = mapped_column(
        Numeric(5, 2),
        nullable=False,
        server_default=text("75.00"),
        comment="Stove efficiency percentage (1-100)"
    )
    
    notes: Mapped[Optional[str]] = mapped_column(Text)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=text('now()'),
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=text('now()'),
        onupdate=get_utc_now,
        nullable=False
    )
    
    # Relationships
    trip: Mapped["Trip"] = relationship(
        "Trip",
        back_populates="stove",
        lazy="select"
    )
    
    # Table constraints
    __table_args__ = (
        CheckConstraint('efficiency_percentage >= 1 AND efficiency_percentage <= 100', 
                       name='stove_efficiency_check'),
    )
    
    @validates('stove_type')
    def validate_stove_type(self, key, stove_type):
        """Validate stove type is valid."""
        if stove_type not in STOVE_TYPES:
            raise ValueError(f"Invalid stove type. Must be one of: {', '.join(STOVE_TYPES.keys())}")
        return stove_type
    
    @validates('fuel_type')
    def validate_fuel_type(self, key, fuel_type):
        """Validate fuel type is valid and compatible with stove type."""
        if fuel_type not in FUEL_CONSUMPTION_RATES:
            raise ValueError(f"Invalid fuel type. Must be one of: {', '.join(FUEL_CONSUMPTION_RATES.keys())}")
        
        # Check compatibility with stove type
        if hasattr(self, 'stove_type') and self.stove_type:
            compatible_fuels = STOVE_TYPES.get(self.stove_type, [])
            if fuel_type not in compatible_fuels:
                raise ValueError(f"Fuel type {fuel_type} not compatible with stove type {self.stove_type}")
        
        return fuel_type
    
    @validates('efficiency_percentage')
    def validate_efficiency(self, key, efficiency):
        """Validate efficiency is within valid range."""
        if efficiency < Decimal('1') or efficiency > Decimal('100'):
            raise ValueError("Efficiency must be between 1 and 100")
        return efficiency
    
    def calculate_fuel_needed(self, water_ml: int) -> Decimal:
        """
        Calculate fuel needed for boiling water.
        
        Args:
            water_ml: Amount of water to boil in milliliters
            
        Returns:
            Fuel needed in grams
        """
        if not self.fuel_type or water_ml <= 0:
            return Decimal('0.00')
        
        base_consumption = FUEL_CONSUMPTION_RATES.get(self.fuel_type, 0.1)
        efficiency_factor = self.efficiency_percentage / Decimal('100')
        
        # Calculate fuel needed accounting for efficiency
        fuel_g = Decimal(str(water_ml * base_consumption)) / efficiency_factor
        
        return fuel_g.quantize(Decimal('0.01'))
    
    def __repr__(self):
        return f"<TripStove(id={self.id}, trip_id={self.trip_id}, stove_type={self.stove_type}, fuel_type={self.fuel_type})>"
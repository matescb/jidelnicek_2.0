"""
Snack model for quick snack items.
"""

from datetime import datetime
from typing import Optional, TYPE_CHECKING
from uuid import UUID
from decimal import Decimal

from sqlalchemy import (
    Boolean, DateTime, String, ForeignKey, 
    CheckConstraint, UniqueConstraint, text, Index, Numeric
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship, Mapped, mapped_column, validates

from jidelnicek.core.database import Base
from jidelnicek.core.utils import get_utc_now

if TYPE_CHECKING:
    from .nutritional_value import NutritionalValue


class Snack(Base):
    """
    Snack model for quick snack items.
    
    Features:
    - User-specific and global snacks
    - Flexible measurement (by piece or per 100g)
    - Nutritional value tracking
    - Soft delete with archival
    """
    __tablename__ = "common_snacks"
    
    # Primary key
    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), 
        primary_key=True, 
        server_default=text("gen_random_uuid()")
    )
    
    # User relationship
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("auth_users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    # Snack details
    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True
    )
    
    measurement_type: Mapped[Optional[str]] = mapped_column(String(20))
    
    piece_weight_g: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(precision=10, scale=2)
    )
    
    # Nutritional reference
    nutritional_value_id: Mapped[Optional[UUID]] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("common_nutritional_values.id")
    )
    
    # Flags
    is_global: Mapped[bool] = mapped_column(
        Boolean,
        server_default=text('false'),
        nullable=False
    )
    
    is_archived: Mapped[bool] = mapped_column(
        Boolean,
        server_default=text('false'),
        nullable=False
    )
    
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
    nutritional_value: Mapped[Optional["NutritionalValue"]] = relationship(
        "NutritionalValue",
        back_populates="snacks"
    )
    
    # Table constraints
    __table_args__ = (
        CheckConstraint(
            "measurement_type IN ('piece', 'per_100g')",
            name='common_snacks_measurement_type_check'
        ),
        UniqueConstraint('user_id', 'name'),
        Index('idx_snacks_user', 'user_id', postgresql_where=text('NOT is_archived')),
        Index('idx_snacks_name', 'name'),
    )
    
    @validates('name')
    def validate_name(self, key, name):
        """Validate snack name is not empty."""
        if not name or not name.strip():
            raise ValueError("Snack name cannot be empty")
        return name.strip()
    
    @validates('measurement_type')
    def validate_measurement_type(self, key, measurement_type):
        """Validate measurement type is valid."""
        if measurement_type and measurement_type not in ('piece', 'per_100g'):
            raise ValueError("Measurement type must be 'piece' or 'per_100g'")
        return measurement_type
    
    @validates('piece_weight_g')
    def validate_piece_weight(self, key, piece_weight_g):
        """Validate piece weight is positive when provided."""
        if piece_weight_g is not None and piece_weight_g <= 0:
            raise ValueError("Piece weight must be greater than 0")
        return piece_weight_g
    
    def __repr__(self):
        return f"<Snack(id={self.id}, name={self.name}, user_id={self.user_id})>"
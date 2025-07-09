"""
Common fixtures for recipe tests.

This module provides common fixtures used across all recipe test modules.
"""

import pytest
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from jidelnicek.common.models.ingredient import Ingredient
from jidelnicek.common.models.nutritional_value import NutritionalValue
from jidelnicek.auth.models import AuthUser
from jidelnicek.auth.utils.password import PasswordHasher


@pytest.fixture
async def sample_user(db_session: AsyncSession) -> AuthUser:
    """Create a sample user for testing."""
    user = AuthUser(
        email="sample@example.com",
        password_hash=PasswordHasher.hash_password("SampleUser123!"),
        email_verified=True,
        email_verified_at=datetime.now(timezone.utc),
        language="en",
        unit_system="metric",
        energy_unit="kcal",
        has_pku=False,
        timezone="UTC",
        role="user",
        is_active=True,
        is_archived=False
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def sample_nutritional_value(db_session: AsyncSession) -> NutritionalValue:
    """Create a sample nutritional value for testing."""
    nutritional_value = NutritionalValue(
        calories=Decimal('100.0'),
        proteins_g=Decimal('20.0'),
        carbohydrates_g=Decimal('10.0'),
        fats_g=Decimal('5.0'),
        fiber_g=Decimal('2.0'),
        sugars_g=Decimal('3.0'),
        sodium_mg=Decimal('50.0'),
        reference_amount_g=Decimal('100.0')
    )
    db_session.add(nutritional_value)
    await db_session.commit()
    await db_session.refresh(nutritional_value)
    return nutritional_value


@pytest.fixture
async def sample_ingredient(db_session: AsyncSession, sample_nutritional_value: NutritionalValue) -> Ingredient:
    """Create a sample ingredient for testing."""
    ingredient = Ingredient(
        name="Test Ingredient",
        category="Test Category",
        nutritional_value_id=sample_nutritional_value.id,
        is_global=True
    )
    db_session.add(ingredient)
    await db_session.commit()
    await db_session.refresh(ingredient)
    return ingredient
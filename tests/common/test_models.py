"""Tests for common module models."""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from decimal import Decimal

from jidelnicek.core.database import Base
from jidelnicek.common.models import Ingredient, NutritionalValue, Snack
from jidelnicek.auth.models import User
from jidelnicek.recipe.models import Recipe, RecipeIngredient


@pytest.fixture
def db_session():
    """Create an in-memory SQLite database for testing."""
    # Use SQLite for tests (Note: In production, use PostgreSQL)
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    
    SessionLocal = sessionmaker(bind=engine)
    session = SessionLocal()
    
    yield session
    
    session.close()


def test_nutritional_value_creation(db_session: Session):
    """Test creating a nutritional value record."""
    nutritional_value = NutritionalValue(
        calories=Decimal("250.50"),
        proteins_g=Decimal("10.2"),
        carbohydrates_g=Decimal("30.0"),
        fats_g=Decimal("8.5"),
        fiber_g=Decimal("5.0"),
        sodium_mg=Decimal("150.0"),
        phe_mg=Decimal("50.0")  # For PKU tracking
    )
    
    db_session.add(nutritional_value)
    db_session.commit()
    
    assert nutritional_value.id is not None
    assert nutritional_value.calories == Decimal("250.50")
    assert nutritional_value.phe_mg == Decimal("50.0")


def test_ingredient_creation(db_session: Session):
    """Test creating an ingredient with nutritional value."""
    # Create nutritional value
    nutritional_value = NutritionalValue(
        calories=Decimal("52"),
        proteins_g=Decimal("0.3"),
        carbohydrates_g=Decimal("14"),
        fats_g=Decimal("0.2")
    )
    
    # Create ingredient
    ingredient = Ingredient(
        name="Apple",
        category="Fruits",
        nutritional_value=nutritional_value,
        is_global=True
    )
    
    db_session.add(ingredient)
    db_session.commit()
    
    assert ingredient.id is not None
    assert ingredient.name == "Apple"
    assert ingredient.nutritional_value.calories == Decimal("52")
    assert ingredient.is_global is True
    assert ingredient.user_id is None  # Global ingredients don't have user_id


def test_ingredient_user_specific(db_session: Session):
    """Test creating a user-specific ingredient."""
    # Create a user first
    user = User(
        email="test@example.com",
        password_hash="hashed_password"
    )
    db_session.add(user)
    db_session.commit()
    
    # Create user-specific ingredient
    ingredient = Ingredient(
        name="My Special Flour",
        category="Grains",
        user_id=user.id,
        is_global=False
    )
    
    db_session.add(ingredient)
    db_session.commit()
    
    assert ingredient.user_id == user.id
    assert ingredient.is_global is False


def test_recipe_ingredient_relationship(db_session: Session):
    """Test the relationship between Recipe, RecipeIngredient, and Ingredient."""
    # Create user
    user = User(email="chef@example.com", password_hash="hashed")
    db_session.add(user)
    
    # Create ingredient with nutritional value
    nutritional_value = NutritionalValue(
        calories=Decimal("364"),
        proteins_g=Decimal("10"),
        carbohydrates_g=Decimal("76"),
        fats_g=Decimal("1")
    )
    
    ingredient = Ingredient(
        name="Flour",
        category="Grains",
        nutritional_value=nutritional_value,
        is_global=True
    )
    db_session.add(ingredient)
    
    # Create recipe
    recipe = Recipe(
        user_id=user.id,
        name="Simple Bread",
        instructions="Mix and bake",
        servings=4
    )
    db_session.add(recipe)
    db_session.commit()
    
    # Create recipe ingredient link
    recipe_ingredient = RecipeIngredient(
        recipe_id=recipe.id,
        ingredient_id=ingredient.id,
        quantity_g=Decimal("500"),
        display_order=1
    )
    db_session.add(recipe_ingredient)
    db_session.commit()
    
    # Test relationships
    assert len(recipe.ingredients) == 1
    assert recipe.ingredients[0].ingredient.name == "Flour"
    assert recipe.ingredients[0].quantity_g == Decimal("500")
    assert ingredient.recipe_ingredients[0].recipe.name == "Simple Bread"


def test_snack_creation(db_session: Session):
    """Test creating a snack item."""
    # Create user
    user = User(email="snacker@example.com", password_hash="hashed")
    db_session.add(user)
    
    # Create nutritional value for snack
    nutritional_value = NutritionalValue(
        calories=Decimal("150"),
        proteins_g=Decimal("2"),
        carbohydrates_g=Decimal("20"),
        fats_g=Decimal("7")
    )
    
    # Create snack
    snack = Snack(
        user_id=user.id,
        name="Chocolate Chip Cookie",
        measurement_type="piece",
        piece_weight_g=Decimal("30"),
        nutritional_value=nutritional_value
    )
    
    db_session.add(snack)
    db_session.commit()
    
    assert snack.id is not None
    assert snack.name == "Chocolate Chip Cookie"
    assert snack.piece_weight_g == Decimal("30")
    assert snack.nutritional_value.calories == Decimal("150")


def test_validation_errors(db_session: Session):
    """Test model validation."""
    # Test negative calories
    with pytest.raises(ValueError, match="calories cannot be negative"):
        NutritionalValue(
            calories=Decimal("-10"),
            proteins_g=Decimal("5"),
            carbohydrates_g=Decimal("10"),
            fats_g=Decimal("2")
        )
    
    # Test empty ingredient name
    with pytest.raises(ValueError, match="Ingredient name cannot be empty"):
        Ingredient(name="", category="Test")
    
    # Test invalid measurement type
    user = User(email="test2@example.com", password_hash="hashed")
    db_session.add(user)
    db_session.commit()
    
    with pytest.raises(ValueError, match="Measurement type must be"):
        Snack(
            user_id=user.id,
            name="Bad Snack",
            measurement_type="invalid"
        )
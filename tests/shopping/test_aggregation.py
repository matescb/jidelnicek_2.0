"""
Tests for ingredient aggregation engine.
"""

import pytest
from decimal import Decimal
from uuid import UUID, uuid4

from jidelnicek.shopping.utils.aggregation import (
    IngredientAggregator,
    AggregatedIngredient,
    RecipeSource
)
from jidelnicek.core.exceptions import ValidationError


class TestIngredientAggregator:
    """Test suite for IngredientAggregator."""
    
    @pytest.fixture
    def aggregator(self):
        """Create a fresh aggregator instance."""
        return IngredientAggregator()
    
    @pytest.fixture
    def sample_ingredients(self):
        """Create sample ingredient data."""
        return [
            {
                'ingredient_id': UUID('12345678-1234-5678-1234-567812345678'),
                'name': 'Flour',
                'quantity': Decimal('500'),
                'unit': 'g',
                'category': 'Baking',
                'storage_type': 'dry'
            },
            {
                'ingredient_id': UUID('87654321-4321-8765-4321-876543218765'),
                'name': 'Milk',
                'quantity': Decimal('250'),
                'unit': 'ml',
                'category': 'Dairy',
                'storage_type': 'refrigerated'
            },
            {
                'ingredient_id': UUID('11111111-1111-1111-1111-111111111111'),
                'name': 'Eggs',
                'quantity': Decimal('3'),
                'unit': 'piece',
                'category': 'Dairy',
                'storage_type': 'refrigerated'
            }
        ]
    
    def test_add_single_recipe(self, aggregator, sample_ingredients):
        """Test adding ingredients from a single recipe."""
        recipe_id = uuid4()
        
        aggregator.add_recipe_ingredients(
            recipe_id=recipe_id,
            recipe_name="Pancakes",
            meal_name="Breakfast",
            day_number=1,
            ingredients=sample_ingredients
        )
        
        # Check aggregated ingredients
        ingredients = aggregator.get_aggregated_ingredients()
        assert len(ingredients) == 3
        
        # Check flour
        flour = aggregator.get_ingredient_by_name("Flour")
        assert flour is not None
        assert flour.total_quantity == Decimal('500')
        assert flour.unit == 'g'
        assert flour.category == 'Baking'
        assert len(flour.sources) == 1
        
        # Check milk
        milk = aggregator.get_ingredient_by_name("Milk")
        assert milk is not None
        assert milk.total_quantity == Decimal('250')
        assert milk.unit == 'ml'
        
        # Check eggs
        eggs = aggregator.get_ingredient_by_name("Eggs")
        assert eggs is not None
        assert eggs.total_quantity == Decimal('3')
        assert eggs.unit == 'piece'
    
    def test_aggregate_multiple_recipes(self, aggregator):
        """Test aggregating same ingredients from multiple recipes."""
        # Recipe 1: Pancakes
        recipe1_id = uuid4()
        flour_id = UUID('12345678-1234-5678-1234-567812345678')
        
        aggregator.add_recipe_ingredients(
            recipe_id=recipe1_id,
            recipe_name="Pancakes",
            meal_name="Breakfast",
            day_number=1,
            ingredients=[
                {
                    'ingredient_id': flour_id,
                    'name': 'Flour',
                    'quantity': Decimal('200'),
                    'unit': 'g',
                    'category': 'Baking'
                }
            ]
        )
        
        # Recipe 2: Bread
        recipe2_id = uuid4()
        aggregator.add_recipe_ingredients(
            recipe_id=recipe2_id,
            recipe_name="Bread",
            meal_name="Lunch",
            day_number=1,
            ingredients=[
                {
                    'ingredient_id': flour_id,
                    'name': 'Flour',
                    'quantity': Decimal('300'),
                    'unit': 'g',
                    'category': 'Baking'
                }
            ]
        )
        
        # Check aggregation
        flour = aggregator.get_ingredient_by_name("Flour")
        assert flour.total_quantity == Decimal('500')  # 200 + 300
        assert len(flour.sources) == 2
        
        # Check recipe breakdown
        breakdown = flour.get_recipe_breakdown()
        assert len(breakdown) == 2
        assert "Pancakes (Day 1, Breakfast)" in breakdown
        assert "Bread (Day 1, Lunch)" in breakdown
    
    def test_unit_normalization_weight(self, aggregator):
        """Test weight unit normalization to grams."""
        ingredient_id = uuid4()
        
        # Add in kg
        aggregator.add_recipe_ingredients(
            recipe_id=uuid4(),
            recipe_name="Recipe 1",
            meal_name="Lunch",
            day_number=1,
            ingredients=[{
                'ingredient_id': ingredient_id,
                'name': 'Sugar',
                'quantity': Decimal('0.5'),
                'unit': 'kg'
            }]
        )
        
        # Add in g
        aggregator.add_recipe_ingredients(
            recipe_id=uuid4(),
            recipe_name="Recipe 2",
            meal_name="Dinner",
            day_number=1,
            ingredients=[{
                'ingredient_id': ingredient_id,
                'name': 'Sugar',
                'quantity': Decimal('250'),
                'unit': 'g'
            }]
        )
        
        # Check total (should be 750g)
        sugar = aggregator.get_ingredient_by_name("Sugar")
        assert sugar.total_quantity == Decimal('750')
        assert sugar.unit == 'g'
    
    def test_unit_normalization_volume(self, aggregator):
        """Test volume unit normalization to milliliters."""
        ingredient_id = uuid4()
        
        # Add in liters
        aggregator.add_recipe_ingredients(
            recipe_id=uuid4(),
            recipe_name="Recipe 1",
            meal_name="Breakfast",
            day_number=1,
            ingredients=[{
                'ingredient_id': ingredient_id,
                'name': 'Water',
                'quantity': Decimal('1.5'),
                'unit': 'l'
            }]
        )
        
        # Add in ml
        aggregator.add_recipe_ingredients(
            recipe_id=uuid4(),
            recipe_name="Recipe 2",
            meal_name="Lunch",
            day_number=1,
            ingredients=[{
                'ingredient_id': ingredient_id,
                'name': 'Water',
                'quantity': Decimal('500'),
                'unit': 'ml'
            }]
        )
        
        # Check total (should be 2000ml)
        water = aggregator.get_ingredient_by_name("Water")
        assert water.total_quantity == Decimal('2000')
        assert water.unit == 'ml'
    
    def test_unit_mismatch_error(self, aggregator):
        """Test that mismatched units raise an error."""
        ingredient_id = uuid4()
        
        # Add as weight
        aggregator.add_recipe_ingredients(
            recipe_id=uuid4(),
            recipe_name="Recipe 1",
            meal_name="Breakfast",
            day_number=1,
            ingredients=[{
                'ingredient_id': ingredient_id,
                'name': 'Oil',
                'quantity': Decimal('100'),
                'unit': 'g'
            }]
        )
        
        # Try to add same ingredient as volume - should fail
        with pytest.raises(ValidationError) as exc_info:
            aggregator.add_recipe_ingredients(
                recipe_id=uuid4(),
                recipe_name="Recipe 2",
                meal_name="Lunch",
                day_number=1,
                ingredients=[{
                    'ingredient_id': ingredient_id,
                    'name': 'Oil',
                    'quantity': Decimal('100'),
                    'unit': 'ml'
                }]
            )
        assert "Unit mismatch" in str(exc_info.value)
    
    def test_get_by_category(self, aggregator, sample_ingredients):
        """Test filtering ingredients by category."""
        aggregator.add_recipe_ingredients(
            recipe_id=uuid4(),
            recipe_name="Test Recipe",
            meal_name="Breakfast",
            day_number=1,
            ingredients=sample_ingredients
        )
        
        # Get dairy ingredients
        dairy = aggregator.get_ingredients_by_category("Dairy")
        assert len(dairy) == 2
        dairy_names = [ing.name for ing in dairy]
        assert "Milk" in dairy_names
        assert "Eggs" in dairy_names
        
        # Get baking ingredients
        baking = aggregator.get_ingredients_by_category("Baking")
        assert len(baking) == 1
        assert baking[0].name == "Flour"
    
    def test_total_calculations(self, aggregator):
        """Test total weight and volume calculations."""
        ingredients = [
            {
                'ingredient_id': uuid4(),
                'name': 'Flour',
                'quantity': Decimal('1'),
                'unit': 'kg'  # 1000g
            },
            {
                'ingredient_id': uuid4(),
                'name': 'Sugar',
                'quantity': Decimal('500'),
                'unit': 'g'
            },
            {
                'ingredient_id': uuid4(),
                'name': 'Water',
                'quantity': Decimal('2'),
                'unit': 'l'  # 2000ml
            },
            {
                'ingredient_id': uuid4(),
                'name': 'Oil',
                'quantity': Decimal('250'),
                'unit': 'ml'
            },
            {
                'ingredient_id': uuid4(),
                'name': 'Eggs',
                'quantity': Decimal('6'),
                'unit': 'piece'  # Not weight or volume
            }
        ]
        
        aggregator.add_recipe_ingredients(
            recipe_id=uuid4(),
            recipe_name="Test Recipe",
            meal_name="Lunch",
            day_number=1,
            ingredients=ingredients
        )
        
        # Check totals
        assert aggregator.get_total_weight() == Decimal('1500')  # 1000 + 500
        assert aggregator.get_total_volume() == Decimal('2250')  # 2000 + 250
    
    def test_merge_aggregators(self, aggregator):
        """Test merging two aggregators."""
        flour_id = uuid4()
        
        # First aggregator
        aggregator1 = IngredientAggregator()
        aggregator1.add_recipe_ingredients(
            recipe_id=uuid4(),
            recipe_name="Recipe 1",
            meal_name="Breakfast",
            day_number=1,
            ingredients=[{
                'ingredient_id': flour_id,
                'name': 'Flour',
                'quantity': Decimal('200'),
                'unit': 'g'
            }]
        )
        
        # Second aggregator
        aggregator2 = IngredientAggregator()
        aggregator2.add_recipe_ingredients(
            recipe_id=uuid4(),
            recipe_name="Recipe 2",
            meal_name="Lunch",
            day_number=2,
            ingredients=[{
                'ingredient_id': flour_id,
                'name': 'Flour',
                'quantity': Decimal('300'),
                'unit': 'g'
            }]
        )
        
        # Merge
        aggregator1.merge_with(aggregator2)
        
        # Check result
        flour = aggregator1.get_ingredient_by_name("Flour")
        assert flour.total_quantity == Decimal('500')
        assert len(flour.sources) == 2
    
    def test_summary_stats(self, aggregator, sample_ingredients):
        """Test summary statistics generation."""
        # Add multiple recipes
        for i in range(3):
            aggregator.add_recipe_ingredients(
                recipe_id=uuid4(),
                recipe_name=f"Recipe {i+1}",
                meal_name="Breakfast",
                day_number=i+1,
                ingredients=sample_ingredients
            )
        
        stats = aggregator.get_summary_stats()
        
        assert stats['total_ingredients'] == 3
        assert stats['total_categories'] == 2  # Baking, Dairy
        assert stats['total_recipes'] == 3
        assert stats['total_weight_g'] == 1500.0  # 500g flour * 3
        assert stats['total_volume_ml'] == 750.0  # 250ml milk * 3
        assert 'Baking' in stats['categories']
        assert 'Dairy' in stats['categories']
    
    def test_case_insensitive_search(self, aggregator, sample_ingredients):
        """Test case-insensitive ingredient search."""
        aggregator.add_recipe_ingredients(
            recipe_id=uuid4(),
            recipe_name="Test",
            meal_name="Lunch",
            day_number=1,
            ingredients=sample_ingredients
        )
        
        # Test various cases
        assert aggregator.get_ingredient_by_name("flour") is not None
        assert aggregator.get_ingredient_by_name("FLOUR") is not None
        assert aggregator.get_ingredient_by_name("Flour") is not None
        assert aggregator.get_ingredient_by_name("fLoUr") is not None
    
    def test_clear_aggregator(self, aggregator, sample_ingredients):
        """Test clearing all data from aggregator."""
        aggregator.add_recipe_ingredients(
            recipe_id=uuid4(),
            recipe_name="Test",
            meal_name="Dinner",
            day_number=1,
            ingredients=sample_ingredients
        )
        
        # Verify data exists
        assert len(aggregator.get_aggregated_ingredients()) == 3
        
        # Clear
        aggregator.clear()
        
        # Verify empty
        assert len(aggregator.get_aggregated_ingredients()) == 0
        assert aggregator.get_ingredient_by_name("Flour") is None
    
    def test_imperial_unit_conversion(self, aggregator):
        """Test conversion of imperial units."""
        ingredient_id = uuid4()
        
        # Add in pounds
        aggregator.add_recipe_ingredients(
            recipe_id=uuid4(),
            recipe_name="Recipe 1",
            meal_name="Dinner",
            day_number=1,
            ingredients=[{
                'ingredient_id': ingredient_id,
                'name': 'Chicken',
                'quantity': Decimal('2'),
                'unit': 'lb'
            }]
        )
        
        # Add in ounces
        aggregator.add_recipe_ingredients(
            recipe_id=uuid4(),
            recipe_name="Recipe 2",
            meal_name="Lunch",
            day_number=2,
            ingredients=[{
                'ingredient_id': ingredient_id,
                'name': 'Chicken',
                'quantity': Decimal('8'),
                'unit': 'oz'
            }]
        )
        
        # Check total (2 lb = 907.184g, 8 oz = 226.796g)
        chicken = aggregator.get_ingredient_by_name("Chicken")
        expected = Decimal('907.184') + Decimal('226.796')
        # Allow small rounding difference
        assert abs(chicken.total_quantity - expected) < Decimal('0.01')
        assert chicken.unit == 'g'
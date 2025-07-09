"""
Ingredient aggregation engine for shopping list generation.

This module handles combining identical ingredients from multiple recipes,
normalizing units, and tracking recipe sources for each aggregated ingredient.
"""

from decimal import Decimal
from typing import Dict, List, Tuple, Optional, Set
from dataclasses import dataclass, field
from uuid import UUID
import logging

from jidelnicek.core.exceptions import ValidationError


logger = logging.getLogger(__name__)


@dataclass
class RecipeSource:
    """Information about which recipe an ingredient comes from."""
    recipe_id: UUID
    recipe_name: str
    meal_name: str
    day_number: int
    quantity: Decimal
    unit: str


@dataclass
class AggregatedIngredient:
    """
    Represents an aggregated ingredient with combined quantities from multiple recipes.
    """
    ingredient_id: UUID
    name: str
    total_quantity: Decimal
    unit: str
    sources: List[RecipeSource] = field(default_factory=list)
    category: Optional[str] = None
    storage_type: Optional[str] = None
    
    def add_source(self, source: RecipeSource) -> None:
        """Add a recipe source for this ingredient."""
        self.sources.append(source)
        
    def get_recipe_breakdown(self) -> Dict[str, Decimal]:
        """Get breakdown of quantity by recipe."""
        breakdown = {}
        for source in self.sources:
            key = f"{source.recipe_name} (Day {source.day_number}, {source.meal_name})"
            breakdown[key] = source.quantity
        return breakdown


class IngredientAggregator:
    """
    Core aggregation engine that combines ingredients from multiple recipes.
    
    Handles:
    - Unit normalization (e.g., converting kg to g)
    - Quantity addition for identical ingredients
    - Recipe source tracking
    - Support for different unit systems
    """
    
    # Unit conversion factors to base units
    # Weight: convert to grams
    WEIGHT_CONVERSIONS = {
        'g': Decimal('1'),
        'gram': Decimal('1'),
        'kg': Decimal('1000'),
        'kilogram': Decimal('1000'),
        'mg': Decimal('0.001'),
        'milligram': Decimal('0.001'),
        'oz': Decimal('28.3495'),
        'ounce': Decimal('28.3495'),
        'lb': Decimal('453.592'),
        'pound': Decimal('453.592'),
    }
    
    # Volume: convert to milliliters
    VOLUME_CONVERSIONS = {
        'ml': Decimal('1'),
        'milliliter': Decimal('1'),
        'l': Decimal('1000'),
        'liter': Decimal('1000'),
        'dl': Decimal('100'),
        'deciliter': Decimal('100'),
        'cl': Decimal('10'),
        'centiliter': Decimal('10'),
        'cup': Decimal('236.588'),
        'tbsp': Decimal('14.7868'),
        'tablespoon': Decimal('14.7868'),
        'tsp': Decimal('4.92892'),
        'teaspoon': Decimal('4.92892'),
        'fl oz': Decimal('29.5735'),
        'fluid ounce': Decimal('29.5735'),
        'pt': Decimal('473.176'),
        'pint': Decimal('473.176'),
        'qt': Decimal('946.353'),
        'quart': Decimal('946.353'),
        'gal': Decimal('3785.41'),
        'gallon': Decimal('3785.41'),
    }
    
    def __init__(self):
        """Initialize the aggregator."""
        self._aggregated_ingredients: Dict[UUID, AggregatedIngredient] = {}
        self._name_to_id_map: Dict[str, UUID] = {}
        
    def add_recipe_ingredients(
        self,
        recipe_id: UUID,
        recipe_name: str,
        meal_name: str,
        day_number: int,
        ingredients: List[Dict]
    ) -> None:
        """
        Add ingredients from a recipe to the aggregation.
        
        Args:
            recipe_id: The recipe's UUID
            recipe_name: Name of the recipe
            meal_name: Name of the meal (e.g., "Breakfast", "Lunch")
            day_number: Day number in the trip
            ingredients: List of ingredient dicts with keys:
                - ingredient_id: UUID
                - name: str
                - quantity: Decimal or float
                - unit: str
                - category: Optional[str]
                - storage_type: Optional[str]
        """
        for ingredient in ingredients:
            self._add_single_ingredient(
                recipe_id=recipe_id,
                recipe_name=recipe_name,
                meal_name=meal_name,
                day_number=day_number,
                ingredient_data=ingredient
            )
            
    def _add_single_ingredient(
        self,
        recipe_id: UUID,
        recipe_name: str,
        meal_name: str,
        day_number: int,
        ingredient_data: Dict
    ) -> None:
        """Add a single ingredient to the aggregation."""
        ingredient_id = ingredient_data['ingredient_id']
        name = ingredient_data['name']
        quantity = Decimal(str(ingredient_data['quantity']))
        unit = ingredient_data['unit'].lower()
        
        # Normalize the unit and quantity
        normalized_unit, normalized_quantity = self._normalize_unit_and_quantity(
            unit, quantity
        )
        
        # Create recipe source
        source = RecipeSource(
            recipe_id=recipe_id,
            recipe_name=recipe_name,
            meal_name=meal_name,
            day_number=day_number,
            quantity=normalized_quantity,
            unit=normalized_unit
        )
        
        # Add or update the aggregated ingredient
        if ingredient_id in self._aggregated_ingredients:
            # Update existing ingredient
            agg_ingredient = self._aggregated_ingredients[ingredient_id]
            
            # Verify units match (after normalization)
            if agg_ingredient.unit != normalized_unit:
                raise ValidationError(
                    f"Unit mismatch for ingredient '{name}': "
                    f"expected {agg_ingredient.unit}, got {normalized_unit}"
                )
                
            # Add quantity and source
            agg_ingredient.total_quantity += normalized_quantity
            agg_ingredient.add_source(source)
        else:
            # Create new aggregated ingredient
            agg_ingredient = AggregatedIngredient(
                ingredient_id=ingredient_id,
                name=name,
                total_quantity=normalized_quantity,
                unit=normalized_unit,
                category=ingredient_data.get('category'),
                storage_type=ingredient_data.get('storage_type')
            )
            agg_ingredient.add_source(source)
            
            self._aggregated_ingredients[ingredient_id] = agg_ingredient
            self._name_to_id_map[name.lower()] = ingredient_id
            
    def _normalize_unit_and_quantity(
        self, 
        unit: str, 
        quantity: Decimal
    ) -> Tuple[str, Decimal]:
        """
        Normalize unit and quantity to base units.
        
        Returns:
            Tuple of (normalized_unit, normalized_quantity)
        """
        unit_lower = unit.lower()
        
        # Check if it's a weight unit
        if unit_lower in self.WEIGHT_CONVERSIONS:
            conversion_factor = self.WEIGHT_CONVERSIONS[unit_lower]
            return 'g', quantity * conversion_factor
            
        # Check if it's a volume unit
        if unit_lower in self.VOLUME_CONVERSIONS:
            conversion_factor = self.VOLUME_CONVERSIONS[unit_lower]
            return 'ml', quantity * conversion_factor
            
        # For other units (piece, pinch, etc.), keep as is
        return unit, quantity
        
    def get_aggregated_ingredients(self) -> List[AggregatedIngredient]:
        """
        Get all aggregated ingredients sorted by category and name.
        
        Returns:
            List of AggregatedIngredient objects
        """
        ingredients = list(self._aggregated_ingredients.values())
        
        # Sort by category first, then by name
        ingredients.sort(key=lambda x: (x.category or 'zzz', x.name.lower()))
        
        return ingredients
        
    def get_ingredient_by_name(self, name: str) -> Optional[AggregatedIngredient]:
        """
        Get an aggregated ingredient by name (case-insensitive).
        
        Args:
            name: Ingredient name to search for
            
        Returns:
            AggregatedIngredient if found, None otherwise
        """
        ingredient_id = self._name_to_id_map.get(name.lower())
        if ingredient_id:
            return self._aggregated_ingredients.get(ingredient_id)
        return None
        
    def get_ingredients_by_category(
        self, 
        category: str
    ) -> List[AggregatedIngredient]:
        """
        Get all ingredients in a specific category.
        
        Args:
            category: Category name to filter by
            
        Returns:
            List of AggregatedIngredient objects in the category
        """
        return [
            ing for ing in self._aggregated_ingredients.values()
            if ing.category and ing.category.lower() == category.lower()
        ]
        
    def get_total_weight(self) -> Decimal:
        """
        Calculate total weight of all ingredients in grams.
        
        Only includes ingredients measured by weight.
        
        Returns:
            Total weight in grams
        """
        total = Decimal('0')
        for ingredient in self._aggregated_ingredients.values():
            if ingredient.unit == 'g':
                total += ingredient.total_quantity
        return total
        
    def get_total_volume(self) -> Decimal:
        """
        Calculate total volume of all ingredients in milliliters.
        
        Only includes ingredients measured by volume.
        
        Returns:
            Total volume in milliliters
        """
        total = Decimal('0')
        for ingredient in self._aggregated_ingredients.values():
            if ingredient.unit == 'ml':
                total += ingredient.total_quantity
        return total
        
    def clear(self) -> None:
        """Clear all aggregated data."""
        self._aggregated_ingredients.clear()
        self._name_to_id_map.clear()
        
    def merge_with(self, other: 'IngredientAggregator') -> None:
        """
        Merge another aggregator's data into this one.
        
        Args:
            other: Another IngredientAggregator instance
        """
        for ingredient in other.get_aggregated_ingredients():
            # Add each source individually to maintain proper aggregation
            for source in ingredient.sources:
                self._add_single_ingredient(
                    recipe_id=source.recipe_id,
                    recipe_name=source.recipe_name,
                    meal_name=source.meal_name,
                    day_number=source.day_number,
                    ingredient_data={
                        'ingredient_id': ingredient.ingredient_id,
                        'name': ingredient.name,
                        'quantity': source.quantity,
                        'unit': source.unit,
                        'category': ingredient.category,
                        'storage_type': ingredient.storage_type
                    }
                )
                
    def get_summary_stats(self) -> Dict[str, any]:
        """
        Get summary statistics about the aggregation.
        
        Returns:
            Dictionary with statistics
        """
        total_ingredients = len(self._aggregated_ingredients)
        categories = set()
        recipe_count = set()
        
        for ingredient in self._aggregated_ingredients.values():
            if ingredient.category:
                categories.add(ingredient.category)
            for source in ingredient.sources:
                recipe_count.add(source.recipe_id)
                
        return {
            'total_ingredients': total_ingredients,
            'total_categories': len(categories),
            'total_recipes': len(recipe_count),
            'total_weight_g': float(self.get_total_weight()),
            'total_volume_ml': float(self.get_total_volume()),
            'categories': sorted(list(categories))
        }
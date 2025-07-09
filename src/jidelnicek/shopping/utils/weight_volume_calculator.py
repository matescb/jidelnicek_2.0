"""
Weight and volume calculator for shopping list items.

This module provides estimation of total weight and volume for transportation
planning, using standard density tables for common ingredients.
"""

from decimal import Decimal
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
import logging


logger = logging.getLogger(__name__)


class IngredientType(Enum):
    """Types of ingredients for density estimation."""
    LIQUID = "liquid"
    SOLID_DENSE = "solid_dense"      # Flour, sugar, salt
    SOLID_MEDIUM = "solid_medium"    # Rice, pasta, grains
    SOLID_LIGHT = "solid_light"      # Leafy vegetables, herbs
    PROTEIN = "protein"              # Meat, fish, eggs
    DAIRY = "dairy"                  # Milk, cheese, yogurt
    FAT = "fat"                      # Oil, butter
    PRODUCE = "produce"              # Fruits, vegetables
    BAKED = "baked"                  # Bread, pastries
    COUNTABLE = "countable"          # Eggs, individual items


@dataclass
class WeightVolumeResult:
    """Result of weight/volume calculation."""
    total_weight_g: Decimal
    total_volume_ml: Decimal
    estimated_items: int
    actual_items: int
    weight_by_category: Dict[str, Decimal]
    volume_by_category: Dict[str, Decimal]
    transport_recommendations: List[str]


class WeightVolumeCalculator:
    """
    Calculator for estimating total weight and volume of shopping items.
    
    Uses standard density tables and conversion factors to estimate
    weights and volumes for transportation planning.
    """
    
    # Standard densities (g/ml) for different ingredient types
    STANDARD_DENSITIES = {
        IngredientType.LIQUID: Decimal('1.0'),        # Water-based liquids
        IngredientType.SOLID_DENSE: Decimal('1.5'),   # Flour, sugar
        IngredientType.SOLID_MEDIUM: Decimal('0.8'),  # Rice, pasta
        IngredientType.SOLID_LIGHT: Decimal('0.2'),   # Leafy greens
        IngredientType.PROTEIN: Decimal('1.0'),       # Meat, fish
        IngredientType.DAIRY: Decimal('1.03'),        # Milk products
        IngredientType.FAT: Decimal('0.92'),          # Oils, butter
        IngredientType.PRODUCE: Decimal('0.7'),       # Average fruits/veg
        IngredientType.BAKED: Decimal('0.3'),         # Bread, pastries
    }
    
    # Specific ingredient densities (g/ml) - overrides type-based
    SPECIFIC_DENSITIES = {
        # Liquids
        'water': Decimal('1.0'),
        'milk': Decimal('1.03'),
        'cream': Decimal('0.98'),
        'oil': Decimal('0.92'),
        'honey': Decimal('1.42'),
        'vinegar': Decimal('1.01'),
        
        # Solids (estimated volume based on packed density)
        'flour': Decimal('0.59'),
        'sugar': Decimal('0.85'),
        'brown sugar': Decimal('0.72'),
        'salt': Decimal('1.22'),
        'rice': Decimal('0.75'),
        'pasta': Decimal('0.65'),
        'butter': Decimal('0.96'),
        
        # Produce (average densities)
        'tomato': Decimal('0.65'),
        'potato': Decimal('0.77'),
        'onion': Decimal('0.57'),
        'apple': Decimal('0.61'),
        'carrot': Decimal('0.64'),
        'lettuce': Decimal('0.20'),
    }
    
    # Standard weights for countable items (in grams)
    STANDARD_WEIGHTS = {
        'egg': Decimal('50'),
        'apple': Decimal('180'),
        'banana': Decimal('120'),
        'orange': Decimal('130'),
        'potato': Decimal('150'),
        'onion': Decimal('110'),
        'tomato': Decimal('120'),
        'lemon': Decimal('60'),
        'lime': Decimal('40'),
        'avocado': Decimal('200'),
    }
    
    # Volume estimates for countable items (in ml)
    STANDARD_VOLUMES = {
        'egg': Decimal('55'),
        'apple': Decimal('295'),
        'banana': Decimal('130'),
        'orange': Decimal('200'),
        'potato': Decimal('195'),
        'onion': Decimal('190'),
        'tomato': Decimal('185'),
        'lemon': Decimal('95'),
        'lime': Decimal('65'),
        'avocado': Decimal('235'),
    }
    
    def __init__(self):
        """Initialize the calculator."""
        pass
    
    def calculate_totals(
        self,
        ingredients: List[Dict[str, any]]
    ) -> WeightVolumeResult:
        """
        Calculate total weight and volume for a list of ingredients.
        
        Args:
            ingredients: List of ingredient dicts with:
                - name: str
                - quantity: Decimal
                - unit: str
                - category: Optional[str]
                
        Returns:
            WeightVolumeResult with totals and breakdown
        """
        total_weight = Decimal('0')
        total_volume = Decimal('0')
        weight_by_category = {}
        volume_by_category = {}
        estimated_count = 0
        actual_count = len(ingredients)
        
        for ingredient in ingredients:
            name = ingredient['name'].lower()
            quantity = Decimal(str(ingredient['quantity']))
            unit = ingredient['unit'].lower()
            category = ingredient.get('category', 'Other')
            
            # Calculate weight and volume
            weight, volume, is_estimated = self._calculate_ingredient_weight_volume(
                name, quantity, unit
            )
            
            if is_estimated:
                estimated_count += 1
            
            # Add to totals
            total_weight += weight
            total_volume += volume
            
            # Add to category breakdown
            if category not in weight_by_category:
                weight_by_category[category] = Decimal('0')
                volume_by_category[category] = Decimal('0')
            
            weight_by_category[category] += weight
            volume_by_category[category] += volume
        
        # Generate transport recommendations
        recommendations = self._generate_transport_recommendations(
            total_weight, total_volume
        )
        
        return WeightVolumeResult(
            total_weight_g=total_weight,
            total_volume_ml=total_volume,
            estimated_items=estimated_count,
            actual_items=actual_count,
            weight_by_category=weight_by_category,
            volume_by_category=volume_by_category,
            transport_recommendations=recommendations
        )
    
    def _calculate_ingredient_weight_volume(
        self,
        name: str,
        quantity: Decimal,
        unit: str
    ) -> Tuple[Decimal, Decimal, bool]:
        """
        Calculate weight and volume for a single ingredient.
        
        Returns:
            Tuple of (weight_g, volume_ml, is_estimated)
        """
        # Handle weight-based units
        if unit in ['g', 'gram', 'grams']:
            weight = quantity
            volume = self._estimate_volume_from_weight(name, weight)
            return weight, volume, True
        
        elif unit in ['kg', 'kilogram', 'kilograms']:
            weight = quantity * Decimal('1000')
            volume = self._estimate_volume_from_weight(name, weight)
            return weight, volume, True
        
        # Handle volume-based units
        elif unit in ['ml', 'milliliter', 'milliliters']:
            volume = quantity
            weight = self._estimate_weight_from_volume(name, volume)
            return weight, volume, True
        
        elif unit in ['l', 'liter', 'liters']:
            volume = quantity * Decimal('1000')
            weight = self._estimate_weight_from_volume(name, volume)
            return weight, volume, True
        
        # Handle countable units
        elif unit in ['piece', 'pieces', 'unit', 'units', 'count', 'pcs']:
            weight, volume = self._estimate_countable_weight_volume(name, quantity)
            return weight, volume, True
        
        # Handle specific units
        elif unit in ['cup', 'cups']:
            volume = quantity * Decimal('237')  # US cup = 237ml
            weight = self._estimate_weight_from_volume(name, volume)
            return weight, volume, True
        
        elif unit in ['tbsp', 'tablespoon', 'tablespoons']:
            volume = quantity * Decimal('15')
            weight = self._estimate_weight_from_volume(name, volume)
            return weight, volume, True
        
        elif unit in ['tsp', 'teaspoon', 'teaspoons']:
            volume = quantity * Decimal('5')
            weight = self._estimate_weight_from_volume(name, volume)
            return weight, volume, True
        
        # Unknown unit - make a rough estimate
        else:
            # Assume it's roughly 100g per unit
            weight = quantity * Decimal('100')
            volume = quantity * Decimal('120')
            return weight, volume, True
    
    def _estimate_volume_from_weight(
        self,
        ingredient_name: str,
        weight_g: Decimal
    ) -> Decimal:
        """Estimate volume from weight using density."""
        density = self._get_density(ingredient_name)
        if density > 0:
            return weight_g / density
        return weight_g  # Fallback: assume density of 1
    
    def _estimate_weight_from_volume(
        self,
        ingredient_name: str,
        volume_ml: Decimal
    ) -> Decimal:
        """Estimate weight from volume using density."""
        density = self._get_density(ingredient_name)
        return volume_ml * density
    
    def _estimate_countable_weight_volume(
        self,
        ingredient_name: str,
        count: Decimal
    ) -> Tuple[Decimal, Decimal]:
        """Estimate weight and volume for countable items."""
        # Check standard weights first
        for key, weight in self.STANDARD_WEIGHTS.items():
            if key in ingredient_name:
                volume = self.STANDARD_VOLUMES.get(key, weight * Decimal('1.2'))
                return count * weight, count * volume
        
        # Default estimates for unknown countables
        if 'small' in ingredient_name or 'mini' in ingredient_name:
            return count * Decimal('30'), count * Decimal('35')
        elif 'large' in ingredient_name or 'big' in ingredient_name:
            return count * Decimal('200'), count * Decimal('240')
        else:
            # Medium size default
            return count * Decimal('100'), count * Decimal('120')
    
    def _get_density(self, ingredient_name: str) -> Decimal:
        """Get density for an ingredient."""
        # Check specific densities first
        for key, density in self.SPECIFIC_DENSITIES.items():
            if key in ingredient_name:
                return density
        
        # Determine ingredient type and use standard density
        ingredient_type = self._determine_ingredient_type(ingredient_name)
        return self.STANDARD_DENSITIES.get(ingredient_type, Decimal('1.0'))
    
    def _determine_ingredient_type(self, ingredient_name: str) -> IngredientType:
        """Determine the type of ingredient from its name."""
        name_lower = ingredient_name.lower()
        
        # Check for specific keywords
        if any(liquid in name_lower for liquid in ['water', 'juice', 'milk', 'broth', 'stock', 'wine', 'beer']):
            return IngredientType.LIQUID
        
        elif any(fat in name_lower for fat in ['oil', 'butter', 'margarine', 'lard', 'shortening']):
            return IngredientType.FAT
        
        elif any(protein in name_lower for protein in ['meat', 'chicken', 'beef', 'pork', 'fish', 'seafood']):
            return IngredientType.PROTEIN
        
        elif any(dairy in name_lower for dairy in ['cheese', 'yogurt', 'cream', 'dairy']):
            return IngredientType.DAIRY
        
        elif any(produce in name_lower for produce in ['vegetable', 'fruit', 'tomato', 'potato', 'carrot', 'apple']):
            return IngredientType.PRODUCE
        
        elif any(baked in name_lower for baked in ['bread', 'roll', 'bun', 'pastry', 'cake', 'cookie']):
            return IngredientType.BAKED
        
        elif any(dense in name_lower for dense in ['flour', 'sugar', 'salt', 'cocoa']):
            return IngredientType.SOLID_DENSE
        
        elif any(medium in name_lower for medium in ['rice', 'pasta', 'grain', 'cereal', 'oat']):
            return IngredientType.SOLID_MEDIUM
        
        elif any(light in name_lower for light in ['lettuce', 'spinach', 'herb', 'leaf']):
            return IngredientType.SOLID_LIGHT
        
        else:
            # Default to medium density
            return IngredientType.SOLID_MEDIUM
    
    def _generate_transport_recommendations(
        self,
        total_weight_g: Decimal,
        total_volume_ml: Decimal
    ) -> List[str]:
        """Generate recommendations for transportation."""
        recommendations = []
        
        weight_kg = total_weight_g / Decimal('1000')
        volume_l = total_volume_ml / Decimal('1000')
        
        # Weight-based recommendations
        if weight_kg <= 5:
            recommendations.append("Light load - suitable for carrying by hand")
        elif weight_kg <= 15:
            recommendations.append("Medium load - consider using a shopping cart or multiple bags")
        elif weight_kg <= 30:
            recommendations.append("Heavy load - recommended to use a car or delivery service")
        else:
            recommendations.append("Very heavy load - multiple trips or delivery service strongly recommended")
        
        # Volume-based recommendations
        if volume_l <= 10:
            recommendations.append(f"Compact volume ({volume_l:.1f}L) - fits in 2-3 shopping bags")
        elif volume_l <= 30:
            recommendations.append(f"Medium volume ({volume_l:.1f}L) - requires 4-6 shopping bags or boxes")
        elif volume_l <= 60:
            recommendations.append(f"Large volume ({volume_l:.1f}L) - requires multiple boxes or car trunk space")
        else:
            recommendations.append(f"Very large volume ({volume_l:.1f}L) - may require multiple trips")
        
        # Combined recommendations
        if weight_kg > 20 and volume_l > 40:
            recommendations.append("Consider splitting into multiple shopping trips")
        
        if weight_kg / volume_l > 1:
            recommendations.append("Dense items - ensure strong bags/containers")
        elif weight_kg / volume_l < 0.3:
            recommendations.append("Bulky items - focus on volume management")
        
        return recommendations
    
    def estimate_container_requirements(
        self,
        total_weight_g: Decimal,
        total_volume_ml: Decimal
    ) -> Dict[str, int]:
        """
        Estimate container requirements for transportation.
        
        Returns:
            Dict with container type and quantity needed
        """
        volume_l = total_volume_ml / Decimal('1000')
        weight_kg = total_weight_g / Decimal('1000')
        
        containers = {}
        
        # Shopping bags (15L capacity, 10kg weight limit)
        bags_by_volume = int((volume_l / 15) + Decimal('0.9'))  # Round up
        bags_by_weight = int((weight_kg / 10) + Decimal('0.9'))  # Round up
        containers['shopping_bags'] = max(bags_by_volume, bags_by_weight)
        
        # Storage boxes (30L capacity, 20kg weight limit)
        boxes_by_volume = int((volume_l / 30) + Decimal('0.9'))  # Round up
        boxes_by_weight = int((weight_kg / 20) + Decimal('0.9'))  # Round up
        containers['storage_boxes'] = max(boxes_by_volume, boxes_by_weight)
        
        # Cooler bags for refrigerated items (estimated 20% of total)
        cooler_volume = volume_l * Decimal('0.2')
        containers['cooler_bags'] = max(1, int((cooler_volume / 20) + Decimal('0.9')))
        
        return containers
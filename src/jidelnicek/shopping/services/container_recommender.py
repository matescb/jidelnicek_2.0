"""
Container size recommender for ingredient storage and transport.

This module provides recommendations for container sizes based on
ingredient volumes, types, and storage requirements.
"""

from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field
from decimal import Decimal
from enum import Enum
import math
import logging

from jidelnicek.shopping.utils import (
    WeightVolumeCalculator,
    IngredientType,
    StorageType
)


logger = logging.getLogger(__name__)


class ContainerType(Enum):
    """Types of containers available."""
    PLASTIC_BOX = "Plastic box"
    GLASS_JAR = "Glass jar"
    ZIP_BAG = "Zip-lock bag"
    VACUUM_BAG = "Vacuum bag"
    COOLER = "Cooler"
    INSULATED_BAG = "Insulated bag"
    PAPER_BAG = "Paper bag"
    MESH_BAG = "Mesh bag"
    BOTTLE = "Bottle"
    THERMOS = "Thermos"


class ContainerShape(Enum):
    """Container shapes for volume calculations."""
    RECTANGULAR = "rectangular"
    CYLINDRICAL = "cylindrical"
    IRREGULAR = "irregular"


@dataclass
class ContainerSize:
    """Standard container size definition."""
    name: str
    volume_ml: int
    dimensions_cm: Optional[Tuple[float, float, float]] = None  # L x W x H
    shape: ContainerShape = ContainerShape.RECTANGULAR
    typical_use: str = ""
    
    @property
    def volume_liters(self) -> float:
        """Get volume in liters."""
        return self.volume_ml / 1000
        
    @property
    def description(self) -> str:
        """Get human-readable description."""
        if self.dimensions_cm:
            l, w, h = self.dimensions_cm
            return f"{self.name} ({self.volume_liters:.1f}L, {l}x{w}x{h}cm)"
        return f"{self.name} ({self.volume_liters:.1f}L)"


@dataclass
class ContainerRecommendation:
    """Container recommendation for an ingredient or group."""
    container_type: ContainerType
    container_size: ContainerSize
    quantity_needed: int
    fill_percentage: float
    ingredient_names: List[str]
    total_volume_ml: float
    storage_type: StorageType
    notes: Optional[str] = None
    
    @property
    def total_container_volume_ml(self) -> float:
        """Get total volume of all containers."""
        return self.container_size.volume_ml * self.quantity_needed


@dataclass
class PackingPlan:
    """Complete packing plan with all containers."""
    recommendations: List[ContainerRecommendation]
    total_containers: int
    container_summary: Dict[ContainerType, int]
    cooler_space_needed_l: float
    dry_storage_volume_l: float
    notes: List[str] = field(default_factory=list)


class ContainerRecommender:
    """
    Recommends appropriate container sizes and types for ingredients.
    
    Considers factors like:
    - Ingredient volume and weight
    - Storage temperature requirements
    - Container efficiency and packing
    - Transport considerations
    """
    
    # Standard container sizes
    STANDARD_SIZES = {
        'small_box': ContainerSize(
            name="Small box",
            volume_ml=500,
            dimensions_cm=(10, 10, 5),
            typical_use="Spices, small portions"
        ),
        'medium_box': ContainerSize(
            name="Medium box",
            volume_ml=1000,
            dimensions_cm=(15, 10, 7),
            typical_use="Vegetables, snacks"
        ),
        'large_box': ContainerSize(
            name="Large box",
            volume_ml=2000,
            dimensions_cm=(20, 15, 7),
            typical_use="Meals, bulk items"
        ),
        'xl_box': ContainerSize(
            name="XL box",
            volume_ml=4000,
            dimensions_cm=(25, 20, 8),
            typical_use="Family portions"
        ),
        'small_jar': ContainerSize(
            name="Small jar",
            volume_ml=250,
            shape=ContainerShape.CYLINDRICAL,
            typical_use="Sauces, spreads"
        ),
        'medium_jar': ContainerSize(
            name="Medium jar",
            volume_ml=500,
            shape=ContainerShape.CYLINDRICAL,
            typical_use="Preserves, liquids"
        ),
        'large_jar': ContainerSize(
            name="Large jar",
            volume_ml=1000,
            shape=ContainerShape.CYLINDRICAL,
            typical_use="Bulk liquids"
        ),
        'small_bag': ContainerSize(
            name="Small zip bag",
            volume_ml=500,
            shape=ContainerShape.IRREGULAR,
            typical_use="Sandwiches, snacks"
        ),
        'medium_bag': ContainerSize(
            name="Medium zip bag",
            volume_ml=1000,
            shape=ContainerShape.IRREGULAR,
            typical_use="Fruits, vegetables"
        ),
        'large_bag': ContainerSize(
            name="Large zip bag",
            volume_ml=2000,
            shape=ContainerShape.IRREGULAR,
            typical_use="Bulk storage"
        ),
        'gallon_bag': ContainerSize(
            name="Gallon zip bag",
            volume_ml=3800,
            shape=ContainerShape.IRREGULAR,
            typical_use="Large portions"
        )
    }
    
    # Container type selection rules
    CONTAINER_RULES = {
        StorageType.FROZEN: [ContainerType.PLASTIC_BOX, ContainerType.ZIP_BAG],
        StorageType.REFRIGERATED: [ContainerType.PLASTIC_BOX, ContainerType.GLASS_JAR],
        StorageType.ROOM_TEMP: [ContainerType.PLASTIC_BOX, ContainerType.GLASS_JAR, ContainerType.PAPER_BAG],
        StorageType.COOL_DRY: [ContainerType.PLASTIC_BOX, ContainerType.GLASS_JAR],
        StorageType.PRODUCE: [ContainerType.MESH_BAG, ContainerType.PLASTIC_BOX]
    }
    
    def __init__(self, prefer_reusable: bool = True):
        """
        Initialize the container recommender.
        
        Args:
            prefer_reusable: Prefer reusable containers over disposable
        """
        self.prefer_reusable = prefer_reusable
        self.calculator = WeightVolumeCalculator()
        
    def recommend_containers(
        self,
        ingredients: List[Dict[str, Any]],
        group_by_storage: bool = True,
        max_fill_percentage: float = 0.85
    ) -> PackingPlan:
        """
        Recommend containers for a list of ingredients.
        
        Args:
            ingredients: List of ingredient dicts with name, quantity, unit, etc.
            group_by_storage: Group ingredients by storage type
            max_fill_percentage: Maximum fill level for containers (0.85 = 85%)
            
        Returns:
            PackingPlan with all recommendations
        """
        # Calculate volumes for all ingredients
        ingredient_volumes = self._calculate_ingredient_volumes(ingredients)
        
        # Group ingredients if requested
        if group_by_storage:
            grouped = self._group_by_storage(ingredient_volumes)
        else:
            # Each ingredient gets its own container
            grouped = {
                f"individual_{i}": [vol] 
                for i, vol in enumerate(ingredient_volumes)
            }
            
        # Generate recommendations for each group
        recommendations = []
        for group_key, group_volumes in grouped.items():
            recs = self._recommend_for_group(
                group_volumes,
                max_fill_percentage
            )
            recommendations.extend(recs)
            
        # Create packing plan
        plan = self._create_packing_plan(recommendations)
        
        return plan
        
    def recommend_cooler_size(
        self,
        ingredients: List[Dict[str, Any]],
        additional_ice_percentage: float = 0.3
    ) -> Dict[str, Any]:
        """
        Recommend cooler size based on cold storage needs.
        
        Args:
            ingredients: List of ingredients
            additional_ice_percentage: Extra space for ice (0.3 = 30%)
            
        Returns:
            Dict with cooler recommendations
        """
        # Get volumes for cold items
        cold_volumes = []
        for ing in ingredients:
            storage_type = self._determine_storage_type(ing)
            if storage_type in [StorageType.FROZEN, StorageType.REFRIGERATED]:
                volume = self._calculate_single_volume(ing)
                if volume:
                    cold_volumes.append(volume)
                    
        # Calculate total cold storage volume
        total_cold_ml = sum(v['volume_ml'] for v in cold_volumes)
        ice_volume_ml = total_cold_ml * additional_ice_percentage
        total_with_ice_ml = total_cold_ml + ice_volume_ml
        
        # Recommend cooler sizes
        return self._recommend_cooler_sizes(total_with_ice_ml)
        
    def optimize_packing(
        self,
        container_recommendations: List[ContainerRecommendation],
        available_space: Optional[Dict[str, float]] = None
    ) -> Dict[str, Any]:
        """
        Optimize packing arrangement for transport.
        
        Args:
            container_recommendations: List of container recommendations
            available_space: Available space constraints (L x W x H in cm)
            
        Returns:
            Optimized packing arrangement
        """
        # Group by storage temperature
        temp_groups = {
            'frozen': [],
            'cold': [],
            'room_temp': []
        }
        
        for rec in container_recommendations:
            if rec.storage_type == StorageType.FROZEN:
                temp_groups['frozen'].append(rec)
            elif rec.storage_type in [StorageType.REFRIGERATED, StorageType.PRODUCE]:
                temp_groups['cold'].append(rec)
            else:
                temp_groups['room_temp'].append(rec)
                
        # Calculate space requirements
        space_requirements = {}
        for temp, recs in temp_groups.items():
            total_volume = sum(
                r.total_container_volume_ml 
                for r in recs
            ) / 1000  # Convert to liters
            space_requirements[temp] = total_volume
            
        # Packing suggestions
        suggestions = []
        
        if space_requirements['frozen'] > 0 or space_requirements['cold'] > 0:
            cooler_size = space_requirements['frozen'] + space_requirements['cold']
            suggestions.append(
                f"Cooler space needed: {cooler_size:.1f}L "
                f"({space_requirements['frozen']:.1f}L frozen, "
                f"{space_requirements['cold']:.1f}L refrigerated)"
            )
            
        if space_requirements['room_temp'] > 0:
            suggestions.append(
                f"Dry storage needed: {space_requirements['room_temp']:.1f}L"
            )
            
        # Check against available space if provided
        if available_space:
            available_volume = (
                available_space.get('length', 50) *
                available_space.get('width', 40) *
                available_space.get('height', 30)
            ) / 1000  # cm³ to liters
            
            total_needed = sum(space_requirements.values())
            if total_needed > available_volume:
                suggestions.append(
                    f"⚠️ Space warning: Need {total_needed:.1f}L but only "
                    f"{available_volume:.1f}L available"
                )
                
        return {
            'space_requirements': space_requirements,
            'suggestions': suggestions,
            'temp_groups': {k: len(v) for k, v in temp_groups.items()}
        }
        
    def _calculate_ingredient_volumes(
        self,
        ingredients: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Calculate volumes for all ingredients."""
        volumes = []
        
        for ing in ingredients:
            volume_data = self._calculate_single_volume(ing)
            if volume_data:
                volumes.append(volume_data)
                
        return volumes
        
    def _calculate_single_volume(
        self,
        ingredient: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Calculate volume for a single ingredient."""
        # Determine ingredient type
        ing_type = self._determine_ingredient_type(ingredient)
        
        # Use calculator to get weight and volume
        result = self.calculator.calculate_totals([ingredient])
        
        if result.total_volume_ml <= 0:
            return None
            
        return {
            'name': ingredient['name'],
            'quantity': ingredient['quantity'],
            'unit': ingredient['unit'],
            'volume_ml': float(result.total_volume_ml),
            'weight_g': float(result.total_weight_g) if result.total_weight_g > 0 else None,
            'storage_type': self._determine_storage_type(ingredient),
            'ingredient_type': ing_type
        }
        
    def _group_by_storage(
        self,
        ingredient_volumes: List[Dict[str, Any]]
    ) -> Dict[str, List[Dict[str, Any]]]:
        """Group ingredients by storage type."""
        groups = {}
        
        for vol in ingredient_volumes:
            storage = vol['storage_type']
            if storage not in groups:
                groups[storage] = []
            groups[storage].append(vol)
            
        return groups
        
    def _recommend_for_group(
        self,
        group_volumes: List[Dict[str, Any]],
        max_fill_percentage: float
    ) -> List[ContainerRecommendation]:
        """Generate container recommendations for a group of ingredients."""
        if not group_volumes:
            return []
            
        # Get storage type from first item
        storage_type = group_volumes[0]['storage_type']
        container_types = self.CONTAINER_RULES.get(storage_type, [ContainerType.PLASTIC_BOX])
        
        # Prefer reusable containers if set
        if self.prefer_reusable:
            container_type = container_types[0]
        else:
            # Prefer bags for some items
            if ContainerType.ZIP_BAG in container_types:
                container_type = ContainerType.ZIP_BAG
            else:
                container_type = container_types[0]
                
        # Calculate total volume
        total_volume_ml = sum(v['volume_ml'] for v in group_volumes)
        ingredient_names = [v['name'] for v in group_volumes]
        
        # Find appropriate container sizes
        recommendations = []
        remaining_volume = total_volume_ml
        
        # Try to fit in standard sizes, largest first
        sorted_sizes = sorted(
            self.STANDARD_SIZES.values(),
            key=lambda s: s.volume_ml,
            reverse=True
        )
        
        for size in sorted_sizes:
            if remaining_volume <= 0:
                break
                
            # Calculate how many of this size we need
            usable_volume = size.volume_ml * max_fill_percentage
            if remaining_volume >= usable_volume * 0.5:  # At least 50% efficient
                containers_needed = math.ceil(remaining_volume / usable_volume)
                
                # Create recommendation
                rec = ContainerRecommendation(
                    container_type=container_type,
                    container_size=size,
                    quantity_needed=containers_needed,
                    fill_percentage=min(
                        remaining_volume / (size.volume_ml * containers_needed),
                        max_fill_percentage
                    ),
                    ingredient_names=ingredient_names if len(recommendations) == 0 else [],
                    total_volume_ml=min(remaining_volume, usable_volume * containers_needed),
                    storage_type=storage_type
                )
                
                recommendations.append(rec)
                remaining_volume -= usable_volume * containers_needed
                
        # If we couldn't fit everything, use the smallest container for remainder
        if remaining_volume > 0:
            smallest_size = sorted_sizes[-1]
            containers_needed = math.ceil(remaining_volume / (smallest_size.volume_ml * max_fill_percentage))
            
            rec = ContainerRecommendation(
                container_type=container_type,
                container_size=smallest_size,
                quantity_needed=containers_needed,
                fill_percentage=remaining_volume / (smallest_size.volume_ml * containers_needed),
                ingredient_names=[],
                total_volume_ml=remaining_volume,
                storage_type=storage_type,
                notes="Additional containers for overflow"
            )
            
            recommendations.append(rec)
            
        return recommendations
        
    def _create_packing_plan(
        self,
        recommendations: List[ContainerRecommendation]
    ) -> PackingPlan:
        """Create a complete packing plan from recommendations."""
        # Count containers by type
        container_summary = {}
        total_containers = 0
        
        for rec in recommendations:
            if rec.container_type not in container_summary:
                container_summary[rec.container_type] = 0
            container_summary[rec.container_type] += rec.quantity_needed
            total_containers += rec.quantity_needed
            
        # Calculate storage volumes
        cooler_volume = 0
        dry_volume = 0
        
        for rec in recommendations:
            if rec.storage_type in [StorageType.FROZEN, StorageType.REFRIGERATED]:
                cooler_volume += rec.total_container_volume_ml
            else:
                dry_volume += rec.total_container_volume_ml
                
        # Add notes
        notes = []
        if cooler_volume > 10000:  # More than 10L
            notes.append(f"Consider using multiple coolers for {cooler_volume/1000:.1f}L of cold items")
            
        if total_containers > 20:
            notes.append("Large number of containers - consider consolidating items")
            
        return PackingPlan(
            recommendations=recommendations,
            total_containers=total_containers,
            container_summary=container_summary,
            cooler_space_needed_l=cooler_volume / 1000,
            dry_storage_volume_l=dry_volume / 1000,
            notes=notes
        )
        
    def _determine_storage_type(self, ingredient: Dict[str, Any]) -> StorageType:
        """Determine storage type for an ingredient."""
        # Could be enhanced with actual categorization logic
        name_lower = ingredient['name'].lower()
        
        if any(word in name_lower for word in ['frozen', 'ice']):
            return StorageType.FROZEN
        elif any(word in name_lower for word in ['milk', 'cheese', 'yogurt', 'cream', 'butter', 'meat', 'fish', 'chicken']):
            return StorageType.REFRIGERATED
        elif any(word in name_lower for word in ['tomato', 'lettuce', 'cucumber', 'carrot', 'apple', 'banana']):
            return StorageType.PRODUCE
        else:
            return StorageType.ROOM_TEMP
            
    def _determine_ingredient_type(self, ingredient: Dict[str, Any]) -> IngredientType:
        """Determine ingredient type for volume calculations."""
        name_lower = ingredient['name'].lower()
        
        if any(word in name_lower for word in ['oil', 'milk', 'juice', 'sauce', 'soup', 'broth', 'water']):
            return IngredientType.LIQUID
        elif any(word in name_lower for word in ['flour', 'sugar', 'salt', 'powder']):
            return IngredientType.SOLID_DENSE
        elif any(word in name_lower for word in ['rice', 'pasta', 'grain', 'cereal']):
            return IngredientType.SOLID_MEDIUM
        elif any(word in name_lower for word in ['lettuce', 'spinach', 'herbs', 'salad']):
            return IngredientType.SOLID_LIGHT
        elif any(word in name_lower for word in ['meat', 'chicken', 'fish', 'beef', 'pork']):
            return IngredientType.PROTEIN
        elif any(word in name_lower for word in ['cheese', 'yogurt', 'cream']):
            return IngredientType.DAIRY
        elif any(word in name_lower for word in ['tomato', 'apple', 'banana', 'carrot', 'potato']):
            return IngredientType.PRODUCE
        elif any(word in name_lower for word in ['bread', 'cake', 'pastry', 'cookie']):
            return IngredientType.BAKED
        else:
            return IngredientType.SOLID_MEDIUM
            
    def _recommend_cooler_sizes(self, total_volume_ml: float) -> Dict[str, Any]:
        """Recommend appropriate cooler sizes."""
        volume_l = total_volume_ml / 1000
        
        # Standard cooler sizes
        cooler_sizes = [
            {'name': 'Personal cooler', 'capacity_l': 5, 'description': 'Day trips'},
            {'name': 'Small cooler', 'capacity_l': 15, 'description': '1-2 people, weekend'},
            {'name': 'Medium cooler', 'capacity_l': 30, 'description': '3-4 people, weekend'},
            {'name': 'Large cooler', 'capacity_l': 50, 'description': '5-6 people, weekend'},
            {'name': 'XL cooler', 'capacity_l': 75, 'description': 'Week-long trips'},
            {'name': 'XXL cooler', 'capacity_l': 100, 'description': 'Extended trips'}
        ]
        
        # Find appropriate size
        recommended = None
        for cooler in cooler_sizes:
            if volume_l <= cooler['capacity_l'] * 0.85:  # 85% capacity
                recommended = cooler
                break
                
        if not recommended:
            recommended = cooler_sizes[-1]  # Largest available
            
        return {
            'volume_needed_l': volume_l,
            'recommended_cooler': recommended,
            'fill_percentage': (volume_l / recommended['capacity_l']) * 100,
            'ice_space_included': True,
            'alternative': 'Consider multiple smaller coolers' if volume_l > 50 else None
        }
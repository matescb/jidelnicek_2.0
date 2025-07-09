"""
Recipe scaling service for preview and calculation.

This service provides methods to preview recipe scaling with different
strategies including basic scaling, calorie-based scaling, and
participant-based scaling.
"""

from typing import Dict, List, Optional, Any
from decimal import Decimal
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from jidelnicek.core.exceptions import NotFoundError, ValidationError
from jidelnicek.recipe.models.recipe import Recipe
from jidelnicek.recipe.models.ingredient import RecipeIngredient
from jidelnicek.recipe.utils.scaling import RecipeScaler, CalorieScaler, ParticipantScaler
from jidelnicek.recipe.utils.rounding import SmartRounder
from jidelnicek.recipe.utils.constraints import ScalingConstraints
from jidelnicek.recipe.utils.scaling_validator import ScalingValidator, validate_scaling_operation
from jidelnicek.recipe.utils.scaling_edge_cases import ScalingEdgeCaseHandler, handle_scaling_edge_cases


class ScalingService:
    """Service for recipe scaling operations."""
    
    def __init__(self, db_session: AsyncSession):
        """Initialize the scaling service."""
        self.db = db_session
        self.base_scaler = RecipeScaler(use_rounding=True, use_constraints=True, use_validation=True)
        self.calorie_scaler = CalorieScaler(use_rounding=True, use_constraints=True, use_validation=True)
        self.participant_scaler = ParticipantScaler(use_rounding=True, use_constraints=True, use_validation=True)
        self.rounder = SmartRounder()
        self.constraints = ScalingConstraints()
        self.validator = ScalingValidator()
        self.edge_case_handler = ScalingEdgeCaseHandler()
    
    async def get_recipe_with_ingredients(self, recipe_id: UUID) -> Recipe:
        """Get recipe with all ingredients loaded."""
        query = select(Recipe).where(
            Recipe.id == recipe_id
        ).options(
            selectinload(Recipe.recipe_ingredients).selectinload(RecipeIngredient.ingredient)
        )
        
        result = await self.db.execute(query)
        recipe = result.scalar_one_or_none()
        
        if not recipe:
            raise NotFoundError(f"Recipe with id {recipe_id} not found")
        
        return recipe
    
    async def preview_recipe_scaling(
        self,
        recipe_id: UUID,
        target_servings: int,
        use_rounding: bool = True,
        use_constraints: bool = True
    ) -> Dict[str, Any]:
        """
        Preview basic recipe scaling.
        
        Args:
            recipe_id: Recipe to scale
            target_servings: Target number of servings
            use_rounding: Whether to apply intelligent rounding
            use_constraints: Whether to apply scaling constraints
            
        Returns:
            Preview data with original and scaled quantities
        """
        try:
            # Sanitize request first
            request_data = {
                'type': 'basic',
                'target_servings': target_servings
            }
            sanitized_request, sanitize_warnings = self.edge_case_handler.sanitize_scaling_request(
                request_data, 'basic'
            )
            target_servings = sanitized_request.get('target_servings', target_servings)
            
            # Validate sanitized request
            is_valid, errors, request_warnings = validate_scaling_operation('request', sanitized_request)
            if not is_valid:
                raise ValidationError("; ".join(errors))
            
            # Combine warnings
            all_warnings = sanitize_warnings + request_warnings
            
            recipe = await self.get_recipe_with_ingredients(recipe_id)
            
            # Handle zero participants edge case
            if target_servings == 0:
                zero_result = self.edge_case_handler.handle_zero_participants(
                    target_servings, recipe.servings
                )
                if zero_result.handled:
                    all_warnings.extend(zero_result.warnings)
            
            # Configure scaler with validation
            scaler = RecipeScaler(use_rounding=use_rounding, use_constraints=use_constraints, use_validation=True)
        
        # Prepare ingredients data
        ingredients = []
        for ri in recipe.recipe_ingredients:
            ingredients.append({
                'name': ri.ingredient.name,
                'quantity': ri.quantity,
                'unit': ri.unit
            })
        
        # Calculate scaling
        if use_constraints:
            result = scaler.scale_recipe_with_constraints(
                original_servings=recipe.servings,
                target_participants=target_servings,
                ingredient_quantities=[ing['quantity'] for ing in ingredients]
            )
            scaling_factor = result['scaling_factor']
            scaled_quantities = result['scaled_quantities']
            warnings = result.get('warnings', [])
        else:
            scaling_factor, scaled_quantities = scaler.scale_recipe(
                original_servings=recipe.servings,
                target_participants=target_servings,
                ingredient_quantities=[ing['quantity'] for ing in ingredients]
            )
            warnings = []
            
            # Add all accumulated warnings
            warnings.extend(all_warnings)
        
        # Build preview response
        ingredient_previews = []
        for i, (orig_ing, scaled_qty) in enumerate(zip(ingredients, scaled_quantities)):
            preview = {
                'name': orig_ing['name'],
                'original_quantity': float(orig_ing['quantity']),
                'scaled_quantity': float(scaled_qty),
                'unit': orig_ing['unit'],
                'was_rounded': use_rounding
            }
            
            # Add rounding details if applicable
            if use_rounding:
                unrounded = orig_ing['quantity'] * scaling_factor
                preview['unrounded_quantity'] = float(unrounded)
                preview['rounding_difference'] = float(scaled_qty - unrounded)
            
            ingredient_previews.append(preview)
        
        return {
            'recipe_id': str(recipe_id),
            'recipe_name': recipe.title,
            'original_servings': recipe.servings,
            'target_servings': target_servings,
            'scaling_factor': float(scaling_factor),
            'ingredients': ingredient_previews,
            'warnings': warnings,
            'constraints_applied': use_constraints,
            'rounding_applied': use_rounding
        }
        
        except Exception as e:
            # Provide graceful degradation
            context = {
                'recipe_id': recipe_id,
                'recipe_name': 'Unknown Recipe',
                'original_servings': 4,
                'ingredients': []
            }
            
            # Try to get recipe info if possible
            try:
                recipe = await self.get_recipe_with_ingredients(recipe_id)
                context['recipe_name'] = recipe.title
                context['original_servings'] = recipe.servings
            except:
                pass
            
            return self.edge_case_handler.provide_graceful_degradation(e, context)
    
    async def preview_calorie_scaling(
        self,
        recipe_id: UUID,
        target_calories: Decimal,
        target_servings: int = 1
    ) -> Dict[str, Any]:
        """
        Preview calorie-based recipe scaling.
        
        Args:
            recipe_id: Recipe to scale
            target_calories: Target calories per serving
            target_servings: Number of servings (default: 1)
            
        Returns:
            Preview data with calorie calculations
        """
        # Validate request
        request_data = {
            'type': 'calorie',
            'target_calories': float(target_calories),
            'target_servings': target_servings
        }
        is_valid, errors, request_warnings = validate_scaling_operation('request', request_data)
        if not is_valid:
            raise ValidationError("; ".join(errors))
        
        recipe = await self.get_recipe_with_ingredients(recipe_id)
        
        # Prepare recipe data with nutritional info
        recipe_data = {
            'servings': recipe.servings,
            'ingredients': []
        }
        
        for ri in recipe.recipe_ingredients:
            ingredient_data = {
                'name': ri.ingredient.name,
                'quantity': ri.quantity,
                'unit': ri.unit,
                'nutritional_value': {}
            }
            
            # Get nutritional value if available
            if ri.ingredient.nutritional_value:
                nv = ri.ingredient.nutritional_value
                ingredient_data['nutritional_value'] = {
                    'calories': nv.calories,
                    'proteins': nv.proteins,
                    'carbohydrates': nv.carbohydrates,
                    'fats': nv.fats
                }
            
            recipe_data['ingredients'].append(ingredient_data)
        
        # Scale to target calories
        result = self.calorie_scaler.scale_recipe_to_target_calories(
            recipe_data=recipe_data,
            target_calories=target_calories,
            target_servings=target_servings
        )
        
        # Calculate nutritional totals
        total_calories = self.calorie_scaler.calculate_recipe_calories(recipe_data['ingredients'])
        calories_per_serving = self.calorie_scaler.calculate_calories_per_serving(
            total_calories, recipe.servings
        )
        
        scaled_total_calories = self.calorie_scaler.calculate_recipe_calories(result['ingredients'])
        scaled_calories_per_serving = self.calorie_scaler.calculate_calories_per_serving(
            scaled_total_calories, target_servings
        )
        
        return {
            'recipe_id': str(recipe_id),
            'recipe_name': recipe.title,
            'original_servings': recipe.servings,
            'target_servings': target_servings,
            'target_calories': float(target_calories),
            'original_calories_total': float(total_calories),
            'original_calories_per_serving': float(calories_per_serving),
            'scaled_calories_total': float(scaled_total_calories),
            'scaled_calories_per_serving': float(scaled_calories_per_serving),
            'scaling_factor': float(result['scaling_factor']),
            'ingredients': result['ingredients'],
            'warnings': result.get('warnings', []) + request_warnings
        }
    
    async def preview_participant_scaling(
        self,
        recipe_id: UUID,
        participants: List[Dict[str, Any]],
        meal_type: Optional[str] = None,
        target_calories_per_person: Optional[Decimal] = None
    ) -> Dict[str, Any]:
        """
        Preview participant-based recipe scaling.
        
        Args:
            recipe_id: Recipe to scale
            participants: List of participant data with coefficients
            meal_type: Optional meal type for meal-specific coefficients
            target_calories_per_person: Optional calorie target per standard participant
            
        Returns:
            Preview data with participant calculations
        """
        try:
            # Sanitize request first
            request_data = {
                'type': 'participant',
                'participants': participants,
                'target_calories_per_person': float(target_calories_per_person) if target_calories_per_person else None
            }
            sanitized_request, sanitize_warnings = self.edge_case_handler.sanitize_scaling_request(
                request_data, 'participant'
            )
            participants = sanitized_request.get('participants', participants)
            
            # Validate sanitized request
            is_valid, errors, request_warnings = validate_scaling_operation('request', sanitized_request)
            if not is_valid:
                raise ValidationError("; ".join(errors))
            
            # Combine warnings
            all_warnings = sanitize_warnings + request_warnings
            
            recipe = await self.get_recipe_with_ingredients(recipe_id)
            
            # Calculate effective participants
            effective_participants = self.participant_scaler.calculate_effective_participants(
                participants=participants,
                meal_type=meal_type
            )
            
            # Prepare recipe data
            recipe_data = {
                'servings': recipe.servings,
                'ingredients': []
            }
            
            for ri in recipe.recipe_ingredients:
                ingredient_data = {
                    'name': ri.ingredient.name,
                    'quantity': ri.quantity,
                    'unit': ri.unit
                }
                
                # Add nutritional data if doing calorie scaling
                if target_calories_per_person and ri.ingredient.nutritional_value:
                    nv = ri.ingredient.nutritional_value
                    ingredient_data['nutritional_value'] = {
                        'calories': nv.calories
                    }
                
                recipe_data['ingredients'].append(ingredient_data)
            
            # Scale based on method
            if target_calories_per_person:
                result = self.participant_scaler.scale_recipe_for_participant_calories(
                    recipe_data=recipe_data,
                    participants=participants,
                    target_calories_per_person=target_calories_per_person,
                    meal_type=meal_type
                )
            else:
                result = self.participant_scaler.scale_recipe_for_participants(
                    recipe_data=recipe_data,
                    participants=participants,
                    meal_type=meal_type
                )
            
            # Build participant breakdown
            participant_details = []
            for p in participants:
                coefficient = p.get('coefficient', 100) / 100
                
                # Apply meal-specific coefficient if available
                if meal_type and 'meal_coefficients' in p:
                    meal_coef = p['meal_coefficients'].get(meal_type, 100) / 100
                    coefficient *= meal_coef
                
                # Apply attendance factor if present
                if 'attendance_factor' in p:
                    coefficient *= p['attendance_factor']
                
                participant_details.append({
                    'name': p.get('name', 'Participant'),
                    'base_coefficient': p.get('coefficient', 100),
                    'meal_coefficient': p.get('meal_coefficients', {}).get(meal_type, 100) if meal_type else None,
                    'attendance_factor': p.get('attendance_factor', 1.0),
                    'effective_coefficient': coefficient * 100,
                    'calories_allocated': result.get('calorie_distribution', {}).get(
                        p.get('name', 'Participant'), 0
                    ) if target_calories_per_person else None
                })
            
            response = {
                'recipe_id': str(recipe_id),
                'recipe_name': recipe.title,
                'original_servings': recipe.servings,
                'participant_count': len(participants),
                'effective_participants': float(effective_participants),
                'meal_type': meal_type,
                'scaling_factor': float(result['scaling_factor']),
                'ingredients': result['ingredients'],
                'participant_details': participant_details,
                'warnings': result.get('warnings', []) + all_warnings
            }
            
            if target_calories_per_person:
                response['target_calories_per_person'] = float(target_calories_per_person)
                response['total_calories'] = float(result.get('total_calories', 0))
                response['calories_per_effective_participant'] = float(
                    result.get('calories_per_effective_participant', 0)
                )
            
            return response
            
        except Exception as e:
            # Provide graceful degradation
            context = {
                'recipe_id': recipe_id,
                'recipe_name': 'Unknown Recipe',
                'original_servings': 4,
                'ingredients': [],
                'participants': participants
            }
            
            # Try to get recipe info if possible
            try:
                recipe = await self.get_recipe_with_ingredients(recipe_id)
                context['recipe_name'] = recipe.title
                context['original_servings'] = recipe.servings
            except:
                pass
            
            return self.edge_case_handler.provide_graceful_degradation(e, context)
"""
Text exporter for trips.

Provides plain text export with:
- Trip overview and summary
- Daily meal plans with recipes
- Shopping lists with categories
- Nutritional analysis
- Czech and English language support
"""

import io
from typing import Dict, Any, Optional, List
from datetime import datetime, date
from decimal import Decimal
import logging


logger = logging.getLogger(__name__)


class TripTextExporter:
    """
    Text exporter for trip documentation.
    
    Creates well-formatted plain text files with:
    - Trip summary
    - Daily meal plans
    - Recipe details
    - Shopping lists
    - Nutritional information
    """
    
    def __init__(self, options: Optional[Dict[str, Any]] = None):
        """
        Initialize text exporter.
        
        Args:
            options: Export options including:
                - language: 'cs' or 'en'
                - include_recipes: Include full recipe details
                - include_nutrition: Include nutritional data
                - include_shopping: Include shopping lists
                - include_packing: Include packing recommendations
                - compact: Use compact formatting
                - currency: Currency symbol
        """
        self.options = options or {}
        self.language = self.options.get('language', 'cs')
        self.currency = self.options.get('currency', 'Kč')
        self.compact = self.options.get('compact', False)
        
        # Translations
        self.translations = self._get_translations()
        
    def export(self, trip_data: Dict[str, Any]) -> bytes:
        """
        Export trip data to text.
        
        Args:
            trip_data: Complete trip data including:
                - trip: Trip information
                - days: List of days with meals
                - recipes: Recipe details
                - shopping_list: Aggregated shopping data
                - participants: Participant list
                - nutrition: Nutritional analysis
                
        Returns:
            Text file as bytes
        """
        buffer = io.StringIO()
        
        # Header
        self._write_header(buffer, trip_data)
        
        # Table of contents
        if not self.compact and self.options.get('include_toc', True):
            self._write_toc(buffer, trip_data)
        
        # Trip overview
        self._write_trip_overview(buffer, trip_data)
        
        # Daily plans
        self._write_daily_plans(buffer, trip_data)
        
        # Recipes
        if self.options.get('include_recipes', True) and 'recipes' in trip_data:
            self._write_recipes(buffer, trip_data)
        
        # Shopping list
        if self.options.get('include_shopping', True) and 'shopping_list' in trip_data:
            self._write_shopping_list(buffer, trip_data)
        
        # Nutrition
        if self.options.get('include_nutrition', True) and 'nutrition' in trip_data:
            self._write_nutrition(buffer, trip_data)
        
        # Packing
        if self.options.get('include_packing', True) and 'packing' in trip_data:
            self._write_packing(buffer, trip_data)
        
        # Footer
        self._write_footer(buffer, trip_data)
        
        # Convert to bytes
        content = buffer.getvalue()
        return content.encode('utf-8')
    
    def _write_header(self, buffer: io.StringIO, trip_data: Dict[str, Any]):
        """Write document header."""
        trip = trip_data.get('trip', {})
        title = trip.get('name', self._t('Trip'))
        
        if not self.compact:
            buffer.write("=" * 80 + "\n")
            buffer.write(f"{title.center(80)}\n")
            buffer.write("=" * 80 + "\n\n")
        else:
            buffer.write(f"{title}\n")
            buffer.write("=" * len(title) + "\n\n")
    
    def _write_toc(self, buffer: io.StringIO, trip_data: Dict[str, Any]):
        """Write table of contents."""
        buffer.write(f"{self._t('Table of Contents')}\n")
        buffer.write("-" * 40 + "\n")
        
        buffer.write(f"1. {self._t('Trip Overview')}\n")
        buffer.write(f"2. {self._t('Daily Plans')}\n")
        
        if self.options.get('include_recipes', True):
            buffer.write(f"3. {self._t('Recipes')}\n")
        
        if self.options.get('include_shopping', True):
            buffer.write(f"4. {self._t('Shopping List')}\n")
        
        if self.options.get('include_nutrition', True):
            buffer.write(f"5. {self._t('Nutritional Information')}\n")
        
        if self.options.get('include_packing', True):
            buffer.write(f"6. {self._t('Packing Recommendations')}\n")
        
        buffer.write("\n\n")
    
    def _write_trip_overview(self, buffer: io.StringIO, trip_data: Dict[str, Any]):
        """Write trip overview section."""
        trip = trip_data.get('trip', {})
        
        buffer.write(f"\n{self._t('Trip Overview')}\n")
        buffer.write("=" * 40 + "\n\n")
        
        # Basic info
        if trip.get('description'):
            buffer.write(f"{trip['description']}\n\n")
        
        buffer.write(f"{self._t('Start Date')}: {self._format_date(trip.get('start_date'))}\n")
        buffer.write(f"{self._t('End Date')}: {self._format_date(trip.get('end_date'))}\n")
        buffer.write(f"{self._t('Duration')}: {trip.get('day_count', 0)} {self._t('days')}\n")
        
        # Participants
        participants = trip_data.get('participants', [])
        if participants:
            buffer.write(f"\n{self._t('Participants')} ({len(participants)}):\n")
            for p in participants:
                buffer.write(f"- {p.get('name', 'Unknown')}")
                if p.get('diet_restrictions'):
                    buffer.write(f" ({', '.join(p['diet_restrictions'])})")
                buffer.write("\n")
        
        buffer.write("\n")
    
    def _write_daily_plans(self, buffer: io.StringIO, trip_data: Dict[str, Any]):
        """Write daily meal plans."""
        days = trip_data.get('days', [])
        
        buffer.write(f"\n{self._t('Daily Plans')}\n")
        buffer.write("=" * 40 + "\n\n")
        
        for day in days:
            # Day header
            day_num = day.get('day_number', 0)
            day_date = self._format_date(day.get('date'))
            buffer.write(f"{self._t('Day')} {day_num} - {day_date}\n")
            buffer.write("-" * 30 + "\n")
            
            # Meals
            meals = day.get('meals', [])
            for meal in meals:
                meal_type = self._t(meal.get('meal_type', 'Meal'))
                buffer.write(f"\n{meal_type}:\n")
                
                # Recipes
                recipes = meal.get('recipes', [])
                for recipe in recipes:
                    recipe_name = recipe.get('name', 'Unknown')
                    servings = recipe.get('servings', 1)
                    buffer.write(f"  • {recipe_name} ({servings} {self._t('servings')})\n")
                    
                    # Optional: Add brief recipe info
                    if not self.compact and recipe.get('prep_time'):
                        prep_time = recipe.get('prep_time', 0)
                        cook_time = recipe.get('cook_time', 0)
                        total_time = prep_time + cook_time
                        buffer.write(f"    {self._t('Time')}: {total_time} min\n")
            
            buffer.write("\n")
    
    def _write_recipes(self, buffer: io.StringIO, trip_data: Dict[str, Any]):
        """Write detailed recipes."""
        recipes = trip_data.get('recipes', {})
        
        buffer.write(f"\n{self._t('Recipes')}\n")
        buffer.write("=" * 40 + "\n\n")
        
        for recipe_id, recipe in recipes.items():
            # Recipe header
            buffer.write(f"{recipe.get('name', 'Unknown')}\n")
            buffer.write("-" * 30 + "\n")
            
            # Basic info
            servings = recipe.get('servings', 1)
            prep_time = recipe.get('prep_time', 0)
            cook_time = recipe.get('cook_time', 0)
            
            buffer.write(f"{self._t('Servings')}: {servings}\n")
            buffer.write(f"{self._t('Prep Time')}: {prep_time} min\n")
            buffer.write(f"{self._t('Cook Time')}: {cook_time} min\n")
            
            if recipe.get('difficulty'):
                buffer.write(f"{self._t('Difficulty')}: {self._t(recipe['difficulty'])}\n")
            
            # Ingredients
            buffer.write(f"\n{self._t('Ingredients')}:\n")
            ingredients = recipe.get('ingredients', [])
            for ing in ingredients:
                amount = ing.get('amount', '')
                unit = ing.get('unit', '')
                name = ing.get('name', '')
                
                if amount:
                    buffer.write(f"  • {amount}")
                    if unit:
                        buffer.write(f" {unit}")
                    buffer.write(f" {name}\n")
                else:
                    buffer.write(f"  • {name}\n")
            
            # Instructions
            buffer.write(f"\n{self._t('Instructions')}:\n")
            instructions = recipe.get('instructions', [])
            for i, step in enumerate(instructions, 1):
                buffer.write(f"  {i}. {step}\n")
            
            # Notes
            if recipe.get('notes'):
                buffer.write(f"\n{self._t('Notes')}:\n")
                buffer.write(f"  {recipe['notes']}\n")
            
            buffer.write("\n")
    
    def _write_shopping_list(self, buffer: io.StringIO, trip_data: Dict[str, Any]):
        """Write shopping list."""
        shopping = trip_data.get('shopping_list', {})
        
        buffer.write(f"\n{self._t('Shopping List')}\n")
        buffer.write("=" * 40 + "\n\n")
        
        categories = shopping.get('categories', {})
        
        for category, items in categories.items():
            if items:
                buffer.write(f"{self._t(category)}:\n")
                
                for item in items:
                    name = item.get('name', '')
                    amount = item.get('total_amount', 0)
                    unit = item.get('unit', '')
                    
                    buffer.write(f"  □ {name}")
                    if amount:
                        buffer.write(f" - {amount}")
                        if unit:
                            buffer.write(f" {unit}")
                    buffer.write("\n")
                
                buffer.write("\n")
        
        # Summary
        summary = shopping.get('summary', {})
        if summary:
            buffer.write(f"{self._t('Summary')}:\n")
            buffer.write(f"  {self._t('Total Items')}: {summary.get('total_items', 0)}\n")
            
            if summary.get('estimated_cost'):
                cost = summary['estimated_cost']
                buffer.write(f"  {self._t('Estimated Cost')}: {cost} {self.currency}\n")
            
            buffer.write("\n")
    
    def _write_nutrition(self, buffer: io.StringIO, trip_data: Dict[str, Any]):
        """Write nutritional information."""
        nutrition = trip_data.get('nutrition', {})
        
        buffer.write(f"\n{self._t('Nutritional Information')}\n")
        buffer.write("=" * 40 + "\n\n")
        
        # Daily averages
        averages = nutrition.get('daily_averages', {})
        if averages:
            buffer.write(f"{self._t('Daily Averages')}:\n")
            
            nutrients = [
                ('calories', 'Calories', 'kcal'),
                ('proteins', 'Proteins', 'g'),
                ('carbs', 'Carbohydrates', 'g'),
                ('fats', 'Fats', 'g'),
                ('fiber', 'Fiber', 'g'),
                ('sugar', 'Sugar', 'g'),
                ('sodium', 'Sodium', 'mg')
            ]
            
            for key, label, unit in nutrients:
                if key in averages:
                    value = averages[key]
                    buffer.write(f"  {self._t(label)}: {value:.1f} {unit}\n")
            
            buffer.write("\n")
        
        # Per-day breakdown
        daily = nutrition.get('daily', {})
        if daily and not self.compact:
            buffer.write(f"{self._t('Daily Breakdown')}:\n")
            
            for day_num, day_nutrition in sorted(daily.items()):
                buffer.write(f"\n  {self._t('Day')} {day_num}:\n")
                
                for key, label, unit in nutrients[:4]:  # Show only main nutrients
                    if key in day_nutrition:
                        value = day_nutrition[key]
                        buffer.write(f"    {self._t(label)}: {value:.1f} {unit}\n")
            
            buffer.write("\n")
    
    def _write_packing(self, buffer: io.StringIO, trip_data: Dict[str, Any]):
        """Write packing recommendations."""
        packing = trip_data.get('packing', {})
        
        buffer.write(f"\n{self._t('Packing Recommendations')}\n")
        buffer.write("=" * 40 + "\n\n")
        
        # Containers
        containers = packing.get('containers', [])
        if containers:
            buffer.write(f"{self._t('Recommended Containers')}:\n")
            
            for container in containers:
                ctype = container.get('type', '')
                size = container.get('size', '')
                qty = container.get('quantity', 1)
                
                buffer.write(f"  • {qty}x {self._t(ctype)}")
                if size:
                    buffer.write(f" ({size})")
                
                if container.get('for_items'):
                    items = container['for_items']
                    buffer.write(f"\n    {self._t('For')}: {', '.join(items)}")
                
                buffer.write("\n")
            
            buffer.write("\n")
        
        # Cooler recommendation
        if packing.get('cooler_size'):
            size = packing['cooler_size']
            buffer.write(f"{self._t('Recommended Cooler Size')}: {size}L\n")
        
        # Additional items
        if packing.get('additional_items'):
            buffer.write(f"\n{self._t('Additional Items')}:\n")
            for item in packing['additional_items']:
                buffer.write(f"  • {self._t(item)}\n")
        
        buffer.write("\n")
    
    def _write_footer(self, buffer: io.StringIO, trip_data: Dict[str, Any]):
        """Write document footer."""
        if not self.compact:
            buffer.write("\n" + "-" * 80 + "\n")
            buffer.write(f"{self._t('Generated on')} {datetime.now().strftime('%Y-%m-%d %H:%M')}\n")
            buffer.write(f"{self._t('Jídelníček 2.0 - Your Trip Planner')}\n")
    
    def _format_date(self, date_value: Any) -> str:
        """Format date for display."""
        if isinstance(date_value, str):
            try:
                date_obj = datetime.fromisoformat(date_value.replace('Z', '+00:00'))
                date_value = date_obj.date()
            except:
                return date_value
        
        if isinstance(date_value, (date, datetime)):
            if self.language == 'cs':
                return date_value.strftime('%-d. %-m. %Y')
            else:
                return date_value.strftime('%B %d, %Y')
        
        return str(date_value)
    
    def _t(self, text: str) -> str:
        """Translate text based on language setting."""
        return self.translations.get(text, text)
    
    def _get_translations(self) -> Dict[str, str]:
        """Get translations for the current language."""
        if self.language == 'cs':
            return {
                # Sections
                'Trip': 'Výlet',
                'Table of Contents': 'Obsah',
                'Trip Overview': 'Přehled výletu',
                'Daily Plans': 'Denní plány',
                'Recipes': 'Recepty',
                'Shopping List': 'Nákupní seznam',
                'Nutritional Information': 'Nutriční informace',
                'Packing Recommendations': 'Doporučení k balení',
                
                # Trip info
                'Start Date': 'Začátek',
                'End Date': 'Konec',
                'Duration': 'Délka',
                'days': 'dní',
                'Participants': 'Účastníci',
                'Day': 'Den',
                
                # Meals
                'Breakfast': 'Snídaně',
                'Lunch': 'Oběd',
                'Dinner': 'Večeře',
                'Snack': 'Svačina',
                'Meal': 'Jídlo',
                
                # Recipe
                'Servings': 'Porce',
                'servings': 'porcí',
                'Prep Time': 'Příprava',
                'Cook Time': 'Vaření',
                'Time': 'Čas',
                'Difficulty': 'Obtížnost',
                'easy': 'snadné',
                'medium': 'střední',
                'hard': 'těžké',
                'Ingredients': 'Ingredience',
                'Instructions': 'Postup',
                'Notes': 'Poznámky',
                
                # Shopping
                'Summary': 'Souhrn',
                'Total Items': 'Celkem položek',
                'Estimated Cost': 'Odhadovaná cena',
                
                # Categories
                'Zelenina': 'Zelenina',
                'Ovoce': 'Ovoce',
                'Maso': 'Maso',
                'Mléčné výrobky': 'Mléčné výrobky',
                'Pečivo': 'Pečivo',
                'Koření': 'Koření',
                'Ostatní': 'Ostatní',
                
                # Nutrition
                'Daily Averages': 'Denní průměry',
                'Daily Breakdown': 'Denní rozpis',
                'Calories': 'Kalorie',
                'Proteins': 'Bílkoviny',
                'Carbohydrates': 'Sacharidy',
                'Fats': 'Tuky',
                'Fiber': 'Vláknina',
                'Sugar': 'Cukr',
                'Sodium': 'Sodík',
                
                # Packing
                'Recommended Containers': 'Doporučené nádoby',
                'For': 'Pro',
                'Recommended Cooler Size': 'Doporučená velikost chladicího boxu',
                'Additional Items': 'Další položky',
                
                # Container types
                'plastic container': 'plastová nádoba',
                'glass container': 'skleněná nádoba',
                'vacuum container': 'vakuová nádoba',
                'bag': 'sáček',
                'bottle': 'láhev',
                
                # Footer
                'Generated on': 'Vygenerováno',
                'Jídelníček 2.0 - Your Trip Planner': 'Jídelníček 2.0 - Váš plánovač výletů'
            }
        else:
            # English (default)
            return {}
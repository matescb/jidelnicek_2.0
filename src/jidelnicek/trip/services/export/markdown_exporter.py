"""
Markdown exporter for trips.

Provides markdown export with:
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


class TripMarkdownExporter:
    """
    Markdown exporter for trip documentation.
    
    Creates well-formatted markdown files with:
    - Trip summary with metadata
    - Daily meal plans with links
    - Recipe details with formatting
    - Shopping lists with checkboxes
    - Nutritional tables
    - Packing checklists
    """
    
    def __init__(self, options: Optional[Dict[str, Any]] = None):
        """
        Initialize markdown exporter.
        
        Args:
            options: Export options including:
                - language: 'cs' or 'en'
                - include_recipes: Include full recipe details
                - include_nutrition: Include nutritional data
                - include_shopping: Include shopping lists
                - include_packing: Include packing recommendations
                - compact: Use compact formatting
                - currency: Currency symbol
                - include_toc: Include table of contents
        """
        self.options = options or {}
        self.language = self.options.get('language', 'cs')
        self.currency = self.options.get('currency', 'Kč')
        self.compact = self.options.get('compact', False)
        
        # Translations
        self.translations = self._get_translations()
        
    def export(self, trip_data: Dict[str, Any]) -> bytes:
        """
        Export trip data to markdown.
        
        Args:
            trip_data: Complete trip data including:
                - trip: Trip information
                - days: List of days with meals
                - recipes: Recipe details
                - shopping_list: Aggregated shopping data
                - participants: Participant list
                - nutrition: Nutritional analysis
                - packing: Packing recommendations
                
        Returns:
            Markdown file as bytes
        """
        buffer = io.StringIO()
        
        # Header
        self._write_header(buffer, trip_data)
        
        # Metadata
        self._write_metadata(buffer, trip_data)
        
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
        
        buffer.write(f"# {title}\n\n")
        
        if trip.get('description') and not self.compact:
            buffer.write(f"> {trip['description']}\n\n")
    
    def _write_metadata(self, buffer: io.StringIO, trip_data: Dict[str, Any]):
        """Write document metadata."""
        if self.compact:
            return
            
        trip = trip_data.get('trip', {})
        
        buffer.write("---\n")
        buffer.write(f"title: {trip.get('name', 'Trip')}\n")
        buffer.write(f"date: {datetime.now().strftime('%Y-%m-%d')}\n")
        buffer.write(f"language: {self.language}\n")
        buffer.write("---\n\n")
    
    def _write_toc(self, buffer: io.StringIO, trip_data: Dict[str, Any]):
        """Write table of contents."""
        buffer.write(f"## {self._t('Table of Contents')}\n\n")
        
        buffer.write(f"1. [{self._t('Trip Overview')}](#trip-overview)\n")
        buffer.write(f"2. [{self._t('Daily Plans')}](#daily-plans)\n")
        
        if self.options.get('include_recipes', True):
            buffer.write(f"3. [{self._t('Recipes')}](#recipes)\n")
        
        if self.options.get('include_shopping', True):
            buffer.write(f"4. [{self._t('Shopping List')}](#shopping-list)\n")
        
        if self.options.get('include_nutrition', True):
            buffer.write(f"5. [{self._t('Nutritional Information')}](#nutritional-information)\n")
        
        if self.options.get('include_packing', True):
            buffer.write(f"6. [{self._t('Packing Recommendations')}](#packing-recommendations)\n")
        
        buffer.write("\n")
    
    def _write_trip_overview(self, buffer: io.StringIO, trip_data: Dict[str, Any]):
        """Write trip overview section."""
        trip = trip_data.get('trip', {})
        
        buffer.write(f"## {self._t('Trip Overview')}\n\n")
        
        # Info table
        buffer.write("| | |\n")
        buffer.write("|---|---|\n")
        buffer.write(f"| **{self._t('Start Date')}** | {self._format_date(trip.get('start_date'))} |\n")
        buffer.write(f"| **{self._t('End Date')}** | {self._format_date(trip.get('end_date'))} |\n")
        buffer.write(f"| **{self._t('Duration')}** | {trip.get('day_count', 0)} {self._t('days')} |\n")
        
        participants = trip_data.get('participants', [])
        if participants:
            buffer.write(f"| **{self._t('Participants')}** | {len(participants)} |\n")
        
        buffer.write("\n")
        
        # Participants list
        if participants and not self.compact:
            buffer.write(f"### {self._t('Participants')}\n\n")
            for p in participants:
                name = p.get('name', 'Unknown')
                buffer.write(f"- **{name}**")
                
                if p.get('diet_restrictions'):
                    restrictions = ', '.join(p['diet_restrictions'])
                    buffer.write(f" _(_{restrictions}__)_")
                
                buffer.write("\n")
            
            buffer.write("\n")
    
    def _write_daily_plans(self, buffer: io.StringIO, trip_data: Dict[str, Any]):
        """Write daily meal plans."""
        days = trip_data.get('days', [])
        
        buffer.write(f"## {self._t('Daily Plans')}\n\n")
        
        for day in days:
            # Day header
            day_num = day.get('day_number', 0)
            day_date = self._format_date(day.get('date'))
            buffer.write(f"### {self._t('Day')} {day_num} - {day_date}\n\n")
            
            # Meals
            meals = day.get('meals', [])
            for meal in meals:
                meal_type = self._t(meal.get('meal_type', 'Meal'))
                buffer.write(f"#### {meal_type}\n\n")
                
                # Recipes
                recipes = meal.get('recipes', [])
                for recipe in recipes:
                    recipe_id = recipe.get('id', '')
                    recipe_name = recipe.get('name', 'Unknown')
                    servings = recipe.get('servings', 1)
                    
                    # Link to recipe section if included
                    if self.options.get('include_recipes', True) and recipe_id:
                        anchor = self._make_anchor(recipe_name)
                        buffer.write(f"- [{recipe_name}](#{anchor}) ")
                    else:
                        buffer.write(f"- {recipe_name} ")
                    
                    buffer.write(f"*({servings} {self._t('servings')})*\n")
                    
                    # Optional: Add brief recipe info
                    if not self.compact and recipe.get('prep_time'):
                        prep_time = recipe.get('prep_time', 0)
                        cook_time = recipe.get('cook_time', 0)
                        total_time = prep_time + cook_time
                        buffer.write(f"  - {self._t('Time')}: {total_time} min\n")
                
                buffer.write("\n")
            
            if not self.compact:
                buffer.write("---\n\n")
    
    def _write_recipes(self, buffer: io.StringIO, trip_data: Dict[str, Any]):
        """Write detailed recipes."""
        recipes = trip_data.get('recipes', {})
        
        buffer.write(f"## {self._t('Recipes')}\n\n")
        
        for recipe_id, recipe in recipes.items():
            # Recipe header with anchor
            recipe_name = recipe.get('name', 'Unknown')
            anchor = self._make_anchor(recipe_name)
            buffer.write(f"### <a name=\"{anchor}\"></a>{recipe_name}\n\n")
            
            # Info badges
            servings = recipe.get('servings', 1)
            prep_time = recipe.get('prep_time', 0)
            cook_time = recipe.get('cook_time', 0)
            total_time = prep_time + cook_time
            
            badges = []
            badges.append(f"**{self._t('Servings')}:** {servings}")
            badges.append(f"**{self._t('Time')}:** {total_time} min")
            
            if recipe.get('difficulty'):
                difficulty = self._t(recipe['difficulty'])
                badges.append(f"**{self._t('Difficulty')}:** {difficulty}")
            
            buffer.write(" | ".join(badges) + "\n\n")
            
            # Ingredients
            buffer.write(f"#### {self._t('Ingredients')}\n\n")
            ingredients = recipe.get('ingredients', [])
            
            for ing in ingredients:
                amount = ing.get('amount', '')
                unit = ing.get('unit', '')
                name = ing.get('name', '')
                
                buffer.write("- ")
                if amount:
                    buffer.write(f"**{amount}")
                    if unit:
                        buffer.write(f" {unit}")
                    buffer.write("** ")
                buffer.write(f"{name}\n")
            
            buffer.write("\n")
            
            # Instructions
            buffer.write(f"#### {self._t('Instructions')}\n\n")
            instructions = recipe.get('instructions', [])
            
            for i, step in enumerate(instructions, 1):
                buffer.write(f"{i}. {step}\n")
            
            buffer.write("\n")
            
            # Notes
            if recipe.get('notes'):
                buffer.write(f"#### {self._t('Notes')}\n\n")
                buffer.write(f"> {recipe['notes']}\n\n")
            
            # Nutrition info
            if recipe.get('nutrition') and self.options.get('include_nutrition', True):
                nutrition = recipe['nutrition']
                buffer.write(f"#### {self._t('Nutrition per serving')}\n\n")
                
                buffer.write("| | |\n")
                buffer.write("|---|---|\n")
                
                nutrients = [
                    ('calories', 'Calories', 'kcal'),
                    ('proteins', 'Proteins', 'g'),
                    ('carbs', 'Carbohydrates', 'g'),
                    ('fats', 'Fats', 'g'),
                    ('fiber', 'Fiber', 'g')
                ]
                
                for key, label, unit in nutrients:
                    if key in nutrition:
                        value = nutrition[key]
                        buffer.write(f"| {self._t(label)} | {value:.1f} {unit} |\n")
                
                buffer.write("\n")
            
            if not self.compact:
                buffer.write("---\n\n")
    
    def _write_shopping_list(self, buffer: io.StringIO, trip_data: Dict[str, Any]):
        """Write shopping list."""
        shopping = trip_data.get('shopping_list', {})
        
        buffer.write(f"## {self._t('Shopping List')}\n\n")
        
        categories = shopping.get('categories', {})
        
        for category, items in categories.items():
            if items:
                buffer.write(f"### {self._t(category)}\n\n")
                
                for item in items:
                    name = item.get('name', '')
                    amount = item.get('total_amount', 0)
                    unit = item.get('unit', '')
                    
                    buffer.write(f"- [ ] **{name}**")
                    if amount:
                        buffer.write(f" - {amount}")
                        if unit:
                            buffer.write(f" {unit}")
                    
                    # Add recipe references if available
                    if item.get('recipes') and not self.compact:
                        recipes = ', '.join(item['recipes'])
                        buffer.write(f" _(_{recipes}__)_")
                    
                    buffer.write("\n")
                
                buffer.write("\n")
        
        # Summary
        summary = shopping.get('summary', {})
        if summary:
            buffer.write(f"### {self._t('Summary')}\n\n")
            
            buffer.write("| | |\n")
            buffer.write("|---|---|\n")
            buffer.write(f"| **{self._t('Total Items')}** | {summary.get('total_items', 0)} |\n")
            
            if summary.get('estimated_cost'):
                cost = summary['estimated_cost']
                buffer.write(f"| **{self._t('Estimated Cost')}** | {cost} {self.currency} |\n")
            
            if summary.get('total_weight'):
                weight = summary['total_weight']
                buffer.write(f"| **{self._t('Total Weight')}** | {weight:.1f} kg |\n")
            
            buffer.write("\n")
    
    def _write_nutrition(self, buffer: io.StringIO, trip_data: Dict[str, Any]):
        """Write nutritional information."""
        nutrition = trip_data.get('nutrition', {})
        
        buffer.write(f"## {self._t('Nutritional Information')}\n\n")
        
        # Daily averages
        averages = nutrition.get('daily_averages', {})
        if averages:
            buffer.write(f"### {self._t('Daily Averages')}\n\n")
            
            buffer.write("| | | |\n")
            buffer.write("|---|---|---|\n")
            
            nutrients = [
                ('calories', 'Calories', 'kcal'),
                ('proteins', 'Proteins', 'g'),
                ('carbs', 'Carbohydrates', 'g'),
                ('fats', 'Fats', 'g'),
                ('fiber', 'Fiber', 'g'),
                ('sugar', 'Sugar', 'g'),
                ('sodium', 'Sodium', 'mg')
            ]
            
            # Display in two columns
            for i in range(0, len(nutrients), 2):
                row = "| "
                
                # First nutrient
                if i < len(nutrients):
                    key, label, unit = nutrients[i]
                    if key in averages:
                        value = averages[key]
                        row += f"**{self._t(label)}** | {value:.1f} {unit} | "
                    else:
                        row += " | | "
                
                # Second nutrient
                if i + 1 < len(nutrients):
                    key, label, unit = nutrients[i + 1]
                    if key in averages:
                        value = averages[key]
                        row += f"**{self._t(label)}** | {value:.1f} {unit} |"
                    else:
                        row += " | |"
                else:
                    row += " | |"
                
                buffer.write(row + "\n")
            
            buffer.write("\n")
        
        # Per-day breakdown
        daily = nutrition.get('daily', {})
        if daily and not self.compact:
            buffer.write(f"### {self._t('Daily Breakdown')}\n\n")
            
            # Create table
            buffer.write(f"| {self._t('Day')} | {self._t('Calories')} | {self._t('Proteins')} | "
                        f"{self._t('Carbohydrates')} | {self._t('Fats')} |\n")
            buffer.write("|---|---|---|---|---|\n")
            
            for day_num, day_nutrition in sorted(daily.items()):
                calories = day_nutrition.get('calories', 0)
                proteins = day_nutrition.get('proteins', 0)
                carbs = day_nutrition.get('carbs', 0)
                fats = day_nutrition.get('fats', 0)
                
                buffer.write(f"| {self._t('Day')} {day_num} | {calories:.0f} kcal | "
                           f"{proteins:.1f} g | {carbs:.1f} g | {fats:.1f} g |\n")
            
            buffer.write("\n")
        
        # Nutritional balance
        if averages and not self.compact:
            buffer.write(f"### {self._t('Nutritional Balance')}\n\n")
            
            total_cal = averages.get('calories', 2000)
            protein_cal = averages.get('proteins', 0) * 4
            carb_cal = averages.get('carbs', 0) * 4
            fat_cal = averages.get('fats', 0) * 9
            
            if total_cal > 0:
                protein_pct = (protein_cal / total_cal) * 100
                carb_pct = (carb_cal / total_cal) * 100
                fat_pct = (fat_cal / total_cal) * 100
                
                buffer.write(f"- **{self._t('Proteins')}**: {protein_pct:.1f}%\n")
                buffer.write(f"- **{self._t('Carbohydrates')}**: {carb_pct:.1f}%\n")
                buffer.write(f"- **{self._t('Fats')}**: {fat_pct:.1f}%\n")
                
                buffer.write("\n")
    
    def _write_packing(self, buffer: io.StringIO, trip_data: Dict[str, Any]):
        """Write packing recommendations."""
        packing = trip_data.get('packing', {})
        
        buffer.write(f"## {self._t('Packing Recommendations')}\n\n")
        
        # Containers
        containers = packing.get('containers', [])
        if containers:
            buffer.write(f"### {self._t('Recommended Containers')}\n\n")
            
            for container in containers:
                ctype = container.get('type', '')
                size = container.get('size', '')
                qty = container.get('quantity', 1)
                
                buffer.write(f"- [ ] **{qty}x** {self._t(ctype)}")
                
                if size:
                    buffer.write(f" ({size})")
                
                if container.get('for_items'):
                    items = ', '.join(container['for_items'])
                    buffer.write(f"\n  - {self._t('For')}: _{items}_")
                
                buffer.write("\n")
            
            buffer.write("\n")
        
        # Cooler recommendation
        if packing.get('cooler_size'):
            size = packing['cooler_size']
            buffer.write(f"### {self._t('Cooler')}\n\n")
            buffer.write(f"- **{self._t('Recommended Cooler Size')}**: {size}L\n\n")
        
        # Additional items
        if packing.get('additional_items'):
            buffer.write(f"### {self._t('Additional Items')}\n\n")
            
            for item in packing['additional_items']:
                buffer.write(f"- [ ] {self._t(item)}\n")
            
            buffer.write("\n")
        
        # Checklist summary
        if not self.compact:
            total_items = len(containers) + len(packing.get('additional_items', []))
            if packing.get('cooler_size'):
                total_items += 1
            
            buffer.write(f"> **{self._t('Total packing items')}**: {total_items}\n\n")
    
    def _write_footer(self, buffer: io.StringIO, trip_data: Dict[str, Any]):
        """Write document footer."""
        if not self.compact:
            buffer.write("---\n\n")
            buffer.write(f"*{self._t('Generated on')} {datetime.now().strftime('%Y-%m-%d %H:%M')}*\n")
            buffer.write(f"*{self._t('Jídelníček 2.0 - Your Trip Planner')}*\n")
    
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
    
    def _make_anchor(self, text: str) -> str:
        """Create URL-safe anchor from text."""
        # Simple slug creation
        anchor = text.lower()
        anchor = anchor.replace(' ', '-')
        anchor = ''.join(c for c in anchor if c.isalnum() or c == '-')
        return anchor
    
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
                'Nutrition per serving': 'Výživové hodnoty na porci',
                
                # Shopping
                'Summary': 'Souhrn',
                'Total Items': 'Celkem položek',
                'Estimated Cost': 'Odhadovaná cena',
                'Total Weight': 'Celková hmotnost',
                
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
                'Nutritional Balance': 'Nutriční bilance',
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
                'Cooler': 'Chladicí box',
                'Recommended Cooler Size': 'Doporučená velikost chladicího boxu',
                'Additional Items': 'Další položky',
                'Total packing items': 'Celkem položek k zabalení',
                
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
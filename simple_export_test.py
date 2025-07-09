#!/usr/bin/env python3
"""
Simple test for export functionality without full app dependencies.
"""

import sys
import io
from typing import Dict, Any
from datetime import datetime, timedelta

# Simple stub for the text exporter functionality
class SimpleTextExporter:
    """Basic text exporter to test functionality."""
    
    def __init__(self, options=None):
        self.options = options or {}
        self.language = self.options.get('language', 'en')
        
    def export(self, trip_data: Dict[str, Any]) -> bytes:
        """Export trip data to text."""
        buffer = io.StringIO()
        
        # Header
        trip = trip_data.get('trip', {})
        title = trip.get('name', 'Trip')
        
        buffer.write(f"{'='*80}\n")
        buffer.write(f"{title.center(80)}\n")
        buffer.write(f"{'='*80}\n\n")
        
        # Trip overview
        buffer.write("Trip Overview\n")
        buffer.write("="*40 + "\n\n")
        
        if trip.get('description'):
            buffer.write(f"{trip['description']}\n\n")
        
        buffer.write(f"Start Date: {trip.get('start_date', 'N/A')}\n")
        buffer.write(f"End Date: {trip.get('end_date', 'N/A')}\n")
        buffer.write(f"Duration: {trip.get('day_count', 0)} days\n")
        
        # Participants
        participants = trip_data.get('participants', [])
        if participants:
            buffer.write(f"\nParticipants ({len(participants)}):\n")
            for p in participants:
                buffer.write(f"- {p.get('name', 'Unknown')}")
                if p.get('diet_restrictions'):
                    buffer.write(f" ({', '.join(p['diet_restrictions'])})")
                buffer.write("\n")
        
        # Daily plans
        days = trip_data.get('days', [])
        if days:
            buffer.write(f"\nDaily Plans\n")
            buffer.write("="*40 + "\n\n")
            
            for day in days:
                day_num = day.get('day_number', 0)
                buffer.write(f"Day {day_num}\n")
                buffer.write("-"*30 + "\n")
                
                meals = day.get('meals', [])
                for meal in meals:
                    meal_type = meal.get('meal_type', 'Meal')
                    buffer.write(f"\n{meal_type}:\n")
                    
                    recipes = meal.get('recipes', [])
                    for recipe in recipes:
                        recipe_name = recipe.get('name', 'Unknown')
                        servings = recipe.get('servings', 1)
                        buffer.write(f"  • {recipe_name} ({servings} servings)\n")
                
                buffer.write("\n")
        
        # Recipes
        if self.options.get('include_recipes', True) and 'recipes' in trip_data:
            buffer.write(f"\nRecipes\n")
            buffer.write("="*40 + "\n\n")
            
            recipes = trip_data.get('recipes', {})
            for recipe_id, recipe in recipes.items():
                buffer.write(f"{recipe.get('name', 'Unknown')}\n")
                buffer.write("-"*30 + "\n")
                
                buffer.write(f"Servings: {recipe.get('servings', 1)}\n")
                buffer.write(f"Prep Time: {recipe.get('prep_time', 0)} min\n")
                buffer.write(f"Cook Time: {recipe.get('cook_time', 0)} min\n")
                
                # Ingredients
                buffer.write(f"\nIngredients:\n")
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
                buffer.write(f"\nInstructions:\n")
                instructions = recipe.get('instructions', [])
                for i, step in enumerate(instructions, 1):
                    buffer.write(f"  {i}. {step}\n")
                
                buffer.write("\n")
        
        # Footer
        buffer.write(f"\n{'-'*80}\n")
        buffer.write(f"Generated on {datetime.now().strftime('%Y-%m-%d %H:%M')}\n")
        
        content = buffer.getvalue()
        return content.encode('utf-8')

class SimpleMarkdownExporter:
    """Basic markdown exporter to test functionality."""
    
    def __init__(self, options=None):
        self.options = options or {}
        self.language = self.options.get('language', 'en')
        
    def export(self, trip_data: Dict[str, Any]) -> bytes:
        """Export trip data to markdown."""
        buffer = io.StringIO()
        
        # Header
        trip = trip_data.get('trip', {})
        title = trip.get('name', 'Trip')
        
        buffer.write(f"# {title}\n\n")
        
        if trip.get('description'):
            buffer.write(f"> {trip['description']}\n\n")
        
        # Trip overview
        buffer.write("## Trip Overview\n\n")
        
        # Info table
        buffer.write("| | |\n")
        buffer.write("|---|---|\n")
        buffer.write(f"| **Start Date** | {trip.get('start_date', 'N/A')} |\n")
        buffer.write(f"| **End Date** | {trip.get('end_date', 'N/A')} |\n")
        buffer.write(f"| **Duration** | {trip.get('day_count', 0)} days |\n")
        
        participants = trip_data.get('participants', [])
        if participants:
            buffer.write(f"| **Participants** | {len(participants)} |\n")
        
        buffer.write("\n")
        
        # Participants list
        if participants:
            buffer.write("### Participants\n\n")
            for p in participants:
                name = p.get('name', 'Unknown')
                buffer.write(f"- **{name}**")
                
                if p.get('diet_restrictions'):
                    restrictions = ', '.join(p['diet_restrictions'])
                    buffer.write(f" _(_{restrictions}__)_")
                
                buffer.write("\n")
            
            buffer.write("\n")
        
        # Daily plans
        days = trip_data.get('days', [])
        if days:
            buffer.write("## Daily Plans\n\n")
            
            for day in days:
                day_num = day.get('day_number', 0)
                buffer.write(f"### Day {day_num}\n\n")
                
                meals = day.get('meals', [])
                for meal in meals:
                    meal_type = meal.get('meal_type', 'Meal')
                    buffer.write(f"#### {meal_type}\n\n")
                    
                    recipes = meal.get('recipes', [])
                    for recipe in recipes:
                        recipe_name = recipe.get('name', 'Unknown')
                        servings = recipe.get('servings', 1)
                        buffer.write(f"- {recipe_name} *({servings} servings)*\n")
                
                buffer.write("\n")
        
        # Recipes
        if self.options.get('include_recipes', True) and 'recipes' in trip_data:
            buffer.write("## Recipes\n\n")
            
            recipes = trip_data.get('recipes', {})
            for recipe_id, recipe in recipes.items():
                recipe_name = recipe.get('name', 'Unknown')
                buffer.write(f"### {recipe_name}\n\n")
                
                servings = recipe.get('servings', 1)
                prep_time = recipe.get('prep_time', 0)
                cook_time = recipe.get('cook_time', 0)
                
                buffer.write(f"**Servings:** {servings} | **Prep Time:** {prep_time} min | **Cook Time:** {cook_time} min\n\n")
                
                # Ingredients
                buffer.write("#### Ingredients\n\n")
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
                buffer.write("#### Instructions\n\n")
                instructions = recipe.get('instructions', [])
                for i, step in enumerate(instructions, 1):
                    buffer.write(f"{i}. {step}\n")
                
                buffer.write("\n")
        
        # Footer
        buffer.write("---\n\n")
        buffer.write(f"*Generated on {datetime.now().strftime('%Y-%m-%d %H:%M')}*\n")
        
        content = buffer.getvalue()
        return content.encode('utf-8')

def create_test_trip_data():
    """Create sample trip data for testing."""
    start_date = datetime.now()
    
    trip_data = {
        'trip': {
            'id': '11111111-1111-1111-1111-111111111111',
            'name': 'Test Trip - Summer 2024',
            'start_date': start_date.strftime('%Y-%m-%d'),
            'end_date': (start_date + timedelta(days=2)).strftime('%Y-%m-%d'),
            'day_count': 3,
            'participant_count': 2,
            'location': 'Mountains',
            'description': 'Family vacation in nature'
        },
        'participants': [
            {
                'name': 'John Doe',
                'age_group': 'adult',
                'diet_restrictions': []
            },
            {
                'name': 'Jane Doe',
                'age_group': 'adult',
                'diet_restrictions': ['vegetarian']
            }
        ],
        'days': [
            {
                'day_number': 1,
                'date': start_date.strftime('%Y-%m-%d'),
                'meals': [
                    {
                        'meal_type': 'Breakfast',
                        'recipes': [
                            {
                                'id': 'recipe1',
                                'name': 'Oatmeal with fruits',
                                'servings': 2,
                                'prep_time': 10,
                                'cook_time': 5
                            }
                        ]
                    }
                ]
            }
        ],
        'recipes': {
            'recipe1': {
                'name': 'Oatmeal with fruits',
                'servings': 2,
                'prep_time': 10,
                'cook_time': 5,
                'difficulty': 'easy',
                'ingredients': [
                    {'amount': 100, 'unit': 'g', 'name': 'oats'},
                    {'amount': 400, 'unit': 'ml', 'name': 'milk'},
                    {'amount': 2, 'unit': 'pcs', 'name': 'apples'},
                    {'amount': 1, 'unit': 'tbsp', 'name': 'honey'}
                ],
                'instructions': [
                    'Pour milk over oats and bring to boil.',
                    'Cook for 5 minutes while stirring.',
                    'Add chopped apples and honey.'
                ],
                'notes': 'You can use other fruits according to season.'
            }
        }
    }
    
    return trip_data

def test_text_export():
    """Test text export functionality."""
    print("Testing Text Export...")
    
    try:
        # Basic export
        exporter = SimpleTextExporter()
        trip_data = create_test_trip_data()
        result = exporter.export(trip_data)
        
        print(f"✓ Basic export: {len(result)} bytes")
        
        # Check content
        content = result.decode('utf-8')
        assert 'Test Trip - Summer 2024' in content
        assert 'John Doe' in content
        assert 'Jane Doe' in content
        assert 'Oatmeal with fruits' in content
        print("✓ Content check passed")
        
        # Test with options
        exporter = SimpleTextExporter({'include_recipes': True})
        result = exporter.export(trip_data)
        content = result.decode('utf-8')
        assert 'Recipes' in content
        assert 'oats' in content
        print("✓ Options test passed")
        
        # Test UTF-8 encoding
        trip_data['trip']['name'] = 'Test Trip - České znaky ěščřžýáíé'
        result = exporter.export(trip_data)
        content = result.decode('utf-8')
        assert 'České znaky ěščřžýáíé' in content
        print("✓ UTF-8 encoding test passed")
        
        return True
        
    except Exception as e:
        print(f"✗ Text export failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_markdown_export():
    """Test markdown export functionality."""
    print("\nTesting Markdown Export...")
    
    try:
        # Basic export
        exporter = SimpleMarkdownExporter()
        trip_data = create_test_trip_data()
        result = exporter.export(trip_data)
        
        print(f"✓ Basic export: {len(result)} bytes")
        
        # Check content
        content = result.decode('utf-8')
        assert '# Test Trip - Summer 2024' in content
        assert 'John Doe' in content
        assert 'Jane Doe' in content
        print("✓ Content check passed")
        
        # Check markdown formatting
        assert '## ' in content  # Headers
        assert '### ' in content  # Subheaders
        assert '| ' in content   # Tables
        assert '- ' in content   # Lists
        assert '**' in content   # Bold text
        print("✓ Markdown formatting check passed")
        
        # Test with options
        exporter = SimpleMarkdownExporter({'include_recipes': True})
        result = exporter.export(trip_data)
        content = result.decode('utf-8')
        assert '## Recipes' in content
        assert '#### Ingredients' in content
        print("✓ Options test passed")
        
        # Test UTF-8 encoding
        trip_data['trip']['name'] = 'Test Trip - České znaky ěščřžýáíé'
        result = exporter.export(trip_data)
        content = result.decode('utf-8')
        assert 'České znaky ěščřžýáíé' in content
        print("✓ UTF-8 encoding test passed")
        
        return True
        
    except Exception as e:
        print(f"✗ Markdown export failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_template_flexibility():
    """Test template flexibility."""
    print("\nTesting Template Flexibility...")
    
    try:
        # Test optional sections
        trip_data = create_test_trip_data()
        
        # Test with recipes disabled
        exporter = SimpleTextExporter({'include_recipes': False})
        result = exporter.export(trip_data)
        content = result.decode('utf-8')
        # Should not contain recipe details but should still work
        assert 'Test Trip - Summer 2024' in content
        print("✓ Optional sections test passed")
        
        # Test different languages
        exporter = SimpleTextExporter({'language': 'cs'})
        result = exporter.export(trip_data)
        content = result.decode('utf-8')
        assert len(content) > 0
        print("✓ Language options test passed")
        
        return True
        
    except Exception as e:
        print(f"✗ Template flexibility failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Run all tests."""
    print("=== Simple Text/Markdown Export Tests ===")
    
    tests = [
        test_text_export,
        test_markdown_export,
        test_template_flexibility
    ]
    
    passed = 0
    failed = 0
    
    for test_func in tests:
        if test_func():
            passed += 1
        else:
            failed += 1
    
    print(f"\n=== Test Results ===")
    print(f"Passed: {passed}")
    print(f"Failed: {failed}")
    print(f"Total: {passed + failed}")
    
    if failed == 0:
        print("✓ All tests passed!")
        return True
    else:
        print(f"✗ {failed} tests failed")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
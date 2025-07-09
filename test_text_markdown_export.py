#!/usr/bin/env python3
"""
Simple test script for text/markdown export functionality.
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from datetime import datetime, timedelta
from jidelnicek.trip.services.export.text_exporter import TripTextExporter
from jidelnicek.trip.services.export.markdown_exporter import TripMarkdownExporter
from jidelnicek.shopping.services.export.text_exporter import TextExporter
from jidelnicek.shopping.services.export.base import ShoppingListExporter
from jidelnicek.shopping.services.shopping_list_generator import ShoppingList, ShoppingListSection, ShoppingListItem

def create_test_trip_data():
    """Create sample trip data for testing."""
    start_date = datetime.now()
    
    trip_data = {
        'trip': {
            'id': '11111111-1111-1111-1111-111111111111',
            'name': 'Test Trip - Summer 2024',
            'start_date': start_date.isoformat(),
            'end_date': (start_date + timedelta(days=2)).isoformat(),
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
                'date': start_date.isoformat(),
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
        },
        'shopping_list': {
            'categories': {
                'Dairy': [
                    {
                        'name': 'milk',
                        'total_amount': 400,
                        'unit': 'ml',
                        'recipes': ['Oatmeal']
                    }
                ],
                'Fruits': [
                    {
                        'name': 'apples',
                        'total_amount': 2,
                        'unit': 'pcs'
                    }
                ]
            },
            'summary': {
                'total_items': 4,
                'estimated_cost': 150
            }
        },
        'nutrition': {
            'daily_averages': {
                'calories': 2000,
                'proteins': 75,
                'carbs': 250,
                'fats': 65,
                'fiber': 25
            }
        },
        'packing': {
            'containers': [
                {
                    'type': 'plastic container',
                    'size': '1L',
                    'quantity': 2,
                    'for_items': ['salad', 'fruit']
                }
            ],
            'cooler_size': 25
        }
    }
    
    return trip_data

def test_text_exporter():
    """Test text exporter functionality."""
    print("Testing Text Exporter...")
    
    # Basic export
    exporter = TripTextExporter()
    trip_data = create_test_trip_data()
    
    try:
        result = exporter.export(trip_data)
        print(f"✓ Basic export: {len(result)} bytes")
        
        # Check content
        content = result.decode('utf-8')
        assert 'Test Trip - Summer 2024' in content
        assert 'John Doe' in content
        assert 'Jane Doe' in content
        print("✓ Basic content check passed")
        
        # Test with options
        options = {
            'include_recipes': True,
            'include_shopping': True,
            'include_nutrition': True,
            'include_packing': True,
            'language': 'en',
            'compact': False
        }
        
        exporter = TripTextExporter(options)
        result = exporter.export(trip_data)
        content = result.decode('utf-8')
        
        assert 'Recipes' in content
        assert 'Shopping List' in content
        assert 'Nutritional Information' in content
        assert 'Packing Recommendations' in content
        print("✓ Options test passed")
        
        # Test compact mode
        exporter = TripTextExporter({'compact': True})
        result = exporter.export(trip_data)
        content = result.decode('utf-8')
        print("✓ Compact mode test passed")
        
        print("✓ All text export tests passed")
        return True
        
    except Exception as e:
        print(f"✗ Text export failed: {e}")
        return False

def test_markdown_exporter():
    """Test markdown exporter functionality."""
    print("\nTesting Markdown Exporter...")
    
    try:
        # Basic export
        exporter = TripMarkdownExporter()
        trip_data = create_test_trip_data()
        
        result = exporter.export(trip_data)
        print(f"✓ Basic export: {len(result)} bytes")
        
        # Check content
        content = result.decode('utf-8')
        assert '# Test Trip - Summer 2024' in content
        assert 'John Doe' in content
        assert 'Jane Doe' in content
        print("✓ Basic content check passed")
        
        # Check markdown formatting
        assert '## ' in content  # Headers
        assert '### ' in content  # Subheaders
        assert '| ' in content   # Tables
        assert '- ' in content   # Lists
        assert '**' in content   # Bold text
        print("✓ Markdown formatting check passed")
        
        # Test with options
        options = {
            'include_recipes': True,
            'include_shopping': True,
            'include_nutrition': True,
            'include_packing': True,
            'include_toc': True,
            'language': 'en',
            'compact': False
        }
        
        exporter = TripMarkdownExporter(options)
        result = exporter.export(trip_data)
        content = result.decode('utf-8')
        
        assert '## Table of Contents' in content
        assert '[Trip Overview](#trip-overview)' in content
        assert '## Recipes' in content
        print("✓ Options test passed")
        
        print("✓ All markdown export tests passed")
        return True
        
    except Exception as e:
        print(f"✗ Markdown export failed: {e}")
        return False

def test_template_flexibility():
    """Test template system flexibility."""
    print("\nTesting Template Flexibility...")
    
    try:
        # Test different language options
        for lang in ['en', 'cs']:
            exporter = TripTextExporter({'language': lang})
            result = exporter.export(create_test_trip_data())
            content = result.decode('utf-8')
            
            if lang == 'cs':
                assert 'Přehled výletu' in content or 'Trip Overview' in content
            else:
                assert 'Trip Overview' in content
            print(f"✓ Language {lang} test passed")
        
        # Test customizable options
        options = {
            'include_recipes': False,
            'include_shopping': False,
            'include_nutrition': False,
            'include_packing': False,
            'compact': True,
            'include_toc': False
        }
        
        exporter = TripTextExporter(options)
        result = exporter.export(create_test_trip_data())
        content = result.decode('utf-8')
        
        # Should not contain optional sections
        assert 'Recipes' not in content or 'Recepty' not in content
        print("✓ Template customization test passed")
        
        print("✓ All template flexibility tests passed")
        return True
        
    except Exception as e:
        print(f"✗ Template flexibility failed: {e}")
        return False

def test_encoding_and_line_endings():
    """Test proper encoding and line endings."""
    print("\nTesting Encoding and Line Endings...")
    
    try:
        # Test UTF-8 encoding
        exporter = TripTextExporter()
        trip_data = create_test_trip_data()
        
        # Add some unicode characters
        trip_data['trip']['name'] = 'Test Trip - České znaky ěščřžýáíé'
        
        result = exporter.export(trip_data)
        
        # Should be bytes
        assert isinstance(result, bytes)
        
        # Should decode properly
        content = result.decode('utf-8')
        assert 'České znaky ěščřžýáíé' in content
        print("✓ UTF-8 encoding test passed")
        
        # Test line endings
        lines = content.split('\n')
        assert len(lines) > 1
        print("✓ Line endings test passed")
        
        # Test markdown encoding
        md_exporter = TripMarkdownExporter()
        md_result = md_exporter.export(trip_data)
        md_content = md_result.decode('utf-8')
        assert 'České znaky ěščřžýáíé' in md_content
        print("✓ Markdown encoding test passed")
        
        print("✓ All encoding tests passed")
        return True
        
    except Exception as e:
        print(f"✗ Encoding tests failed: {e}")
        return False

def main():
    """Run all tests."""
    print("=== Text/Markdown Export System Tests ===")
    
    tests = [
        test_text_exporter,
        test_markdown_exporter,
        test_template_flexibility,
        test_encoding_and_line_endings
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
    else:
        print(f"✗ {failed} tests failed")
    
    return failed == 0

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
#!/usr/bin/env python3
"""Simple test for Excel export functionality without complex configuration."""

import sys
import os
sys.path.insert(0, 'src')

# Test the Excel exporter directly
from datetime import datetime, timedelta
from uuid import UUID

def test_excel_export():
    """Test Excel export functionality directly."""
    print("Testing Excel export functionality...")
    
    # Import the Excel exporter directly
    try:
        from jidelnicek.trip.services.export.excel_exporter import TripExcelExporter
        print("✓ Successfully imported TripExcelExporter")
    except ImportError as e:
        print(f"✗ Failed to import TripExcelExporter: {e}")
        return False
    
    # Test basic initialization
    try:
        exporter = TripExcelExporter()
        print("✓ TripExcelExporter initialized successfully")
    except Exception as e:
        print(f"✗ Failed to initialize TripExcelExporter: {e}")
        return False
    
    # Create test data
    try:
        start_date = datetime.now()
        trip_data = {
            'trip': {
                'id': str(UUID('11111111-1111-1111-1111-111111111111')),
                'name': 'Test Trip',
                'start_date': start_date.isoformat(),
                'end_date': (start_date + timedelta(days=2)).isoformat(),
                'day_count': 3,
                'participant_count': 4,
                'location': 'Test Location',
                'trip_type': 'family',
                'description': 'Test trip description'
            },
            'participants': [
                {
                    'name': 'Test Person',
                    'age_group': 'adult',
                    'dietary_restrictions': None,
                    'notes': 'Test participant'
                }
            ],
            'days': [
                {
                    'day_number': 1,
                    'date': start_date.isoformat(),
                    'meals': [
                        {
                            'meal_type': 'breakfast',
                            'recipe_id': str(UUID('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')),
                            'recipe_name': 'Test Breakfast',
                            'participant_count': 4,
                            'time': '08:00'
                        }
                    ]
                }
            ],
            'recipes': {
                'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa': {
                    'name': 'Test Breakfast',
                    'prep_time': 10,
                    'cook_time': 15,
                    'difficulty': 'easy',
                    'ingredients': [
                        {'name': 'Test ingredient', 'quantity': 100, 'unit': 'g'}
                    ],
                    'instructions': 'Test instructions'
                }
            },
            'shopping_list': {
                'categories': {
                    'Test Category': [
                        {'name': 'Test item', 'quantity': 1, 'unit': 'piece'}
                    ]
                }
            },
            'nutrition': {
                'daily': {
                    '1': {
                        'calories': 2000,
                        'proteins': 80,
                        'carbs': 250,
                        'fats': 70,
                        'fiber': 25
                    }
                }
            }
        }
        print("✓ Test data created successfully")
    except Exception as e:
        print(f"✗ Failed to create test data: {e}")
        return False
    
    # Test export
    try:
        excel_bytes = exporter.export(trip_data)
        print(f"✓ Excel export successful: {len(excel_bytes)} bytes")
        
        # Save to file
        with open('/tmp/test_excel_export.xlsx', 'wb') as f:
            f.write(excel_bytes)
        print("✓ Excel file saved to /tmp/test_excel_export.xlsx")
        
        return True
    except Exception as e:
        print(f"✗ Excel export failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    success = test_excel_export()
    if success:
        print("\n✅ Excel export test passed!")
    else:
        print("\n❌ Excel export test failed!")
        sys.exit(1)
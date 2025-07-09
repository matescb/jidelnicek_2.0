"""
Tests for trip export functionality.
"""

import sys
sys.path.insert(0, 'src')

from datetime import datetime, timedelta
from uuid import UUID
import json

from jidelnicek.trip.services.export import (
    TripExportManager,
    ExportOptions,
    TripPDFExporter,
    TripExcelExporter
)
from jidelnicek.trip.services.export.export_manager import ExportFormat


def create_test_trip_data():
    """Create sample trip data for testing."""
    start_date = datetime.now()
    
    trip_data = {
        'trip': {
            'id': UUID('11111111-1111-1111-1111-111111111111'),
            'name': 'Letní dovolená 2024',
            'start_date': start_date.isoformat(),
            'end_date': (start_date + timedelta(days=4)).isoformat(),
            'day_count': 5,
            'participant_count': 4,
            'location': 'Šumava',
            'trip_type': 'family',
            'description': 'Rodinná dovolená v přírodě s turistikou a koupáním.'
        },
        'participants': [
            {
                'name': 'Jan Novák',
                'age_group': 'adult',
                'dietary_restrictions': None,
                'notes': 'Organizátor'
            },
            {
                'name': 'Marie Nováková',
                'age_group': 'adult',
                'dietary_restrictions': 'vegetarian',
                'notes': None
            },
            {
                'name': 'Tomáš Novák',
                'age_group': 'teen',
                'dietary_restrictions': None,
                'notes': None
            },
            {
                'name': 'Anna Nováková',
                'age_group': 'child',
                'dietary_restrictions': 'lactose_intolerant',
                'notes': 'Alergie na laktózu'
            }
        ],
        'days': [
            {
                'day_number': 1,
                'date': start_date.isoformat(),
                'meals': [
                    {
                        'meal_type': 'breakfast',
                        'recipe_id': UUID('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
                        'recipe_name': 'Ovesná kaše s ovocem',
                        'participant_count': 4,
                        'time': '08:00'
                    },
                    {
                        'meal_type': 'lunch',
                        'recipe_id': UUID('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
                        'recipe_name': 'Těstovinový salát',
                        'participant_count': 4,
                        'time': '12:30'
                    },
                    {
                        'meal_type': 'dinner',
                        'recipe_id': UUID('cccccccc-cccc-cccc-cccc-cccccccccccc'),
                        'recipe_name': 'Grilované kuře se zeleninou',
                        'participant_count': 4,
                        'time': '18:00'
                    }
                ]
            },
            {
                'day_number': 2,
                'date': (start_date + timedelta(days=1)).isoformat(),
                'meals': [
                    {
                        'meal_type': 'breakfast',
                        'recipe_id': UUID('dddddddd-dddd-dddd-dddd-dddddddddddd'),
                        'recipe_name': 'Míchaná vajíčka',
                        'participant_count': 4,
                        'time': '08:00'
                    },
                    {
                        'meal_type': 'lunch',
                        'recipe_id': UUID('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'),
                        'recipe_name': 'Sendviče s tuňákem',
                        'participant_count': 4,
                        'time': '12:00'
                    }
                ]
            }
        ],
        'recipes': {
            'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa': {
                'name': 'Ovesná kaše s ovocem',
                'prep_time': 5,
                'cook_time': 10,
                'difficulty': 'easy',
                'ingredients': [
                    {'name': 'Ovesné vločky', 'quantity': 200, 'unit': 'g'},
                    {'name': 'Mléko', 'quantity': 500, 'unit': 'ml'},
                    {'name': 'Banány', 'quantity': 2, 'unit': 'ks'},
                    {'name': 'Med', 'quantity': 50, 'unit': 'ml'}
                ],
                'instructions': 'Vločky uvařte v mléce. Přidejte nakrájené banány a med.'
            },
            'cccccccc-cccc-cccc-cccc-cccccccccccc': {
                'name': 'Grilované kuře se zeleninou',
                'prep_time': 20,
                'cook_time': 30,
                'difficulty': 'medium',
                'ingredients': [
                    {'name': 'Kuřecí prsa', 'quantity': 800, 'unit': 'g'},
                    {'name': 'Papriky', 'quantity': 3, 'unit': 'ks'},
                    {'name': 'Cuketa', 'quantity': 1, 'unit': 'ks'},
                    {'name': 'Olivový olej', 'quantity': 50, 'unit': 'ml'}
                ],
                'instructions': 'Kuře nakrájejte, osolte, opepřete. Grilujte se zeleninou.'
            }
        },
        'shopping_list': {
            'categories': {
                'Maso': [
                    {'name': 'Kuřecí prsa', 'quantity': 800, 'unit': 'g'},
                ],
                'Zelenina': [
                    {'name': 'Papriky', 'quantity': 3, 'unit': 'ks'},
                    {'name': 'Cuketa', 'quantity': 1, 'unit': 'ks'},
                    {'name': 'Banány', 'quantity': 2, 'unit': 'ks'}
                ],
                'Mléčné výrobky': [
                    {'name': 'Mléko', 'quantity': 500, 'unit': 'ml'}
                ],
                'Ostatní': [
                    {'name': 'Ovesné vločky', 'quantity': 200, 'unit': 'g'},
                    {'name': 'Med', 'quantity': 50, 'unit': 'ml'},
                    {'name': 'Olivový olej', 'quantity': 50, 'unit': 'ml'}
                ]
            },
            'summary': {
                'total_items': 7,
                'total_weight': 2.5,
                'total_volume': 0.6
            }
        },
        'nutrition': {
            'daily_averages': {
                'calories': 2100,
                'proteins': 85,
                'carbs': 260,
                'fats': 70,
                'fiber': 28
            }
        }
    }
    
    return trip_data


def test_export_manager_initialization():
    """Test export manager initialization."""
    print("Testing export manager initialization...")
    
    manager = TripExportManager()
    
    # Check available formats
    formats = manager.get_available_formats()
    print(f"Available formats: {[f.value for f in formats]}")
    
    # Check file extensions
    for format in formats:
        ext = manager.get_file_extension(format)
        mime = manager.get_mime_type(format)
        print(f"  {format.value}: {ext} ({mime})")
        
    print("✓ Export manager initialization test passed\n")


def test_pdf_export_availability():
    """Test PDF export availability."""
    print("Testing PDF export availability...")
    
    manager = TripExportManager()
    
    if manager.is_format_available(ExportFormat.PDF):
        print("✓ PDF export is available")
        
        # Test PDF exporter directly
        try:
            exporter = TripPDFExporter()
            print("✓ PDF exporter initialized successfully")
        except ImportError as e:
            print(f"✗ PDF exporter initialization failed: {e}")
    else:
        print("- PDF export not available (reportlab not installed)")
        
    print()


def test_excel_export_availability():
    """Test Excel export availability."""
    print("Testing Excel export availability...")
    
    manager = TripExportManager()
    
    if manager.is_format_available(ExportFormat.EXCEL):
        print("✓ Excel export is available")
        
        # Test Excel exporter directly
        try:
            exporter = TripExcelExporter()
            print("✓ Excel exporter initialized successfully")
        except ImportError as e:
            print(f"✗ Excel exporter initialization failed: {e}")
    else:
        print("- Excel export not available (openpyxl not installed)")
        
    print()


def test_pdf_export():
    """Test PDF export functionality."""
    print("Testing PDF export...")
    
    manager = TripExportManager()
    
    if not manager.is_format_available(ExportFormat.PDF):
        print("- Skipping PDF export test (not available)")
        return
        
    trip_data = create_test_trip_data()
    
    # Test with default options
    options = ExportOptions(
        format=ExportFormat.PDF,
        include_recipes=True,
        include_shopping=True,
        include_nutrition=True
    )
    
    try:
        pdf_bytes = manager.export(trip_data, options)
        print(f"✓ PDF generated: {len(pdf_bytes)} bytes")
        
        # Save to file for manual inspection
        with open('test_trip_export.pdf', 'wb') as f:
            f.write(pdf_bytes)
        print("✓ PDF saved to test_trip_export.pdf")
        
    except Exception as e:
        print(f"✗ PDF export failed: {e}")
        
    # Test compact mode
    options.compact = True
    
    try:
        pdf_bytes = manager.export(trip_data, options)
        print(f"✓ Compact PDF generated: {len(pdf_bytes)} bytes")
    except Exception as e:
        print(f"✗ Compact PDF export failed: {e}")
        
    print()


def test_excel_export():
    """Test Excel export functionality."""
    print("Testing Excel export...")
    
    manager = TripExportManager()
    
    if not manager.is_format_available(ExportFormat.EXCEL):
        print("- Skipping Excel export test (not available)")
        return
        
    trip_data = create_test_trip_data()
    
    # Test with full options
    options = ExportOptions(
        format=ExportFormat.EXCEL,
        include_recipes=True,
        include_shopping=True,
        include_nutrition=True,
        include_costs=True,
        include_charts=True,
        include_formulas=True,
        currency='Kč'
    )
    
    try:
        excel_bytes = manager.export(trip_data, options)
        print(f"✓ Excel generated: {len(excel_bytes)} bytes")
        
        # Save to file for manual inspection
        with open('test_trip_export.xlsx', 'wb') as f:
            f.write(excel_bytes)
        print("✓ Excel saved to test_trip_export.xlsx")
        
    except Exception as e:
        print(f"✗ Excel export failed: {e}")
        
    print()


def test_export_with_missing_data():
    """Test export with incomplete trip data."""
    print("Testing export with missing data...")
    
    manager = TripExportManager()
    
    # Minimal trip data
    minimal_data = {
        'trip': {
            'name': 'Test Trip',
            'start_date': datetime.now().isoformat(),
            'end_date': (datetime.now() + timedelta(days=2)).isoformat(),
            'participant_count': 2
        },
        'days': []
    }
    
    options = ExportOptions(
        format=ExportFormat.PDF if manager.is_format_available(ExportFormat.PDF) else ExportFormat.EXCEL
    )
    
    try:
        result = manager.export(minimal_data, options)
        print(f"✓ Export with minimal data succeeded: {len(result)} bytes")
    except Exception as e:
        print(f"✗ Export with minimal data failed: {e}")
        
    print()


def test_export_options():
    """Test various export options."""
    print("Testing export options...")
    
    manager = TripExportManager()
    trip_data = create_test_trip_data()
    
    # Test different option combinations
    test_cases = [
        {
            'name': 'No recipes',
            'options': ExportOptions(
                format=ExportFormat.PDF,
                include_recipes=False
            )
        },
        {
            'name': 'No shopping',
            'options': ExportOptions(
                format=ExportFormat.PDF,
                include_shopping=False
            )
        },
        {
            'name': 'No nutrition',
            'options': ExportOptions(
                format=ExportFormat.PDF,
                include_nutrition=False
            )
        },
        {
            'name': 'Compact mode',
            'options': ExportOptions(
                format=ExportFormat.PDF,
                compact=True
            )
        }
    ]
    
    for test in test_cases:
        if not manager.is_format_available(test['options'].format):
            continue
            
        try:
            result = manager.export(trip_data, test['options'])
            print(f"✓ {test['name']}: {len(result)} bytes")
        except Exception as e:
            print(f"✗ {test['name']} failed: {e}")
            
    print()


def run_all_tests():
    """Run all trip export tests."""
    print("Running trip export tests...\n")
    
    test_export_manager_initialization()
    test_pdf_export_availability()
    test_excel_export_availability()
    test_pdf_export()
    test_excel_export()
    test_export_with_missing_data()
    test_export_options()
    
    print("✅ Trip export tests completed!")
    print("\nNote: Check generated test_trip_export.pdf and test_trip_export.xlsx files")


if __name__ == '__main__':
    run_all_tests()
"""
Simple tests for trip export functionality without full app context.
"""

import sys
sys.path.insert(0, 'src')

from datetime import datetime, timedelta
from uuid import UUID
import os

# Import only the export classes directly
from jidelnicek.trip.services.export.pdf_exporter import TripPDFExporter, REPORTLAB_AVAILABLE
from jidelnicek.trip.services.export.excel_exporter import TripExcelExporter, OPENPYXL_AVAILABLE
from jidelnicek.trip.services.export.export_manager import TripExportManager, ExportOptions, ExportFormat


def create_test_trip_data():
    """Create sample trip data for testing."""
    start_date = datetime.now()
    
    trip_data = {
        'trip': {
            'id': '11111111-1111-1111-1111-111111111111',
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
                        'recipe_id': 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
                        'recipe_name': 'Ovesná kaše s ovocem',
                        'participant_count': 4,
                        'time': '08:00'
                    },
                    {
                        'meal_type': 'lunch',
                        'recipe_id': 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
                        'recipe_name': 'Těstovinový salát',
                        'participant_count': 4,
                        'time': '12:30'
                    },
                    {
                        'meal_type': 'dinner',
                        'recipe_id': 'cccccccc-cccc-cccc-cccc-cccccccccccc',
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
                        'recipe_id': 'dddddddd-dddd-dddd-dddd-dddddddddddd',
                        'recipe_name': 'Míchaná vajíčka',
                        'participant_count': 4,
                        'time': '08:00'
                    },
                    {
                        'meal_type': 'lunch',
                        'recipe_id': 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
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
            },
            'daily': {
                '1': {
                    'calories': 2200,
                    'proteins': 90,
                    'carbs': 270,
                    'fats': 72,
                    'fiber': 30
                },
                '2': {
                    'calories': 2000,
                    'proteins': 80,
                    'carbs': 250,
                    'fats': 68,
                    'fiber': 26
                }
            }
        }
    }
    
    return trip_data


def test_pdf_export():
    """Test PDF export directly."""
    print("Testing PDF export...")
    
    if not REPORTLAB_AVAILABLE:
        print("- Skipping PDF export test (reportlab not installed)")
        return
        
    try:
        exporter = TripPDFExporter({
            'page_size': 'A4',
            'language': 'cs',
            'include_recipes': True,
            'include_shopping': True,
            'include_nutrition': True,
            'include_packing': True
        })
        print("✓ PDF exporter initialized")
        
        trip_data = create_test_trip_data()
        pdf_bytes = exporter.export(trip_data)
        
        print(f"✓ PDF generated: {len(pdf_bytes)} bytes")
        
        # Save for inspection
        with open('test_trip.pdf', 'wb') as f:
            f.write(pdf_bytes)
        print("✓ Saved to test_trip.pdf")
        
    except Exception as e:
        print(f"✗ PDF export failed: {e}")
        import traceback
        traceback.print_exc()
        
    print()


def test_excel_export():
    """Test Excel export directly."""
    print("Testing Excel export...")
    
    if not OPENPYXL_AVAILABLE:
        print("- Skipping Excel export test (openpyxl not installed)")
        return
        
    try:
        exporter = TripExcelExporter({
            'language': 'cs',
            'currency': 'Kč',
            'include_charts': True,
            'include_formulas': True,
            'include_costs': True,
            'include_nutrition': True
        })
        print("✓ Excel exporter initialized")
        
        trip_data = create_test_trip_data()
        excel_bytes = exporter.export(trip_data)
        
        print(f"✓ Excel generated: {len(excel_bytes)} bytes")
        
        # Save for inspection
        with open('test_trip.xlsx', 'wb') as f:
            f.write(excel_bytes)
        print("✓ Saved to test_trip.xlsx")
        
    except Exception as e:
        print(f"✗ Excel export failed: {e}")
        import traceback
        traceback.print_exc()
        
    print()


def test_export_manager():
    """Test export manager."""
    print("Testing export manager...")
    
    try:
        manager = TripExportManager()
        print("✓ Export manager initialized")
        
        # Check available formats
        formats = manager.get_available_formats()
        print(f"  Available formats: {[f.value for f in formats]}")
        
        # Test file extensions and MIME types
        for format in [ExportFormat.PDF, ExportFormat.EXCEL]:
            ext = manager.get_file_extension(format)
            mime = manager.get_mime_type(format)
            available = manager.is_format_available(format)
            print(f"  {format.value}: {ext} ({mime}) - {'available' if available else 'not available'}")
            
    except Exception as e:
        print(f"✗ Export manager test failed: {e}")
        
    print()


def test_compact_pdf():
    """Test compact PDF export."""
    print("Testing compact PDF export...")
    
    if not REPORTLAB_AVAILABLE:
        print("- Skipping compact PDF test (reportlab not installed)")
        return
        
    try:
        exporter = TripPDFExporter({
            'compact': True,
            'include_toc': False,
            'include_recipes': True,
            'include_shopping': True
        })
        
        trip_data = create_test_trip_data()
        pdf_bytes = exporter.export(trip_data)
        
        print(f"✓ Compact PDF generated: {len(pdf_bytes)} bytes")
        
        # Save for inspection
        with open('test_trip_compact.pdf', 'wb') as f:
            f.write(pdf_bytes)
        print("✓ Saved to test_trip_compact.pdf")
        
    except Exception as e:
        print(f"✗ Compact PDF export failed: {e}")
        
    print()


def test_minimal_data():
    """Test export with minimal data."""
    print("Testing export with minimal data...")
    
    minimal_data = {
        'trip': {
            'name': 'Test Trip',
            'start_date': datetime.now().isoformat(),
            'end_date': (datetime.now() + timedelta(days=2)).isoformat(),
            'participant_count': 2
        },
        'days': []
    }
    
    if REPORTLAB_AVAILABLE:
        try:
            exporter = TripPDFExporter()
            pdf_bytes = exporter.export(minimal_data)
            print(f"✓ Minimal PDF generated: {len(pdf_bytes)} bytes")
        except Exception as e:
            print(f"✗ Minimal PDF failed: {e}")
            
    if OPENPYXL_AVAILABLE:
        try:
            exporter = TripExcelExporter()
            excel_bytes = exporter.export(minimal_data)
            print(f"✓ Minimal Excel generated: {len(excel_bytes)} bytes")
        except Exception as e:
            print(f"✗ Minimal Excel failed: {e}")
            
    print()


def cleanup_test_files():
    """Remove generated test files."""
    test_files = ['test_trip.pdf', 'test_trip.xlsx', 'test_trip_compact.pdf']
    
    for filename in test_files:
        if os.path.exists(filename):
            os.remove(filename)
            print(f"  Removed {filename}")


def run_all_tests():
    """Run all export tests."""
    print("Running trip export tests...\n")
    
    test_pdf_export()
    test_excel_export()
    test_export_manager()
    test_compact_pdf()
    test_minimal_data()
    
    print("✅ All tests completed!")
    
    # Ask about cleanup
    response = input("\nRemove generated test files? (y/n): ")
    if response.lower() == 'y':
        cleanup_test_files()


if __name__ == '__main__':
    run_all_tests()
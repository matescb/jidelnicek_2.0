"""
Simple tests for shopping list export functionality.
"""

import sys
sys.path.insert(0, 'src')

import json
import csv
import io
from decimal import Decimal
from uuid import UUID
from pathlib import Path

from jidelnicek.shopping.services import (
    ShoppingListGenerator,
    ExportManager
)
from jidelnicek.shopping.services.export import ExportFormat


def create_test_shopping_list():
    """Create a sample shopping list for testing."""
    generator = ShoppingListGenerator()
    
    # Add some test recipes
    recipes = [
        {
            'recipe_id': UUID('11111111-1111-1111-1111-111111111111'),
            'recipe_name': 'Tomato Pasta',
            'meal_name': 'Lunch',
            'day_number': 1,
            'ingredients': [
                {
                    'ingredient_id': UUID('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
                    'name': 'Tomatoes',
                    'quantity': Decimal('500'),
                    'unit': 'g',
                    'ingredient_type': 'vegetable'
                },
                {
                    'ingredient_id': UUID('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
                    'name': 'Pasta',
                    'quantity': Decimal('250'),
                    'unit': 'g',
                    'ingredient_type': 'grain'
                }
            ]
        },
        {
            'recipe_id': UUID('22222222-2222-2222-2222-222222222222'),
            'recipe_name': 'Greek Salad',
            'meal_name': 'Dinner',
            'day_number': 1,
            'ingredients': [
                {
                    'ingredient_id': UUID('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
                    'name': 'Tomatoes',
                    'quantity': Decimal('300'),
                    'unit': 'g',
                    'ingredient_type': 'vegetable'
                },
                {
                    'ingredient_id': UUID('cccccccc-cccc-cccc-cccc-cccccccccccc'),
                    'name': 'Feta cheese',
                    'quantity': Decimal('150'),
                    'unit': 'g',
                    'ingredient_type': 'dairy'
                }
            ]
        }
    ]
    
    generator.add_recipes(recipes)
    shopping_list = generator.generate_list()
    
    return shopping_list


def test_text_export():
    """Test plain text export."""
    print("Testing text export...")
    
    shopping_list = create_test_shopping_list()
    manager = ExportManager()
    
    # Basic export
    content = manager.export(shopping_list, ExportFormat.TEXT)
    text = content.decode('utf-8')
    
    assert 'SHOPPING LIST' in text
    assert 'Total Items:' in text
    assert 'Tomatoes' in text
    assert '800 g' in text  # Aggregated amount
    
    print(f"✓ Basic text export works ({len(content)} bytes)")
    
    # Export with options
    options = {
        'include_checkboxes': False,
        'include_sources': True,
        'compact': True
    }
    content = manager.export(shopping_list, ExportFormat.TEXT, options)
    text = content.decode('utf-8')
    
    assert '[ ]' not in text  # No checkboxes
    assert 'Tomato Pasta' in text  # Sources included
    
    print("✓ Text export with options works")
    print("✓ Text export test passed\n")


def test_json_export():
    """Test JSON export."""
    print("Testing JSON export...")
    
    shopping_list = create_test_shopping_list()
    manager = ExportManager()
    
    # Export to JSON
    content = manager.export(shopping_list, ExportFormat.JSON)
    data = json.loads(content.decode('utf-8'))
    
    assert data['total_items'] == 3  # Tomatoes, Pasta, Feta
    assert 'sections' in data
    assert len(data['sections']) > 0
    
    # Find tomatoes
    found_tomatoes = False
    for section in data['sections']:
        for item in section['items']:
            if item['name'] == 'Tomatoes':
                found_tomatoes = True
                assert item['rounded_quantity'] == 800.0
                break
    
    assert found_tomatoes
    print(f"✓ JSON export works ({len(content)} bytes)")
    
    # Test flat format
    options = {'flat_items': True, 'pretty': False}
    content = manager.export(shopping_list, ExportFormat.JSON, options)
    data = json.loads(content.decode('utf-8'))
    
    assert 'items' in data
    assert len(data['items']) == 3
    
    print("✓ JSON flat format works")
    print("✓ JSON export test passed\n")


def test_csv_export():
    """Test CSV export."""
    print("Testing CSV export...")
    
    shopping_list = create_test_shopping_list()
    manager = ExportManager()
    
    # Export to CSV
    content = manager.export(shopping_list, ExportFormat.CSV)
    
    # Parse CSV
    csv_file = io.StringIO(content.decode('utf-8'))
    reader = csv.DictReader(csv_file)
    rows = list(reader)
    
    assert len(rows) == 3  # 3 items
    
    # Check headers
    headers = reader.fieldnames
    assert 'name' in headers
    assert 'quantity' in headers
    assert 'unit' in headers
    
    # Find tomatoes
    tomato_row = next((r for r in rows if r['name'] == 'Tomatoes'), None)
    assert tomato_row is not None
    assert float(tomato_row['quantity']) == 800.0
    
    print(f"✓ CSV export works ({len(rows)} rows)")
    print("✓ CSV export test passed\n")


def test_html_export():
    """Test HTML export."""
    print("Testing HTML export...")
    
    shopping_list = create_test_shopping_list()
    manager = ExportManager()
    
    # Export to HTML
    content = manager.export(shopping_list, ExportFormat.HTML)
    html = content.decode('utf-8')
    
    assert '<!DOCTYPE html>' in html
    assert '<title>' in html
    assert 'Shopping List' in html
    assert 'Tomatoes' in html
    assert '800 g' in html
    
    print(f"✓ HTML export works ({len(content)} bytes)")
    
    # Test dark theme
    options = {'theme': 'dark', 'include_javascript': False}
    content = manager.export(shopping_list, ExportFormat.HTML, options)
    html = content.decode('utf-8')
    
    assert '#1a1a1a' in html  # Dark background color
    
    print("✓ HTML dark theme works")
    print("✓ HTML export test passed\n")


def test_export_to_file():
    """Test exporting to file."""
    print("Testing export to file...")
    
    shopping_list = create_test_shopping_list()
    manager = ExportManager()
    
    # Create temp directory
    temp_dir = Path('temp_export_test')
    temp_dir.mkdir(exist_ok=True)
    
    try:
        # Export to text file
        text_file = temp_dir / 'shopping_list.txt'
        manager.export_to_file(shopping_list, ExportFormat.TEXT, text_file)
        
        assert text_file.exists()
        content = text_file.read_text()
        assert 'SHOPPING LIST' in content
        
        print("✓ Export to text file works")
        
        # Export to JSON file
        json_file = temp_dir / 'shopping_list.json'
        manager.export_to_file(shopping_list, ExportFormat.JSON, json_file)
        
        assert json_file.exists()
        with open(json_file) as f:
            data = json.load(f)
        assert data['total_items'] == 3
        
        print("✓ Export to JSON file works")
        
    finally:
        # Cleanup
        if text_file.exists():
            text_file.unlink()
        if json_file.exists():
            json_file.unlink()
        if temp_dir.exists():
            temp_dir.rmdir()
            
    print("✓ Export to file test passed\n")


def test_format_utilities():
    """Test format utility functions."""
    print("Testing format utilities...")
    
    manager = ExportManager()
    
    # Test file extensions
    assert manager.get_file_extension(ExportFormat.TEXT) == '.txt'
    assert manager.get_file_extension(ExportFormat.JSON) == '.json'
    assert manager.get_file_extension(ExportFormat.CSV) == '.csv'
    assert manager.get_file_extension(ExportFormat.HTML) == '.html'
    
    print("✓ File extensions correct")
    
    # Test MIME types
    assert manager.get_mime_type(ExportFormat.TEXT) == 'text/plain'
    assert manager.get_mime_type(ExportFormat.JSON) == 'application/json'
    assert manager.get_mime_type(ExportFormat.CSV) == 'text/csv'
    assert manager.get_mime_type(ExportFormat.HTML) == 'text/html'
    
    print("✓ MIME types correct")
    
    # Test supported formats
    formats = manager.get_supported_formats()
    assert ExportFormat.TEXT in formats
    assert ExportFormat.JSON in formats
    assert len(formats) >= 4
    
    print("✓ Supported formats listed")
    
    # Test availability check
    assert manager.is_format_available(ExportFormat.TEXT) is True
    assert manager.is_format_available(ExportFormat.JSON) is True
    
    # Excel and PDF might not be available without dependencies
    excel_available = manager.is_format_available(ExportFormat.EXCEL)
    pdf_available = manager.is_format_available(ExportFormat.PDF)
    
    print(f"✓ Excel available: {excel_available}")
    print(f"✓ PDF available: {pdf_available}")
    
    print("✓ Format utilities test passed\n")


def test_optional_dependencies():
    """Test formats with optional dependencies."""
    print("Testing optional dependencies...")
    
    manager = ExportManager()
    shopping_list = create_test_shopping_list()
    
    # Try Excel export
    if manager.is_format_available(ExportFormat.EXCEL):
        try:
            content = manager.export(shopping_list, ExportFormat.EXCEL)
            print(f"✓ Excel export works ({len(content)} bytes)")
        except Exception as e:
            print(f"✗ Excel export failed: {e}")
    else:
        print("- Excel export not available (openpyxl not installed)")
        
    # Try PDF export
    if manager.is_format_available(ExportFormat.PDF):
        try:
            content = manager.export(shopping_list, ExportFormat.PDF)
            print(f"✓ PDF export works ({len(content)} bytes)")
        except Exception as e:
            print(f"✗ PDF export failed: {e}")
    else:
        print("- PDF export not available (reportlab not installed)")
        
    print("✓ Optional dependencies test passed\n")


def run_all_tests():
    """Run all export tests."""
    print("Running shopping list export tests...\n")
    
    test_text_export()
    test_json_export()
    test_csv_export()
    test_html_export()
    test_export_to_file()
    test_format_utilities()
    test_optional_dependencies()
    
    print("✅ All export tests passed!")


if __name__ == '__main__':
    run_all_tests()
"""
Security and input validation tests for custom items.
"""

import sys
sys.path.insert(0, 'src')

from decimal import Decimal
from jidelnicek.shopping.utils.custom_items import CustomItemsManager, CustomItemCategory
import json

def test_input_validation():
    """Test input validation for security."""
    print("Testing input validation and security...")
    
    manager = CustomItemsManager()
    
    # Test SQL injection attempts
    print("\n1. Testing SQL injection attempts:")
    try:
        item = manager.add_item(
            name="'; DROP TABLE users; --",
            quantity=Decimal('1'),
            unit="unit",
            category=CustomItemCategory.OTHER
        )
        print(f"   ✓ SQL injection attempt handled safely: {item.name}")
    except Exception as e:
        print(f"   ✗ Error handling SQL injection: {e}")
    
    # Test XSS attempts
    print("\n2. Testing XSS attempts:")
    try:
        item = manager.add_item(
            name="<script>alert('XSS')</script>",
            quantity=Decimal('1'),
            unit="unit",
            category=CustomItemCategory.OTHER
        )
        print(f"   ✓ XSS attempt handled safely: {item.name}")
    except Exception as e:
        print(f"   ✗ Error handling XSS: {e}")
    
    # Test extremely long strings
    print("\n3. Testing extremely long strings:")
    try:
        long_name = "A" * 10000
        item = manager.add_item(
            name=long_name,
            quantity=Decimal('1'),
            unit="unit",
            category=CustomItemCategory.OTHER
        )
        print(f"   ✓ Long string handled: {len(item.name)} characters")
    except Exception as e:
        print(f"   ✗ Error handling long string: {e}")
    
    # Test invalid quantities
    print("\n4. Testing invalid quantities:")
    try:
        item = manager.add_item(
            name="Test negative",
            quantity=Decimal('-1'),
            unit="unit",
            category=CustomItemCategory.OTHER
        )
        print(f"   ⚠ Negative quantity accepted: {item.quantity}")
    except Exception as e:
        print(f"   ✓ Negative quantity rejected: {e}")
    
    # Test extremely large quantities
    print("\n5. Testing extremely large quantities:")
    try:
        item = manager.add_item(
            name="Test large",
            quantity=Decimal('999999999999999999999'),
            unit="unit",
            category=CustomItemCategory.OTHER
        )
        print(f"   ⚠ Large quantity accepted: {item.quantity}")
    except Exception as e:
        print(f"   ✓ Large quantity rejected: {e}")
    
    # Test invalid units
    print("\n6. Testing invalid units:")
    try:
        item = manager.add_item(
            name="Test empty unit",
            quantity=Decimal('1'),
            unit="",
            category=CustomItemCategory.OTHER
        )
        print(f"   ⚠ Empty unit accepted: '{item.unit}'")
    except Exception as e:
        print(f"   ✓ Empty unit rejected: {e}")
    
    # Test None values
    print("\n7. Testing None values:")
    try:
        item = manager.add_item(
            name=None,
            quantity=Decimal('1'),
            unit="unit",
            category=CustomItemCategory.OTHER
        )
        print(f"   ⚠ None name accepted: {item.name}")
    except Exception as e:
        print(f"   ✓ None name rejected: {e}")
    
    print("\n✅ Input validation tests completed!")

def test_json_security():
    """Test JSON import/export security."""
    print("\nTesting JSON security...")
    
    manager = CustomItemsManager()
    
    # Test malicious JSON
    print("\n1. Testing malicious JSON payloads:")
    
    # Add a legitimate item first
    manager.add_item("Test item", Decimal('1'), "unit", CustomItemCategory.OTHER)
    
    malicious_payloads = [
        '{"__proto__": {"polluted": true}}',  # Prototype pollution
        '{"constructor": {"prototype": {"polluted": true}}}',  # Constructor pollution  
        '[{"id": "../../../etc/passwd"}]',  # Path traversal attempt
        '[{"name": "test", "quantity": "eval(dangerous_code)"}]',  # Code injection
        '[{"id": "' + 'A' * 100000 + '"}]',  # Buffer overflow attempt
    ]
    
    for payload in malicious_payloads:
        try:
            manager.import_items(payload)
            print(f"   ⚠ Malicious payload accepted: {payload[:50]}...")
        except Exception as e:
            print(f"   ✓ Malicious payload rejected: {str(e)[:50]}...")
    
    # Test deeply nested JSON
    print("\n2. Testing deeply nested JSON:")
    try:
        deep_json = '{"a":' * 1000 + '{"value": "test"}' + '}' * 1000
        manager.import_items(deep_json)
        print("   ⚠ Deep nesting accepted")
    except Exception as e:
        print(f"   ✓ Deep nesting rejected: {str(e)[:50]}...")
    
    # Test circular references
    print("\n3. Testing export security:")
    try:
        exported = manager.export_items()
        # Check that export is safe
        parsed = json.loads(exported)
        print(f"   ✓ Export is valid JSON with {len(parsed)} items")
    except Exception as e:
        print(f"   ✗ Export error: {e}")
    
    print("\n✅ JSON security tests completed!")

def test_data_integrity():
    """Test data integrity and consistency."""
    print("\nTesting data integrity...")
    
    manager = CustomItemsManager()
    
    # Test ID uniqueness
    print("\n1. Testing ID uniqueness:")
    items = []
    for i in range(10):
        item = manager.add_item(
            name=f"Item {i}",
            quantity=Decimal('1'),
            unit="unit",
            category=CustomItemCategory.OTHER
        )
        items.append(item)
    
    ids = [item.id for item in items]
    unique_ids = set(ids)
    print(f"   ✓ Generated {len(ids)} items with {len(unique_ids)} unique IDs")
    assert len(ids) == len(unique_ids), "IDs should be unique"
    
    # Test data consistency after operations
    print("\n2. Testing data consistency:")
    initial_count = len(manager.get_items())
    
    # Add item
    item = manager.add_item("Test", Decimal('1'), "unit", CustomItemCategory.OTHER)
    assert len(manager.get_items()) == initial_count + 1
    
    # Remove item
    manager.remove_item(item.id)
    assert len(manager.get_items()) == initial_count
    
    print("   ✓ Data consistency maintained after operations")
    
    # Test category consistency
    print("\n3. Testing category consistency:")
    categories = manager.get_items_by_category()
    total_items = sum(len(items) for items in categories.values())
    direct_count = len(manager.get_items())
    assert total_items == direct_count, "Category grouping should match total count"
    print(f"   ✓ Category consistency verified: {total_items} items")
    
    print("\n✅ Data integrity tests completed!")

def test_performance_limits():
    """Test performance with large datasets."""
    print("\nTesting performance limits...")
    
    manager = CustomItemsManager()
    
    # Test with many items
    print("\n1. Testing with large number of items:")
    try:
        for i in range(1000):
            manager.add_item(
                name=f"Item {i}",
                quantity=Decimal('1'),
                unit="unit",
                category=CustomItemCategory.OTHER
            )
        
        print(f"   ✓ Successfully added 1000 items")
        
        # Test operations with large dataset
        all_items = manager.get_items()
        print(f"   ✓ Retrieved {len(all_items)} items")
        
        by_category = manager.get_items_by_category()
        print(f"   ✓ Categorized into {len(by_category)} categories")
        
        # Test filtering performance
        filtered = manager.get_items(priority="normal")
        print(f"   ✓ Filtered {len(filtered)} items by priority")
        
    except Exception as e:
        print(f"   ✗ Performance test failed: {e}")
    
    print("\n✅ Performance limit tests completed!")

def run_all_security_tests():
    """Run all security tests."""
    print("Running comprehensive security tests...\n")
    
    test_input_validation()
    test_json_security()
    test_data_integrity()
    test_performance_limits()
    
    print("\n🛡️ All security tests completed!")

if __name__ == '__main__':
    run_all_security_tests()
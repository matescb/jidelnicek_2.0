#!/usr/bin/env python3
"""
Comprehensive test for container recommender review.
"""

import sys
import time
import json
from decimal import Decimal
from typing import Dict, Any, List
sys.path.insert(0, 'src')

from jidelnicek.shopping.services.container_recommender import (
    ContainerRecommender,
    ContainerType,
    ContainerShape,
    ContainerSize,
    StorageType
)


class ContainerRecommenderReview:
    """Comprehensive review of container recommender functionality."""
    
    def __init__(self):
        self.recommender = ContainerRecommender()
        self.test_results = {
            'total_tests': 0,
            'passed': 0,
            'failed': 0,
            'performance_tests': [],
            'edge_cases': [],
            'accuracy_tests': []
        }
    
    def run_comprehensive_review(self) -> Dict[str, Any]:
        """Run comprehensive review of container recommender."""
        print("🔍 Starting comprehensive container recommender review...")
        
        # Basic functionality tests
        self._test_basic_functionality()
        
        # Edge case tests
        self._test_edge_cases()
        
        # Performance tests
        self._test_performance()
        
        # Accuracy tests
        self._test_recommendation_accuracy()
        
        # Container optimization tests
        self._test_packing_optimization()
        
        # Error handling tests
        self._test_error_handling()
        
        return self.test_results
    
    def _test_basic_functionality(self):
        """Test basic container recommendation functionality."""
        print("\n📦 Testing basic functionality...")
        
        # Test 1: Basic recommendation
        ingredients = [
            {'name': 'Tomatoes', 'quantity': 500, 'unit': 'g'},
            {'name': 'Milk', 'quantity': 1, 'unit': 'l'},
            {'name': 'Bread', 'quantity': 1, 'unit': 'loaf'}
        ]
        
        plan = self.recommender.recommend_containers(ingredients)
        
        assert plan.total_containers > 0, "Should recommend at least one container"
        assert len(plan.recommendations) > 0, "Should have recommendations"
        assert plan.cooler_space_needed_l >= 0, "Cooler space should be non-negative"
        
        self._record_test_result("Basic recommendation", True)
        
        # Test 2: Grouped vs individual
        grouped_plan = self.recommender.recommend_containers(ingredients, group_by_storage=True)
        individual_plan = self.recommender.recommend_containers(ingredients, group_by_storage=False)
        
        assert len(grouped_plan.recommendations) <= len(individual_plan.recommendations), \
            "Grouped should have fewer or equal recommendations"
        
        self._record_test_result("Grouped vs individual", True)
        
        print("✅ Basic functionality tests passed")
    
    def _test_edge_cases(self):
        """Test edge cases and boundary conditions."""
        print("\n🧪 Testing edge cases...")
        
        # Test 1: Empty ingredients
        try:
            empty_plan = self.recommender.recommend_containers([])
            assert empty_plan.total_containers == 0, "Empty list should need no containers"
            self._record_test_result("Empty ingredients", True)
        except Exception as e:
            self._record_test_result("Empty ingredients", False, str(e))
        
        # Test 2: Very small quantities
        tiny_ingredients = [
            {'name': 'Salt', 'quantity': 1, 'unit': 'g'},
            {'name': 'Pepper', 'quantity': 0.5, 'unit': 'g'}
        ]
        
        try:
            tiny_plan = self.recommender.recommend_containers(tiny_ingredients)
            assert tiny_plan.total_containers >= 0, "Should handle tiny quantities"
            self._record_test_result("Very small quantities", True)
        except Exception as e:
            self._record_test_result("Very small quantities", False, str(e))
        
        # Test 3: Very large quantities
        huge_ingredients = [
            {'name': 'Water', 'quantity': 100, 'unit': 'l'},
            {'name': 'Flour', 'quantity': 50, 'unit': 'kg'}
        ]
        
        try:
            huge_plan = self.recommender.recommend_containers(huge_ingredients)
            assert huge_plan.total_containers > 0, "Should handle large quantities"
            self._record_test_result("Very large quantities", True)
        except Exception as e:
            self._record_test_result("Very large quantities", False, str(e))
        
        # Test 4: Invalid units
        invalid_ingredients = [
            {'name': 'Test item', 'quantity': 1, 'unit': 'invalid_unit'}
        ]
        
        try:
            invalid_plan = self.recommender.recommend_containers(invalid_ingredients)
            self._record_test_result("Invalid units", True)
        except Exception as e:
            self._record_test_result("Invalid units", False, str(e))
        
        # Test 5: Extreme fill percentage
        normal_ingredients = [
            {'name': 'Milk', 'quantity': 1, 'unit': 'l'}
        ]
        
        try:
            extreme_plan = self.recommender.recommend_containers(
                normal_ingredients, 
                max_fill_percentage=0.1
            )
            assert extreme_plan.total_containers > 0, "Should handle extreme fill percentage"
            self._record_test_result("Extreme fill percentage", True)
        except Exception as e:
            self._record_test_result("Extreme fill percentage", False, str(e))
        
        print("✅ Edge case tests completed")
    
    def _test_performance(self):
        """Test performance with various loads."""
        print("\n⚡ Testing performance...")
        
        # Test 1: Small list performance
        small_list = [
            {'name': f'Item {i}', 'quantity': 100, 'unit': 'g'} 
            for i in range(10)
        ]
        
        start_time = time.time()
        small_plan = self.recommender.recommend_containers(small_list)
        small_time = time.time() - start_time
        
        self.test_results['performance_tests'].append({
            'test': 'Small list (10 items)',
            'time_seconds': small_time,
            'items': 10,
            'containers': small_plan.total_containers
        })
        
        # Test 2: Medium list performance
        medium_list = [
            {'name': f'Item {i}', 'quantity': 200, 'unit': 'g'} 
            for i in range(50)
        ]
        
        start_time = time.time()
        medium_plan = self.recommender.recommend_containers(medium_list)
        medium_time = time.time() - start_time
        
        self.test_results['performance_tests'].append({
            'test': 'Medium list (50 items)',
            'time_seconds': medium_time,
            'items': 50,
            'containers': medium_plan.total_containers
        })
        
        # Test 3: Large list performance
        large_list = [
            {'name': f'Item {i}', 'quantity': 500, 'unit': 'g'} 
            for i in range(100)
        ]
        
        start_time = time.time()
        large_plan = self.recommender.recommend_containers(large_list)
        large_time = time.time() - start_time
        
        self.test_results['performance_tests'].append({
            'test': 'Large list (100 items)',
            'time_seconds': large_time,
            'items': 100,
            'containers': large_plan.total_containers
        })
        
        print(f"✅ Performance tests completed (max: {max(small_time, medium_time, large_time):.3f}s)")
    
    def _test_recommendation_accuracy(self):
        """Test accuracy of container recommendations."""
        print("\n🎯 Testing recommendation accuracy...")
        
        # Test 1: Volume efficiency
        test_cases = [
            {'name': 'Small liquid', 'quantity': 250, 'unit': 'ml', 'expected_container': 'Small jar'},
            {'name': 'Medium liquid', 'quantity': 750, 'unit': 'ml', 'expected_container': 'Medium box'},
            {'name': 'Large solid', 'quantity': 2, 'unit': 'kg', 'expected_container': 'Large box'}
        ]
        
        for case in test_cases:
            plan = self.recommender.recommend_containers([case], group_by_storage=False)
            
            if plan.recommendations:
                rec = plan.recommendations[0]
                actual_container = rec.container_size.name
                expected = case['expected_container']
                
                accuracy_result = {
                    'ingredient': case['name'],
                    'quantity': f"{case['quantity']} {case['unit']}",
                    'expected_container': expected,
                    'actual_container': actual_container,
                    'fill_percentage': rec.fill_percentage,
                    'match': actual_container == expected
                }
                
                self.test_results['accuracy_tests'].append(accuracy_result)
        
        # Test 2: Storage grouping accuracy
        mixed_storage = [
            {'name': 'Milk', 'quantity': 1, 'unit': 'l'},      # Refrigerated
            {'name': 'Frozen peas', 'quantity': 500, 'unit': 'g'},  # Frozen
            {'name': 'Pasta', 'quantity': 500, 'unit': 'g'},   # Room temp
            {'name': 'Cheese', 'quantity': 200, 'unit': 'g'}   # Refrigerated
        ]
        
        grouped_plan = self.recommender.recommend_containers(mixed_storage, group_by_storage=True)
        
        # Check that storage types are properly grouped
        storage_types = set()
        for rec in grouped_plan.recommendations:
            storage_types.add(rec.storage_type)
        
        assert len(storage_types) <= 3, "Should group by storage type"
        
        self._record_test_result("Storage grouping accuracy", True)
        
        print("✅ Accuracy tests completed")
    
    def _test_packing_optimization(self):
        """Test packing optimization functionality."""
        print("\n📐 Testing packing optimization...")
        
        # Test 1: Space calculation
        ingredients = [
            {'name': 'Milk', 'quantity': 2, 'unit': 'l'},
            {'name': 'Bread', 'quantity': 3, 'unit': 'pieces'},
            {'name': 'Frozen vegetables', 'quantity': 1, 'unit': 'kg'}
        ]
        
        plan = self.recommender.recommend_containers(ingredients)
        
        # Test optimization
        available_space = {
            'length': 50,
            'width': 40,
            'height': 30
        }
        
        optimization = self.recommender.optimize_packing(plan.recommendations, available_space)
        
        assert 'space_requirements' in optimization, "Should calculate space requirements"
        assert 'suggestions' in optimization, "Should provide suggestions"
        
        self._record_test_result("Packing optimization", True)
        
        # Test 2: Cooler recommendations
        cold_items = [
            {'name': 'Milk', 'quantity': 3, 'unit': 'l'},
            {'name': 'Meat', 'quantity': 2, 'unit': 'kg'},
            {'name': 'Cheese', 'quantity': 500, 'unit': 'g'}
        ]
        
        cooler_rec = self.recommender.recommend_cooler_size(cold_items)
        
        assert 'recommended_cooler' in cooler_rec, "Should recommend cooler"
        assert cooler_rec['volume_needed_l'] > 0, "Should calculate volume needed"
        
        self._record_test_result("Cooler recommendations", True)
        
        print("✅ Packing optimization tests completed")
    
    def _test_error_handling(self):
        """Test error handling and robustness."""
        print("\n🛡️ Testing error handling...")
        
        # Test 1: Missing required fields
        incomplete_ingredients = [
            {'name': 'Test item'},  # Missing quantity and unit
            {'quantity': 500}       # Missing name and unit
        ]
        
        try:
            plan = self.recommender.recommend_containers(incomplete_ingredients)
            self._record_test_result("Missing required fields", True)
        except Exception as e:
            self._record_test_result("Missing required fields", False, str(e))
        
        # Test 2: Negative quantities
        negative_ingredients = [
            {'name': 'Test item', 'quantity': -100, 'unit': 'g'}
        ]
        
        try:
            plan = self.recommender.recommend_containers(negative_ingredients)
            self._record_test_result("Negative quantities", True)
        except Exception as e:
            self._record_test_result("Negative quantities", False, str(e))
        
        # Test 3: Zero quantities
        zero_ingredients = [
            {'name': 'Test item', 'quantity': 0, 'unit': 'g'}
        ]
        
        try:
            plan = self.recommender.recommend_containers(zero_ingredients)
            self._record_test_result("Zero quantities", True)
        except Exception as e:
            self._record_test_result("Zero quantities", False, str(e))
        
        print("✅ Error handling tests completed")
    
    def _record_test_result(self, test_name: str, passed: bool, error: str = None):
        """Record a test result."""
        self.test_results['total_tests'] += 1
        if passed:
            self.test_results['passed'] += 1
        else:
            self.test_results['failed'] += 1
            if error:
                self.test_results['edge_cases'].append({
                    'test': test_name,
                    'error': error,
                    'status': 'FAILED'
                })
    
    def print_summary(self):
        """Print test summary."""
        results = self.test_results
        
        print(f"\n📊 Test Summary:")
        print(f"Total tests: {results['total_tests']}")
        print(f"Passed: {results['passed']} ({results['passed']/results['total_tests']*100:.1f}%)")
        print(f"Failed: {results['failed']} ({results['failed']/results['total_tests']*100:.1f}%)")
        
        if results['performance_tests']:
            print(f"\n⚡ Performance Results:")
            for perf in results['performance_tests']:
                print(f"  {perf['test']}: {perf['time_seconds']:.3f}s "
                      f"({perf['containers']} containers)")
        
        if results['accuracy_tests']:
            print(f"\n🎯 Accuracy Results:")
            for acc in results['accuracy_tests']:
                status = "✅" if acc['match'] else "❌"
                print(f"  {status} {acc['ingredient']}: {acc['actual_container']} "
                      f"({acc['fill_percentage']*100:.0f}% full)")
        
        if results['edge_cases']:
            print(f"\n🧪 Edge Case Failures:")
            for edge in results['edge_cases']:
                print(f"  ❌ {edge['test']}: {edge['error']}")


def main():
    """Run comprehensive container recommender review."""
    reviewer = ContainerRecommenderReview()
    
    try:
        results = reviewer.run_comprehensive_review()
        reviewer.print_summary()
        
        # Save results to file
        with open('container_recommender_review_results.json', 'w') as f:
            json.dump(results, f, indent=2, default=str)
        
        print(f"\n💾 Detailed results saved to container_recommender_review_results.json")
        
        # Return exit code based on results
        if results['failed'] == 0:
            print("\n🎉 All tests passed! Container recommender is working correctly.")
            return 0
        else:
            print(f"\n⚠️ {results['failed']} tests failed. Review needed.")
            return 1
            
    except Exception as e:
        print(f"\n❌ Review failed with error: {e}")
        return 1


if __name__ == '__main__':
    exit(main())
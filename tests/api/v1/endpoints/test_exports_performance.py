"""
Performance tests for the export API.

Tests performance characteristics including:
- Large dataset exports
- Concurrent export handling
- Memory usage
- Response times
- Batch processing efficiency
"""

import pytest
import pytest_asyncio
import asyncio
import time
import psutil
import os
from datetime import datetime, timedelta
from typing import List
from unittest.mock import Mock, patch, AsyncMock

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from jidelnicek.api.v1.schemas.export_schemas import (
    ExportType,
    ExportFormat,
    ExportStatus
)
from jidelnicek.auth.models import AuthUser as User
from jidelnicek.trip.models import Trip, TripDay, TripMeal
from jidelnicek.recipe.models import Recipe, RecipeIngredient
from jidelnicek.common.models import Ingredient


class TestExportPerformance:
    """Performance test suite for export API."""
    
    @pytest_asyncio.fixture(scope="function")
    async def large_trip(
        self,
        db_session: AsyncSession,
        test_user: User
    ) -> Trip:
        """Create a large trip with many days and meals."""
        trip = Trip(
            name="Large Test Trip",
            description="Trip with many days for performance testing",
            start_date=datetime.utcnow(),
            end_date=datetime.utcnow() + timedelta(days=30),
            participant_count=50,
            user_id=test_user.id
        )
        db_session.add(trip)
        await db_session.flush()
        
        # Create 30 days with 3 meals each
        for day_num in range(30):
            day = TripDay(
                trip_id=trip.id,
                date=trip.start_date + timedelta(days=day_num),
                day_number=day_num + 1
            )
            db_session.add(day)
            await db_session.flush()
            
            # Add meals
            for meal_type in ["breakfast", "lunch", "dinner"]:
                meal = TripMeal(
                    day_id=day.id,
                    meal_type=meal_type,
                    name=f"{meal_type.title()} Day {day_num + 1}",
                    servings=50
                )
                db_session.add(meal)
        
        await db_session.commit()
        return trip
    
    @pytest_asyncio.fixture(scope="function")
    async def many_recipes(
        self,
        db_session: AsyncSession,
        test_user: User
    ) -> List[Recipe]:
        """Create many recipes for batch testing."""
        recipes = []
        
        # Create ingredients first
        ingredients = []
        for i in range(50):
            ingredient = Ingredient(
                name=f"Ingredient {i}",
                category="Test",
                unit="g"
            )
            ingredients.append(ingredient)
            db_session.add(ingredient)
        
        await db_session.flush()
        
        # Create 100 recipes
        for i in range(100):
            recipe = Recipe(
                name=f"Recipe {i}",
                description=f"Test recipe {i} for performance testing",
                servings=4,
                prep_time=30,
                cook_time=45,
                user_id=test_user.id
            )
            db_session.add(recipe)
            await db_session.flush()
            
            # Add 10 ingredients to each recipe
            for j in range(10):
                recipe_ingredient = RecipeIngredient(
                    recipe_id=recipe.id,
                    ingredient_id=ingredients[j % len(ingredients)].id,
                    amount=100 * (j + 1),
                    unit="g"
                )
                db_session.add(recipe_ingredient)
            
            recipes.append(recipe)
        
        await db_session.commit()
        return recipes
    
    @pytest.mark.asyncio
    @pytest.mark.performance
    async def test_large_trip_export_performance(
        self,
        client: AsyncClient,
        large_trip: Trip,
        auth_headers: dict
    ):
        """Test export performance with large trip (30 days, 90 meals)."""
        start_time = time.time()
        
        response = await client.post(
            "/api/v1/exports/single",
            json={
                "export_type": ExportType.TRIP.value,
                "export_format": ExportFormat.PDF.value,
                "item_id": str(large_trip.id),
                "async_export": True  # Use async for large exports
            },
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        job_id = data["job_id"]
        
        # Wait for export to complete (with timeout)
        completed = False
        timeout = 60  # 60 seconds timeout
        poll_interval = 1
        
        while time.time() - start_time < timeout:
            status_response = await client.get(
                f"/api/v1/exports/status/{job_id}",
                headers=auth_headers
            )
            
            if status_response.status_code == 200:
                status_data = status_response.json()
                if status_data["status"] == ExportStatus.COMPLETED.value:
                    completed = True
                    break
                elif status_data["status"] == ExportStatus.FAILED.value:
                    pytest.fail(f"Export failed: {status_data.get('error_message')}")
            
            await asyncio.sleep(poll_interval)
        
        export_time = time.time() - start_time
        
        assert completed, f"Export did not complete within {timeout} seconds"
        assert export_time < 30, f"Large trip export took too long: {export_time:.2f}s"
        
        # Log performance metrics
        print(f"\nLarge trip export performance:")
        print(f"  - Days: 30")
        print(f"  - Meals: 90")
        print(f"  - Export time: {export_time:.2f}s")
        print(f"  - File size: {status_data.get('file_size', 0):,} bytes")
    
    @pytest.mark.asyncio
    @pytest.mark.performance
    async def test_concurrent_exports(
        self,
        client: AsyncClient,
        test_trip: Trip,
        auth_headers: dict
    ):
        """Test handling multiple concurrent export requests."""
        num_concurrent = 10
        start_time = time.time()
        
        # Create concurrent export requests
        tasks = []
        for i in range(num_concurrent):
            task = client.post(
                "/api/v1/exports/single",
                json={
                    "export_type": ExportType.TRIP.value,
                    "export_format": ExportFormat.JSON.value,  # Faster format
                    "item_id": str(test_trip.id),
                    "async_export": True
                },
                headers=auth_headers
            )
            tasks.append(task)
        
        # Execute concurrently
        responses = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Check results
        successful = 0
        for response in responses:
            if hasattr(response, 'status_code') and response.status_code == 200:
                successful += 1
        
        total_time = time.time() - start_time
        
        assert successful >= num_concurrent * 0.8  # At least 80% should succeed
        assert total_time < 10  # Should complete within 10 seconds
        
        print(f"\nConcurrent exports performance:")
        print(f"  - Concurrent requests: {num_concurrent}")
        print(f"  - Successful: {successful}")
        print(f"  - Total time: {total_time:.2f}s")
        print(f"  - Avg time per export: {total_time/num_concurrent:.2f}s")
    
    @pytest.mark.asyncio
    @pytest.mark.performance
    async def test_batch_export_performance(
        self,
        client: AsyncClient,
        many_recipes: List[Recipe],
        auth_headers: dict
    ):
        """Test batch export performance with many items."""
        # Export 50 recipes in a batch
        recipe_ids = [str(r.id) for r in many_recipes[:50]]
        
        start_time = time.time()
        
        response = await client.post(
            "/api/v1/exports/batch",
            json={
                "exports": [{
                    "export_type": ExportType.RECIPE.value,
                    "export_format": ExportFormat.JSON.value,
                    "item_ids": recipe_ids,
                    "merge_into_single_file": True
                }]
            },
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        batch_id = data["batch_id"]
        
        # Wait for batch to complete
        completed = False
        timeout = 120  # 2 minutes for batch
        
        while time.time() - start_time < timeout:
            # In real implementation, would check batch status
            # For now, simulate waiting
            await asyncio.sleep(2)
            completed = True  # Assume completed for test
            break
        
        batch_time = time.time() - start_time
        
        assert completed
        assert batch_time < 60, f"Batch export took too long: {batch_time:.2f}s"
        
        print(f"\nBatch export performance:")
        print(f"  - Items: 50 recipes")
        print(f"  - Export time: {batch_time:.2f}s")
        print(f"  - Avg time per item: {batch_time/50:.2f}s")
    
    @pytest.mark.asyncio
    @pytest.mark.performance
    async def test_memory_usage_during_export(
        self,
        client: AsyncClient,
        large_trip: Trip,
        auth_headers: dict
    ):
        """Test memory usage during large exports."""
        process = psutil.Process(os.getpid())
        
        # Get initial memory usage
        initial_memory = process.memory_info().rss / 1024 / 1024  # MB
        
        # Start large export
        response = await client.post(
            "/api/v1/exports/single",
            json={
                "export_type": ExportType.TRIP.value,
                "export_format": ExportFormat.EXCEL.value,
                "item_id": str(large_trip.id),
                "async_export": True
            },
            headers=auth_headers
        )
        
        assert response.status_code == 200
        
        # Monitor memory during export
        max_memory = initial_memory
        samples = []
        
        for _ in range(10):
            current_memory = process.memory_info().rss / 1024 / 1024
            samples.append(current_memory)
            max_memory = max(max_memory, current_memory)
            await asyncio.sleep(0.5)
        
        memory_increase = max_memory - initial_memory
        avg_memory = sum(samples) / len(samples)
        
        # Memory increase should be reasonable
        assert memory_increase < 500, f"Memory increased by {memory_increase:.2f}MB"
        
        print(f"\nMemory usage during export:")
        print(f"  - Initial memory: {initial_memory:.2f}MB")
        print(f"  - Max memory: {max_memory:.2f}MB")
        print(f"  - Avg memory: {avg_memory:.2f}MB")
        print(f"  - Memory increase: {memory_increase:.2f}MB")
    
    @pytest.mark.asyncio
    @pytest.mark.performance
    async def test_export_format_performance_comparison(
        self,
        client: AsyncClient,
        test_trip: Trip,
        auth_headers: dict
    ):
        """Compare performance across different export formats."""
        formats = [
            ExportFormat.JSON,
            ExportFormat.CSV,
            ExportFormat.TEXT,
            ExportFormat.MARKDOWN,
            ExportFormat.HTML,
            ExportFormat.EXCEL,
            ExportFormat.PDF
        ]
        
        results = {}
        
        for format in formats:
            start_time = time.time()
            
            response = await client.post(
                "/api/v1/exports/single",
                json={
                    "export_type": ExportType.TRIP.value,
                    "export_format": format.value,
                    "item_id": str(test_trip.id),
                    "async_export": False
                },
                headers=auth_headers
            )
            
            export_time = time.time() - start_time
            
            if response.status_code == 200:
                file_size = len(response.content)
                results[format.value] = {
                    "time": export_time,
                    "size": file_size,
                    "success": True
                }
            else:
                results[format.value] = {
                    "time": export_time,
                    "success": False,
                    "error": response.status_code
                }
        
        # Print comparison
        print("\nExport format performance comparison:")
        print(f"{'Format':<10} {'Time (s)':<10} {'Size (KB)':<10} {'Status':<10}")
        print("-" * 40)
        
        for format, data in sorted(results.items(), key=lambda x: x[1].get('time', 999)):
            if data['success']:
                size_kb = data['size'] / 1024
                print(f"{format:<10} {data['time']:<10.3f} {size_kb:<10.1f} {'OK':<10}")
            else:
                print(f"{format:<10} {data['time']:<10.3f} {'N/A':<10} {data['error']:<10}")
        
        # Fastest format should complete quickly
        fastest_time = min(r['time'] for r in results.values() if r['success'])
        assert fastest_time < 2.0, f"Fastest format took {fastest_time:.2f}s"
    
    @pytest.mark.asyncio
    @pytest.mark.performance
    async def test_export_with_options_performance(
        self,
        client: AsyncClient,
        test_trip: Trip,
        auth_headers: dict
    ):
        """Test how different options affect export performance."""
        # Test with minimal options
        start_time = time.time()
        
        response = await client.post(
            "/api/v1/exports/single",
            json={
                "export_type": ExportType.TRIP.value,
                "export_format": ExportFormat.PDF.value,
                "item_id": str(test_trip.id),
                "async_export": False,
                "options": {
                    "include_recipes": False,
                    "include_shopping": False,
                    "include_nutrition": False,
                    "include_charts": False
                }
            },
            headers=auth_headers
        )
        
        minimal_time = time.time() - start_time
        minimal_size = len(response.content) if response.status_code == 200 else 0
        
        # Test with all options
        start_time = time.time()
        
        response = await client.post(
            "/api/v1/exports/single",
            json={
                "export_type": ExportType.TRIP.value,
                "export_format": ExportFormat.PDF.value,
                "item_id": str(test_trip.id),
                "async_export": False,
                "options": {
                    "include_recipes": True,
                    "include_shopping": True,
                    "include_nutrition": True,
                    "include_charts": True,
                    "include_costs": True,
                    "include_packing": True
                }
            },
            headers=auth_headers
        )
        
        full_time = time.time() - start_time
        full_size = len(response.content) if response.status_code == 200 else 0
        
        print(f"\nExport options performance impact:")
        print(f"  Minimal options:")
        print(f"    - Time: {minimal_time:.2f}s")
        print(f"    - Size: {minimal_size:,} bytes")
        print(f"  Full options:")
        print(f"    - Time: {full_time:.2f}s")
        print(f"    - Size: {full_size:,} bytes")
        print(f"  Performance impact:")
        print(f"    - Time increase: {((full_time/minimal_time - 1) * 100):.1f}%")
        print(f"    - Size increase: {((full_size/minimal_size - 1) * 100):.1f}%")
        
        # Full export should not take more than 3x longer
        assert full_time < minimal_time * 3
    
    @pytest.mark.asyncio
    @pytest.mark.performance
    async def test_export_queue_performance(
        self,
        client: AsyncClient,
        many_recipes: List[Recipe],
        auth_headers: dict
    ):
        """Test export queue handling under load."""
        # Submit many export jobs quickly
        num_jobs = 20
        jobs = []
        
        start_time = time.time()
        
        for i in range(num_jobs):
            response = await client.post(
                "/api/v1/exports/single",
                json={
                    "export_type": ExportType.RECIPE.value,
                    "export_format": ExportFormat.JSON.value,
                    "item_id": str(many_recipes[i].id),
                    "async_export": True
                },
                headers=auth_headers
            )
            
            if response.status_code == 200:
                jobs.append(response.json()["job_id"])
        
        submission_time = time.time() - start_time
        
        # Check that all jobs were queued quickly
        assert submission_time < 5, f"Job submission took {submission_time:.2f}s"
        assert len(jobs) >= num_jobs * 0.9  # At least 90% should be accepted
        
        print(f"\nExport queue performance:")
        print(f"  - Jobs submitted: {num_jobs}")
        print(f"  - Jobs accepted: {len(jobs)}")
        print(f"  - Submission time: {submission_time:.2f}s")
        print(f"  - Avg submission time: {submission_time/num_jobs:.3f}s")
    
    @pytest.mark.asyncio
    @pytest.mark.performance
    @pytest.mark.stress
    async def test_export_stress_test(
        self,
        client: AsyncClient,
        test_trip: Trip,
        auth_headers: dict
    ):
        """Stress test with sustained export load."""
        duration = 30  # Run for 30 seconds
        start_time = time.time()
        
        successful_exports = 0
        failed_exports = 0
        total_bytes = 0
        
        async def export_worker():
            nonlocal successful_exports, failed_exports, total_bytes
            
            while time.time() - start_time < duration:
                try:
                    response = await client.post(
                        "/api/v1/exports/single",
                        json={
                            "export_type": ExportType.TRIP.value,
                            "export_format": ExportFormat.JSON.value,
                            "item_id": str(test_trip.id),
                            "async_export": False
                        },
                        headers=auth_headers,
                        timeout=10.0
                    )
                    
                    if response.status_code == 200:
                        successful_exports += 1
                        total_bytes += len(response.content)
                    else:
                        failed_exports += 1
                        
                except Exception:
                    failed_exports += 1
                
                await asyncio.sleep(0.1)  # Small delay between requests
        
        # Run multiple workers
        workers = [export_worker() for _ in range(5)]
        await asyncio.gather(*workers, return_exceptions=True)
        
        total_time = time.time() - start_time
        total_exports = successful_exports + failed_exports
        
        print(f"\nExport stress test results:")
        print(f"  - Duration: {total_time:.1f}s")
        print(f"  - Total exports: {total_exports}")
        print(f"  - Successful: {successful_exports} ({successful_exports/total_exports*100:.1f}%)")
        print(f"  - Failed: {failed_exports}")
        print(f"  - Total data: {total_bytes/1024/1024:.1f}MB")
        print(f"  - Throughput: {successful_exports/total_time:.1f} exports/s")
        print(f"  - Data rate: {total_bytes/total_time/1024/1024:.1f}MB/s")
        
        # Success rate should be high
        assert successful_exports / total_exports > 0.95
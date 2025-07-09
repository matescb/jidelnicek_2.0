#!/usr/bin/env python3
"""
Minimal test for progress tracking functionality without full test setup.
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

import asyncio
import json
from unittest.mock import Mock, AsyncMock, patch
from datetime import datetime, timedelta

# Mock the config before importing
mock_settings = Mock()
mock_settings.cors_origins = ["http://localhost:3000"]
mock_settings.websocket_heartbeat_timeout = 60

with patch('jidelnicek.core.config.settings', mock_settings):
    from jidelnicek.core.services.progress_tracker import (
        ProgressTracker, ExportProgressTracker, ProgressStep, ProgressInfo
    )

async def test_basic_functionality():
    """Test basic progress tracking functionality."""
    print("Testing basic progress tracking...")
    
    # Create a progress tracker instance
    tracker = ProgressTracker(
        operation_id="test-123",
        operation_type="test_operation",
        user_id=1
    )
    
    # Test initialization
    steps = [
        {"name": "Step 1", "weight": 1.0},
        {"name": "Step 2", "weight": 2.0},
        {"name": "Step 3", "weight": 1.0}
    ]
    
    with patch('jidelnicek.core.services.progress_tracker.cache_set', new_callable=AsyncMock) as mock_cache_set:
        with patch('jidelnicek.core.services.progress_tracker.cache_get', new_callable=AsyncMock) as mock_cache_get:
            mock_cache_get.return_value = None  # No historical speeds
            
            await tracker.initialize(steps, total_items=100)
    
    assert len(tracker.steps) == 3
    assert tracker.steps[0].name == "Step 1"
    assert tracker.steps[1].weight == 2.0
    assert tracker.total_items == 100
    print("✓ Initialization test passed")
    
    # Test progress tracking
    with patch('jidelnicek.core.services.progress_tracker.cache_set', new_callable=AsyncMock):
        with patch('jidelnicek.core.services.progress_tracker.RedisClient'):
            with patch('jidelnicek.core.services.progress_tracker.connection_manager') as mock_cm:
                mock_cm.send_export_progress = AsyncMock()
                mock_cm.broadcast_to_room = AsyncMock()
                
                # Start first step
                await tracker.start_step(0, "Starting step 1")
                assert tracker.steps[0].status == "in_progress"
                
                # Update progress
                await tracker.update_step_progress(50, message="Halfway through")
                assert tracker.steps[0].progress == 50
                
                # Complete step
                await tracker.complete_step()
                assert tracker.steps[0].status == "completed"
                assert tracker.steps[0].progress == tracker.steps[0].total
    
    print("✓ Step progress tracking test passed")
    
    # Test overall progress calculation
    progress_tracker = ProgressTracker(
        operation_id="test-456",
        operation_type="test_operation",
        user_id=1
    )
    
    steps = [
        {"name": "Step 1", "weight": 1.0, "total": 100},
        {"name": "Step 2", "weight": 2.0, "total": 100},
        {"name": "Step 3", "weight": 1.0, "total": 100}
    ]
    
    with patch('jidelnicek.core.services.progress_tracker.cache_set', new_callable=AsyncMock):
        with patch('jidelnicek.core.services.progress_tracker.cache_get', new_callable=AsyncMock):
            await progress_tracker.initialize(steps)
    
    # Complete first step (25% of total weight)
    progress_tracker.steps[0].status = "completed"
    progress_tracker.steps[0].progress = 100
    assert progress_tracker._calculate_overall_progress() == 25.0
    
    # Halfway through second step (25% + 25% = 50%)
    progress_tracker.steps[1].status = "in_progress"
    progress_tracker.steps[1].progress = 50
    assert progress_tracker._calculate_overall_progress() == 50.0
    
    # Complete all steps
    for step in progress_tracker.steps:
        step.status = "completed"
        step.progress = step.total
    assert progress_tracker._calculate_overall_progress() == 100.0
    
    print("✓ Overall progress calculation test passed")
    
    # Test ETA calculation
    eta_tracker = ProgressTracker(
        operation_id="test-eta",
        operation_type="test_operation",
        user_id=1
    )
    
    steps = [{"name": "Step 1", "weight": 1.0}]
    
    with patch('jidelnicek.core.services.progress_tracker.cache_set', new_callable=AsyncMock):
        with patch('jidelnicek.core.services.progress_tracker.cache_get', new_callable=AsyncMock):
            await eta_tracker.initialize(steps, total_items=100)
    
    # Simulate some progress
    eta_tracker.started_at = datetime.utcnow() - timedelta(seconds=10)
    eta_tracker.steps[0].status = "in_progress"
    eta_tracker.steps[0].progress = 50
    eta_tracker.items_processed = 50
    
    eta = eta_tracker._calculate_eta()
    assert eta is not None
    assert eta > 0  # Should have some time remaining
    
    print("✓ ETA calculation test passed")
    
    # Test export progress tracker
    export_tracker = ExportProgressTracker(
        export_id="export-123",
        export_type="shopping_list",
        user_id=1
    )
    
    with patch('jidelnicek.core.services.progress_tracker.cache_set', new_callable=AsyncMock):
        with patch('jidelnicek.core.services.progress_tracker.cache_get', new_callable=AsyncMock):
            await export_tracker.initialize_export(
                total_items=1000,
                export_format="pdf",
                include_compression=True,
                include_upload=True
            )
    
    # Should have standard export steps
    step_names = [step.name for step in export_tracker.steps]
    assert "Data preparation" in step_names
    assert "Generating PDF" in step_names
    assert "Compressing file" in step_names
    assert "Uploading to storage" in step_names
    assert "Finalizing export" in step_names
    
    print("✓ Export progress tracker test passed")
    
    print("\n✅ All progress tracking tests passed!")

if __name__ == "__main__":
    asyncio.run(test_basic_functionality())
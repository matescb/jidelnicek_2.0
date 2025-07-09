"""
Tests for the progress tracking system.
"""

import pytest
import asyncio
import json
from datetime import datetime, timedelta
from unittest.mock import Mock, AsyncMock, patch

from jidelnicek.core.services.progress_tracker import (
    ProgressTracker, ExportProgressTracker, ProgressStep, ProgressInfo
)


@pytest.fixture
async def progress_tracker():
    """Create a progress tracker instance."""
    tracker = ProgressTracker(
        operation_id="test-123",
        operation_type="test_operation",
        user_id=1
    )
    return tracker


@pytest.fixture
async def export_tracker():
    """Create an export progress tracker instance."""
    tracker = ExportProgressTracker(
        export_id="export-123",
        export_type="shopping_list",
        user_id=1
    )
    return tracker


@pytest.mark.asyncio
async def test_progress_tracker_initialization(progress_tracker):
    """Test progress tracker initialization."""
    steps = [
        {"name": "Step 1", "weight": 1.0},
        {"name": "Step 2", "weight": 2.0},
        {"name": "Step 3", "weight": 1.0}
    ]
    
    with patch('jidelnicek.core.services.progress_tracker.cache_set', new_callable=AsyncMock):
        await progress_tracker.initialize(steps, total_items=100)
    
    assert len(progress_tracker.steps) == 3
    assert progress_tracker.steps[0].name == "Step 1"
    assert progress_tracker.steps[1].weight == 2.0
    assert progress_tracker.total_items == 100


@pytest.mark.asyncio
async def test_step_progress_tracking(progress_tracker):
    """Test tracking progress through steps."""
    steps = [
        {"name": "Step 1", "weight": 1.0},
        {"name": "Step 2", "weight": 1.0}
    ]
    
    with patch('jidelnicek.core.services.progress_tracker.cache_set', new_callable=AsyncMock):
        with patch('jidelnicek.core.services.progress_tracker.RedisClient'):
            with patch('jidelnicek.core.services.progress_tracker.connection_manager') as mock_cm:
                mock_cm.send_export_progress = AsyncMock()
                mock_cm.broadcast_to_room = AsyncMock()
                
                await progress_tracker.initialize(steps)
                
                # Start first step
                await progress_tracker.start_step(0, "Starting step 1")
                assert progress_tracker.steps[0].status == "in_progress"
                
                # Update progress
                await progress_tracker.update_step_progress(50, message="Halfway through")
                assert progress_tracker.steps[0].progress == 50
                
                # Complete step
                await progress_tracker.complete_step()
                assert progress_tracker.steps[0].status == "completed"
                assert progress_tracker.steps[0].progress == progress_tracker.steps[0].total


@pytest.mark.asyncio
async def test_overall_progress_calculation(progress_tracker):
    """Test overall progress calculation with weighted steps."""
    steps = [
        {"name": "Step 1", "weight": 1.0, "total": 100},
        {"name": "Step 2", "weight": 2.0, "total": 100},
        {"name": "Step 3", "weight": 1.0, "total": 100}
    ]
    
    with patch('jidelnicek.core.services.progress_tracker.cache_set', new_callable=AsyncMock):
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


@pytest.mark.asyncio
async def test_eta_calculation(progress_tracker):
    """Test ETA calculation."""
    steps = [{"name": "Step 1", "weight": 1.0}]
    
    with patch('jidelnicek.core.services.progress_tracker.cache_set', new_callable=AsyncMock):
        await progress_tracker.initialize(steps, total_items=100)
    
    # Simulate some progress
    progress_tracker.started_at = datetime.utcnow() - timedelta(seconds=10)
    progress_tracker.steps[0].status = "in_progress"
    progress_tracker.steps[0].progress = 50
    progress_tracker.items_processed = 50
    
    eta = progress_tracker._calculate_eta()
    assert eta is not None
    assert eta > 0  # Should have some time remaining


@pytest.mark.asyncio
async def test_speed_calculation(progress_tracker):
    """Test processing speed calculation."""
    with patch('jidelnicek.core.services.progress_tracker.cache_set', new_callable=AsyncMock):
        await progress_tracker.initialize([{"name": "Step 1"}], total_items=100)
    
    # Add some historical speeds
    progress_tracker.historical_speeds = [10.0, 12.0, 11.0]
    
    speed = progress_tracker._get_current_speed()
    assert speed == 11.0  # Average of historical speeds


@pytest.mark.asyncio
async def test_export_progress_tracker_initialization(export_tracker):
    """Test export progress tracker specialized initialization."""
    with patch('jidelnicek.core.services.progress_tracker.cache_set', new_callable=AsyncMock):
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


@pytest.mark.asyncio
async def test_progress_persistence(progress_tracker):
    """Test progress data persistence in Redis."""
    steps = [{"name": "Step 1"}]
    
    saved_data = None
    
    async def mock_cache_set(key, data, expire=None):
        nonlocal saved_data
        saved_data = data
    
    with patch('jidelnicek.core.services.progress_tracker.cache_set', side_effect=mock_cache_set):
        with patch('jidelnicek.core.services.progress_tracker.RedisClient'):
            with patch('jidelnicek.core.services.progress_tracker.connection_manager') as mock_cm:
                mock_cm.send_export_progress = AsyncMock()
                mock_cm.broadcast_to_room = AsyncMock()
                
                await progress_tracker.initialize(steps)
                await progress_tracker.start_step(0, "Test message")
    
    # Verify saved data
    assert saved_data is not None
    progress_data = json.loads(saved_data)
    assert progress_data["operation_id"] == "test-123"
    assert progress_data["operation_type"] == "test_operation"
    assert progress_data["message"] == "Test message"
    assert progress_data["status"] == "in_progress"


@pytest.mark.asyncio
async def test_progress_completion(progress_tracker):
    """Test progress completion."""
    steps = [{"name": "Step 1"}, {"name": "Step 2"}]
    
    with patch('jidelnicek.core.services.progress_tracker.cache_set', new_callable=AsyncMock):
        with patch('jidelnicek.core.services.progress_tracker.RedisClient'):
            with patch('jidelnicek.core.services.progress_tracker.connection_manager') as mock_cm:
                mock_cm.send_export_progress = AsyncMock()
                mock_cm.broadcast_to_room = AsyncMock()
                
                await progress_tracker.initialize(steps)
                await progress_tracker.complete("completed", "Operation finished")
    
    # All steps should be completed
    for step in progress_tracker.steps:
        assert step.status == "completed"


@pytest.mark.asyncio
async def test_progress_failure(progress_tracker):
    """Test progress failure handling."""
    steps = [{"name": "Step 1"}]
    
    with patch('jidelnicek.core.services.progress_tracker.cache_set', new_callable=AsyncMock):
        with patch('jidelnicek.core.services.progress_tracker.RedisClient'):
            with patch('jidelnicek.core.services.progress_tracker.connection_manager') as mock_cm:
                mock_cm.send_export_progress = AsyncMock()
                mock_cm.broadcast_to_room = AsyncMock()
                
                await progress_tracker.initialize(steps)
                await progress_tracker.fail("Something went wrong")
    
    # Check that failure was recorded
    assert mock_cm.send_export_progress.called
    call_args = mock_cm.send_export_progress.call_args[1]
    assert "Failed: Something went wrong" in call_args["status"]


@pytest.mark.asyncio
async def test_progress_cancellation(progress_tracker):
    """Test progress cancellation."""
    steps = [{"name": "Step 1"}]
    
    with patch('jidelnicek.core.services.progress_tracker.cache_set', new_callable=AsyncMock):
        with patch('jidelnicek.core.services.progress_tracker.RedisClient'):
            with patch('jidelnicek.core.services.progress_tracker.connection_manager') as mock_cm:
                mock_cm.send_export_progress = AsyncMock()
                mock_cm.broadcast_to_room = AsyncMock()
                
                await progress_tracker.initialize(steps)
                await progress_tracker.cancel()
    
    # Check that cancellation was recorded
    assert mock_cm.send_export_progress.called
    call_args = mock_cm.send_export_progress.call_args[1]
    assert "cancelled" in call_args["status"].lower()


@pytest.mark.asyncio
async def test_get_progress_info(progress_tracker):
    """Test retrieving progress information."""
    mock_data = {
        "operation_id": "test-123",
        "operation_type": "test_operation",
        "user_id": 1,
        "total_steps": 2,
        "current_step": 1,
        "overall_progress": 50.0,
        "status": "in_progress",
        "message": "Processing...",
        "started_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
        "eta_seconds": 30,
        "speed": 10.5,
        "steps": []
    }
    
    with patch('jidelnicek.core.services.progress_tracker.cache_get', 
               return_value=json.dumps(mock_data)):
        progress_info = await progress_tracker.get_progress()
    
    assert progress_info is not None
    assert progress_info.operation_id == "test-123"
    assert progress_info.overall_progress == 50.0
    assert progress_info.status == "in_progress"
    assert progress_info.eta_seconds == 30


@pytest.mark.asyncio
async def test_concurrent_progress_updates(progress_tracker):
    """Test handling concurrent progress updates."""
    steps = [{"name": "Step 1"}]
    
    update_count = 0
    
    async def mock_update_progress(*args, **kwargs):
        nonlocal update_count
        update_count += 1
        await asyncio.sleep(0.01)  # Simulate some work
    
    with patch.object(progress_tracker, '_update_progress', side_effect=mock_update_progress):
        await progress_tracker.initialize(steps)
        
        # Simulate concurrent updates
        tasks = []
        for i in range(10):
            tasks.append(
                asyncio.create_task(
                    progress_tracker.update_step_progress(i * 10)
                )
            )
        
        await asyncio.gather(*tasks)
    
    # All updates should have been processed
    assert update_count >= 10  # At least one per update


@pytest.mark.asyncio
async def test_historical_speed_persistence(progress_tracker):
    """Test saving and loading historical speed data."""
    progress_tracker.historical_speeds = [10.0, 15.0, 12.0]
    
    saved_speeds = None
    
    async def mock_cache_set(key, data, expire=None):
        nonlocal saved_speeds
        if "historical_speeds" in key:
            saved_speeds = data
    
    with patch('jidelnicek.core.services.progress_tracker.cache_set', side_effect=mock_cache_set):
        await progress_tracker._save_historical_speeds()
    
    assert saved_speeds is not None
    loaded_speeds = json.loads(saved_speeds)
    assert loaded_speeds == [10.0, 15.0, 12.0]
    
    # Test loading
    with patch('jidelnicek.core.services.progress_tracker.cache_get', 
               return_value=saved_speeds):
        await progress_tracker._load_historical_speeds()
    
    assert progress_tracker.historical_speeds == [10.0, 15.0, 12.0]
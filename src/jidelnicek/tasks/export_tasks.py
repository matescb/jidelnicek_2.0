"""
Export tasks for background processing.

This module contains Celery tasks for handling various export operations
asynchronously, including shopping lists, trip data, and recipes.
"""

import os
import uuid
import json
import tempfile
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from pathlib import Path
import logging

from celery import Task, current_task
from celery.exceptions import SoftTimeLimitExceeded
from sqlalchemy.ext.asyncio import AsyncSession

from jidelnicek.core.celery_app import app
from jidelnicek.core.dependencies import DatabaseSession, RedisClient
from jidelnicek.shopping.services.export_manager import ExportManager
from jidelnicek.trip.services.export.export_manager import TripExportManager
from jidelnicek.recipe.services.recipe_service import RecipeService
from jidelnicek.core.config import settings

logger = logging.getLogger(__name__)


class ExportTask(Task):
    """Base class for export tasks with common functionality."""
    
    def on_failure(self, exc, task_id, args, kwargs, einfo):
        """Handle task failure."""
        logger.error(f"Task {task_id} failed: {exc}")
        # Update job status in database
        self.update_job_status(task_id, "failed", error=str(exc))
    
    def on_success(self, retval, task_id, args, kwargs):
        """Handle task success."""
        logger.info(f"Task {task_id} completed successfully")
        # Update job status in database
        self.update_job_status(task_id, "completed", result=retval)
    
    def update_job_status(self, task_id: str, status: str, **kwargs):
        """Update job status in Redis."""
        try:
            import asyncio
            asyncio.run(self._update_job_status_async(task_id, status, **kwargs))
        except Exception as e:
            logger.error(f"Failed to update job status: {e}")
    
    async def _update_job_status_async(self, task_id: str, status: str, **kwargs):
        """Async method to update job status."""
        async with RedisClient() as redis:
            if redis:
                job_key = f"job:{task_id}"
                job_data = await redis.get(job_key)
                if job_data:
                    job_info = json.loads(job_data)
                else:
                    job_info = {}
                
                job_info.update({
                    "status": status,
                    "updated_at": datetime.utcnow().isoformat(),
                    **kwargs
                })
                
                await redis.set(job_key, json.dumps(job_info), ex=86400)  # Expire after 24 hours


@app.task(
    bind=True,
    base=ExportTask,
    name="jidelnicek.tasks.export_tasks.export_shopping_list",
    max_retries=3,
    default_retry_delay=60,
)
def export_shopping_list(
    self,
    trip_id: int,
    format: str = "pdf",
    options: Optional[Dict[str, Any]] = None,
    user_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Export shopping list for a trip.
    
    Args:
        trip_id: ID of the trip
        format: Export format (pdf, excel, csv, json, text)
        options: Export options
        user_id: ID of the user requesting the export
        
    Returns:
        Export result with file path and metadata
    """
    import asyncio
    
    try:
        # Update task state
        self.update_state(
            state="PROGRESS",
            meta={
                "current": 0,
                "total": 100,
                "status": "Initializing export..."
            }
        )
        
        # Run the async export
        result = asyncio.run(_export_shopping_list_async(
            trip_id, format, options or {}, user_id, self
        ))
        
        return result
        
    except SoftTimeLimitExceeded:
        logger.error(f"Shopping list export timed out for trip {trip_id}")
        raise
    except Exception as e:
        logger.error(f"Failed to export shopping list: {e}")
        raise self.retry(exc=e)


async def _export_shopping_list_async(
    trip_id: int,
    format: str,
    options: Dict[str, Any],
    user_id: Optional[int],
    task: Task,
) -> Dict[str, Any]:
    """Async implementation of shopping list export."""
    async with DatabaseSession() as db:
        # Initialize export manager
        export_manager = ExportManager(db)
        
        # Update progress
        task.update_state(
            state="PROGRESS",
            meta={
                "current": 20,
                "total": 100,
                "status": "Loading trip data..."
            }
        )
        
        # Generate export file
        output_dir = Path(settings.upload_path) / "exports" / "shopping_lists"
        output_dir.mkdir(parents=True, exist_ok=True)
        
        filename = f"shopping_list_{trip_id}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
        file_path = output_dir / f"{filename}.{format}"
        
        task.update_state(
            state="PROGRESS",
            meta={
                "current": 50,
                "total": 100,
                "status": f"Generating {format.upper()} file..."
            }
        )
        
        # Export the shopping list
        export_result = await export_manager.export(
            trip_id=trip_id,
            format=format,
            output_path=str(file_path),
            **options
        )
        
        task.update_state(
            state="PROGRESS",
            meta={
                "current": 90,
                "total": 100,
                "status": "Finalizing export..."
            }
        )
        
        # Store export metadata
        export_id = str(uuid.uuid4())
        async with RedisClient() as redis:
            if redis:
                export_key = f"export:{export_id}"
                export_data = {
                    "id": export_id,
                    "type": "shopping_list",
                    "trip_id": trip_id,
                    "format": format,
                    "file_path": str(file_path),
                    "file_size": file_path.stat().st_size,
                    "created_at": datetime.utcnow().isoformat(),
                    "created_by": user_id,
                    "expires_at": (datetime.utcnow() + timedelta(days=7)).isoformat(),
                }
                await redis.set(export_key, json.dumps(export_data), ex=604800)  # 7 days
        
        return {
            "export_id": export_id,
            "file_path": str(file_path),
            "file_size": file_path.stat().st_size,
            "format": format,
            "download_url": f"/api/v1/exports/{export_id}/download",
            "expires_at": export_data["expires_at"],
        }


@app.task(
    bind=True,
    base=ExportTask,
    name="jidelnicek.tasks.export_tasks.export_trip_data",
    max_retries=3,
    default_retry_delay=60,
)
def export_trip_data(
    self,
    trip_id: int,
    format: str = "pdf",
    include_shopping_list: bool = True,
    include_meal_plans: bool = True,
    include_participants: bool = True,
    user_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Export complete trip data.
    
    Args:
        trip_id: ID of the trip
        format: Export format
        include_shopping_list: Include shopping list in export
        include_meal_plans: Include meal plans in export
        include_participants: Include participant list in export
        user_id: ID of the user requesting the export
        
    Returns:
        Export result with file path and metadata
    """
    import asyncio
    
    try:
        self.update_state(
            state="PROGRESS",
            meta={
                "current": 0,
                "total": 100,
                "status": "Starting trip export..."
            }
        )
        
        result = asyncio.run(_export_trip_data_async(
            trip_id, format, include_shopping_list, include_meal_plans,
            include_participants, user_id, self
        ))
        
        return result
        
    except SoftTimeLimitExceeded:
        logger.error(f"Trip export timed out for trip {trip_id}")
        raise
    except Exception as e:
        logger.error(f"Failed to export trip data: {e}")
        raise self.retry(exc=e)


async def _export_trip_data_async(
    trip_id: int,
    format: str,
    include_shopping_list: bool,
    include_meal_plans: bool,
    include_participants: bool,
    user_id: Optional[int],
    task: Task,
) -> Dict[str, Any]:
    """Async implementation of trip data export."""
    async with DatabaseSession() as db:
        # Initialize export manager
        export_manager = TripExportManager(db)
        
        task.update_state(
            state="PROGRESS",
            meta={
                "current": 20,
                "total": 100,
                "status": "Loading trip data..."
            }
        )
        
        # Generate export file
        output_dir = Path(settings.upload_path) / "exports" / "trips"
        output_dir.mkdir(parents=True, exist_ok=True)
        
        filename = f"trip_{trip_id}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
        file_path = output_dir / f"{filename}.{format}"
        
        task.update_state(
            state="PROGRESS",
            meta={
                "current": 50,
                "total": 100,
                "status": f"Generating {format.upper()} file..."
            }
        )
        
        # Export the trip data
        export_result = await export_manager.export_trip(
            trip_id=trip_id,
            format=format,
            output_path=str(file_path),
            include_shopping_list=include_shopping_list,
            include_meal_plans=include_meal_plans,
            include_participants=include_participants,
        )
        
        task.update_state(
            state="PROGRESS",
            meta={
                "current": 90,
                "total": 100,
                "status": "Finalizing export..."
            }
        )
        
        # Store export metadata
        export_id = str(uuid.uuid4())
        async with RedisClient() as redis:
            if redis:
                export_key = f"export:{export_id}"
                export_data = {
                    "id": export_id,
                    "type": "trip_data",
                    "trip_id": trip_id,
                    "format": format,
                    "file_path": str(file_path),
                    "file_size": file_path.stat().st_size,
                    "created_at": datetime.utcnow().isoformat(),
                    "created_by": user_id,
                    "expires_at": (datetime.utcnow() + timedelta(days=7)).isoformat(),
                    "options": {
                        "include_shopping_list": include_shopping_list,
                        "include_meal_plans": include_meal_plans,
                        "include_participants": include_participants,
                    }
                }
                await redis.set(export_key, json.dumps(export_data), ex=604800)  # 7 days
        
        return {
            "export_id": export_id,
            "file_path": str(file_path),
            "file_size": file_path.stat().st_size,
            "format": format,
            "download_url": f"/api/v1/exports/{export_id}/download",
            "expires_at": export_data["expires_at"],
        }


@app.task(
    bind=True,
    base=ExportTask,
    name="jidelnicek.tasks.export_tasks.export_recipes",
    max_retries=2,
    default_retry_delay=300,
    queue="low",
)
def export_recipes(
    self,
    recipe_ids: Optional[List[int]] = None,
    format: str = "pdf",
    include_images: bool = True,
    include_nutrition: bool = True,
    user_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Export recipes.
    
    Args:
        recipe_ids: List of recipe IDs to export (None for all)
        format: Export format
        include_images: Include recipe images
        include_nutrition: Include nutritional information
        user_id: ID of the user requesting the export
        
    Returns:
        Export result with file path and metadata
    """
    import asyncio
    
    try:
        self.update_state(
            state="PROGRESS",
            meta={
                "current": 0,
                "total": 100,
                "status": "Starting recipe export..."
            }
        )
        
        result = asyncio.run(_export_recipes_async(
            recipe_ids, format, include_images, include_nutrition, user_id, self
        ))
        
        return result
        
    except SoftTimeLimitExceeded:
        logger.error("Recipe export timed out")
        raise
    except Exception as e:
        logger.error(f"Failed to export recipes: {e}")
        raise self.retry(exc=e)


async def _export_recipes_async(
    recipe_ids: Optional[List[int]],
    format: str,
    include_images: bool,
    include_nutrition: bool,
    user_id: Optional[int],
    task: Task,
) -> Dict[str, Any]:
    """Async implementation of recipe export."""
    async with DatabaseSession() as db:
        recipe_service = RecipeService(db)
        
        task.update_state(
            state="PROGRESS",
            meta={
                "current": 10,
                "total": 100,
                "status": "Loading recipes..."
            }
        )
        
        # Get recipes to export
        if recipe_ids:
            recipes = []
            for recipe_id in recipe_ids:
                recipe = await recipe_service.get_recipe(recipe_id)
                if recipe:
                    recipes.append(recipe)
        else:
            # Export all recipes (paginated)
            recipes = []
            offset = 0
            limit = 100
            while True:
                batch = await recipe_service.list_recipes(
                    skip=offset,
                    limit=limit
                )
                if not batch:
                    break
                recipes.extend(batch)
                offset += limit
                
                # Update progress
                task.update_state(
                    state="PROGRESS",
                    meta={
                        "current": min(30, 10 + (offset / 1000) * 20),
                        "total": 100,
                        "status": f"Loading recipes... ({len(recipes)} loaded)"
                    }
                )
        
        task.update_state(
            state="PROGRESS",
            meta={
                "current": 40,
                "total": 100,
                "status": f"Preparing to export {len(recipes)} recipes..."
            }
        )
        
        # Generate export file
        output_dir = Path(settings.upload_path) / "exports" / "recipes"
        output_dir.mkdir(parents=True, exist_ok=True)
        
        filename = f"recipes_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
        file_path = output_dir / f"{filename}.{format}"
        
        # TODO: Implement actual recipe export logic based on format
        # For now, create a placeholder file
        with open(file_path, "w") as f:
            f.write(f"Recipe export placeholder - {len(recipes)} recipes\n")
        
        task.update_state(
            state="PROGRESS",
            meta={
                "current": 90,
                "total": 100,
                "status": "Finalizing export..."
            }
        )
        
        # Store export metadata
        export_id = str(uuid.uuid4())
        async with RedisClient() as redis:
            if redis:
                export_key = f"export:{export_id}"
                export_data = {
                    "id": export_id,
                    "type": "recipes",
                    "recipe_count": len(recipes),
                    "recipe_ids": recipe_ids,
                    "format": format,
                    "file_path": str(file_path),
                    "file_size": file_path.stat().st_size,
                    "created_at": datetime.utcnow().isoformat(),
                    "created_by": user_id,
                    "expires_at": (datetime.utcnow() + timedelta(days=7)).isoformat(),
                    "options": {
                        "include_images": include_images,
                        "include_nutrition": include_nutrition,
                    }
                }
                await redis.set(export_key, json.dumps(export_data), ex=604800)  # 7 days
        
        return {
            "export_id": export_id,
            "file_path": str(file_path),
            "file_size": file_path.stat().st_size,
            "format": format,
            "recipe_count": len(recipes),
            "download_url": f"/api/v1/exports/{export_id}/download",
            "expires_at": export_data["expires_at"],
        }


@app.task(
    bind=True,
    base=ExportTask,
    name="jidelnicek.tasks.export_tasks.export_large_dataset",
    max_retries=2,
    default_retry_delay=600,
    queue="low",
    time_limit=3600,
    soft_time_limit=3300,
)
def export_large_dataset(
    self,
    dataset_type: str,
    filters: Optional[Dict[str, Any]] = None,
    format: str = "csv",
    user_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Export large datasets with chunked processing.
    
    Args:
        dataset_type: Type of dataset to export
        filters: Filters to apply
        format: Export format
        user_id: ID of the user requesting the export
        
    Returns:
        Export result with file path and metadata
    """
    import asyncio
    
    try:
        result = asyncio.run(_export_large_dataset_async(
            dataset_type, filters or {}, format, user_id, self
        ))
        return result
    except SoftTimeLimitExceeded:
        logger.error(f"Large dataset export timed out: {dataset_type}")
        raise
    except Exception as e:
        logger.error(f"Failed to export large dataset: {e}")
        raise self.retry(exc=e)


async def _export_large_dataset_async(
    dataset_type: str,
    filters: Dict[str, Any],
    format: str,
    user_id: Optional[int],
    task: Task,
) -> Dict[str, Any]:
    """Async implementation of large dataset export."""
    # TODO: Implement actual large dataset export logic
    # This is a placeholder implementation
    
    export_id = str(uuid.uuid4())
    output_dir = Path(settings.upload_path) / "exports" / "datasets"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    filename = f"{dataset_type}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
    file_path = output_dir / f"{filename}.{format}"
    
    # Create placeholder file
    with open(file_path, "w") as f:
        f.write(f"Large dataset export placeholder - {dataset_type}\n")
    
    return {
        "export_id": export_id,
        "file_path": str(file_path),
        "file_size": file_path.stat().st_size,
        "format": format,
        "dataset_type": dataset_type,
        "download_url": f"/api/v1/exports/{export_id}/download",
        "expires_at": (datetime.utcnow() + timedelta(days=7)).isoformat(),
    }


@app.task(name="jidelnicek.tasks.export_tasks.cleanup_expired_jobs")
def cleanup_expired_jobs() -> Dict[str, int]:
    """
    Clean up expired job records from Redis.
    
    Returns:
        Cleanup statistics
    """
    import asyncio
    return asyncio.run(_cleanup_expired_jobs_async())


async def _cleanup_expired_jobs_async() -> Dict[str, int]:
    """Async implementation of expired jobs cleanup."""
    cleaned_count = 0
    
    async with RedisClient() as redis:
        if not redis:
            logger.warning("Redis not available for cleanup")
            return {"cleaned": 0, "error": "Redis not available"}
        
        # Scan for job keys
        cursor = 0
        pattern = "job:*"
        
        while True:
            cursor, keys = await redis.scan(cursor, match=pattern, count=100)
            
            for key in keys:
                try:
                    job_data = await redis.get(key)
                    if job_data:
                        job_info = json.loads(job_data)
                        updated_at = datetime.fromisoformat(job_info.get("updated_at", ""))
                        
                        # Remove jobs older than 7 days
                        if datetime.utcnow() - updated_at > timedelta(days=7):
                            await redis.delete(key)
                            cleaned_count += 1
                except Exception as e:
                    logger.error(f"Error cleaning job {key}: {e}")
            
            if cursor == 0:
                break
    
    logger.info(f"Cleaned {cleaned_count} expired jobs")
    return {"cleaned": cleaned_count}


@app.task(name="jidelnicek.tasks.export_tasks.cleanup_old_exports")
def cleanup_old_exports() -> Dict[str, int]:
    """
    Clean up old export files from disk.
    
    Returns:
        Cleanup statistics
    """
    import asyncio
    return asyncio.run(_cleanup_old_exports_async())


async def _cleanup_old_exports_async() -> Dict[str, int]:
    """Async implementation of old exports cleanup."""
    cleaned_files = 0
    cleaned_size = 0
    
    export_base_dir = Path(settings.upload_path) / "exports"
    if not export_base_dir.exists():
        return {"files": 0, "size": 0}
    
    # Clean files older than 7 days
    cutoff_date = datetime.utcnow() - timedelta(days=7)
    
    for export_dir in export_base_dir.iterdir():
        if export_dir.is_dir():
            for file_path in export_dir.rglob("*"):
                if file_path.is_file():
                    try:
                        file_mtime = datetime.fromtimestamp(file_path.stat().st_mtime)
                        if file_mtime < cutoff_date:
                            file_size = file_path.stat().st_size
                            file_path.unlink()
                            cleaned_files += 1
                            cleaned_size += file_size
                    except Exception as e:
                        logger.error(f"Error cleaning file {file_path}: {e}")
    
    # Also clean up Redis export metadata
    async with RedisClient() as redis:
        if redis:
            cursor = 0
            pattern = "export:*"
            
            while True:
                cursor, keys = await redis.scan(cursor, match=pattern, count=100)
                
                for key in keys:
                    try:
                        export_data = await redis.get(key)
                        if export_data:
                            export_info = json.loads(export_data)
                            expires_at = datetime.fromisoformat(export_info.get("expires_at", ""))
                            
                            if datetime.utcnow() > expires_at:
                                await redis.delete(key)
                    except Exception as e:
                        logger.error(f"Error cleaning export metadata {key}: {e}")
                
                if cursor == 0:
                    break
    
    logger.info(f"Cleaned {cleaned_files} files, freed {cleaned_size} bytes")
    return {"files": cleaned_files, "size": cleaned_size}
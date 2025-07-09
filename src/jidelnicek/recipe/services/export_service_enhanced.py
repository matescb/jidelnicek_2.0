"""Enhanced recipe export service with error handling and recovery."""

import logging
from typing import List, Dict, Any, Optional, BinaryIO
from datetime import datetime, date
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from ...core.services.export_service_wrapper import (
    ExportServiceWrapper,
    with_export_error_handling,
    ExportResourceManager
)
from ...core.exceptions.export_exceptions import (
    ExportValidationError,
    ExportDataError,
    ExportGenerationError
)
from ...core.services.error_recovery import ErrorRecoveryService
from ...core.services.export_error_logger import ExportErrorLogger
from ...core.monitoring.metrics import MetricsCollector, export_metrics
from ...core.config import settings
from ..models import Recipe
from .recipe_export_base import RecipeExportService

logger = logging.getLogger(__name__)


class EnhancedRecipeExportService(RecipeExportService):
    """Recipe export service with enhanced error handling."""
    
    def __init__(
        self,
        session: AsyncSession,
        metrics_collector: Optional[MetricsCollector] = None
    ):
        super().__init__(session)
        
        # Initialize error handling components
        self.metrics_collector = metrics_collector or MetricsCollector()
        self.recovery_service = ErrorRecoveryService(self.metrics_collector)
        self.error_logger = ExportErrorLogger(
            Path(settings.log_dir) / "export_errors",
            self.metrics_collector
        )
        
        self._export_wrapper = ExportServiceWrapper(
            self.recovery_service,
            self.error_logger,
            self.metrics_collector,
            timeout_seconds=settings.export_timeout
        )
        
        self.resource_manager = ExportResourceManager(
            max_concurrent_exports=settings.max_concurrent_exports
        )
    
    @with_export_error_handling("pdf", ["reportlab"])
    async def export_recipes_to_pdf(
        self,
        recipes: List[Recipe],
        output: BinaryIO,
        user_id: Optional[int] = None,
        **options
    ) -> Dict[str, Any]:
        """Export recipes to PDF with error handling."""
        async with self.metrics_collector.timer(
            "recipe_export_pdf",
            tags={"recipe_count": str(len(recipes))}
        ):
            # Validate input
            self._validate_export_input(recipes, "pdf")
            
            # Acquire resources
            export_id = f"pdf_{datetime.utcnow().timestamp()}"
            estimated_memory = len(recipes) * 2  # ~2MB per recipe for PDF
            
            async with self.resource_manager:
                await self.resource_manager.acquire_resources(
                    export_id,
                    estimated_memory
                )
                
                try:
                    # Track export start
                    export_metrics.record_export_start("pdf", user_id)
                    start_time = datetime.utcnow()
                    
                    # Perform actual export (using base class method)
                    result = await super().export_recipes_to_pdf(
                        recipes,
                        output,
                        **options
                    )
                    
                    # Track success
                    duration_ms = (datetime.utcnow() - start_time).total_seconds() * 1000
                    file_size = output.tell() if hasattr(output, 'tell') else 0
                    
                    export_metrics.record_export_success(
                        "pdf",
                        duration_ms,
                        file_size,
                        len(recipes),
                        user_id
                    )
                    
                    return {
                        **result,
                        "export_id": export_id,
                        "duration_ms": duration_ms
                    }
                    
                finally:
                    self.resource_manager.release_resources(export_id)
    
    @with_export_error_handling("xlsx", ["openpyxl"])
    async def export_recipes_to_excel(
        self,
        recipes: List[Recipe],
        output: BinaryIO,
        user_id: Optional[int] = None,
        **options
    ) -> Dict[str, Any]:
        """Export recipes to Excel with error handling."""
        async with self.metrics_collector.timer(
            "recipe_export_xlsx",
            tags={"recipe_count": str(len(recipes))}
        ):
            # Validate input
            self._validate_export_input(recipes, "xlsx")
            
            # Check for large exports
            if len(recipes) > 1000:
                # Suggest async processing for large exports
                logger.warning(
                    f"Large export requested: {len(recipes)} recipes. "
                    "Consider async processing."
                )
            
            export_id = f"xlsx_{datetime.utcnow().timestamp()}"
            estimated_memory = len(recipes) * 0.5  # ~0.5MB per recipe for Excel
            
            async with self.resource_manager:
                await self.resource_manager.acquire_resources(
                    export_id,
                    estimated_memory
                )
                
                try:
                    # Perform export with batching for large datasets
                    if len(recipes) > 500:
                        return await self._export_excel_batched(
                            recipes,
                            output,
                            user_id,
                            **options
                        )
                    else:
                        return await super().export_recipes_to_excel(
                            recipes,
                            output,
                            **options
                        )
                finally:
                    self.resource_manager.release_resources(export_id)
    
    @with_export_error_handling("ics", ["icalendar"])
    async def export_meal_plan_to_calendar(
        self,
        meal_plan: Dict[str, Any],
        output: BinaryIO,
        user_id: Optional[int] = None,
        **options
    ) -> Dict[str, Any]:
        """Export meal plan to calendar format with error handling."""
        async with self.metrics_collector.timer("meal_plan_export_ics"):
            # Validate meal plan data
            if not meal_plan or "days" not in meal_plan:
                raise ExportValidationError({
                    "meal_plan": "Invalid meal plan data structure"
                })
            
            export_id = f"ics_{datetime.utcnow().timestamp()}"
            
            try:
                # Track export
                export_metrics.record_export_start("ics", user_id)
                start_time = datetime.utcnow()
                
                # Perform export
                result = await super().export_meal_plan_to_calendar(
                    meal_plan,
                    output,
                    **options
                )
                
                # Track success
                duration_ms = (datetime.utcnow() - start_time).total_seconds() * 1000
                export_metrics.record_export_success(
                    "ics",
                    duration_ms,
                    output.tell() if hasattr(output, 'tell') else 0,
                    len(meal_plan.get("days", [])),
                    user_id
                )
                
                return result
                
            except Exception as e:
                # Log error with context
                await self.error_logger.log_export_error(
                    e,
                    {
                        "export_format": "ics",
                        "meal_plan_days": len(meal_plan.get("days", [])),
                        "user_id": user_id
                    },
                    user_id=user_id,
                    session=self.session
                )
                raise
    
    def _validate_export_input(
        self,
        recipes: List[Recipe],
        export_format: str
    ) -> None:
        """Validate export input data."""
        errors = {}
        
        if not recipes:
            errors["recipes"] = "No recipes provided for export"
        
        if len(recipes) > settings.max_export_items:
            errors["recipes"] = f"Too many recipes ({len(recipes)}). "
            f"Maximum allowed: {settings.max_export_items}"
        
        # Check for invalid recipe data
        for i, recipe in enumerate(recipes):
            if not recipe.name:
                errors[f"recipe_{i}"] = "Recipe missing name"
            if not recipe.id:
                errors[f"recipe_{i}"] = "Recipe missing ID"
        
        if errors:
            raise ExportValidationError(errors)
    
    async def _export_excel_batched(
        self,
        recipes: List[Recipe],
        output: BinaryIO,
        user_id: Optional[int],
        batch_size: int = 100,
        **options
    ) -> Dict[str, Any]:
        """Export large recipe sets to Excel in batches."""
        logger.info(f"Exporting {len(recipes)} recipes in batches of {batch_size}")
        
        # Import here to check dependency
        import openpyxl
        from openpyxl import Workbook
        
        wb = Workbook()
        ws = wb.active
        ws.title = "Recipes"
        
        # Write headers
        headers = [
            "ID", "Name", "Category", "Cuisine", "Prep Time",
            "Cook Time", "Servings", "Difficulty", "Calories",
            "Ingredients", "Instructions", "Tags", "Created"
        ]
        ws.append(headers)
        
        # Process in batches
        total_processed = 0
        
        for i in range(0, len(recipes), batch_size):
            batch = recipes[i:i + batch_size]
            
            for recipe in batch:
                row = [
                    recipe.id,
                    recipe.name,
                    recipe.category,
                    recipe.cuisine,
                    recipe.prep_time,
                    recipe.cook_time,
                    recipe.servings,
                    recipe.difficulty,
                    recipe.nutritional_info.get("calories")
                    if recipe.nutritional_info else None,
                    ", ".join([
                        f"{ing.amount} {ing.unit} {ing.name}"
                        for ing in recipe.ingredients
                    ]),
                    "\n".join([
                        f"{step.order}. {step.instruction}"
                        for step in recipe.steps
                    ]),
                    ", ".join(recipe.tags) if recipe.tags else "",
                    recipe.created_at.isoformat() if recipe.created_at else ""
                ]
                ws.append(row)
            
            total_processed += len(batch)
            
            # Log progress
            logger.info(f"Processed {total_processed}/{len(recipes)} recipes")
            
            # Allow other tasks to run
            await asyncio.sleep(0)
        
        # Auto-adjust column widths
        for column in ws.columns:
            max_length = 0
            column_letter = column[0].column_letter
            
            for cell in column:
                try:
                    if len(str(cell.value)) > max_length:
                        max_length = len(str(cell.value))
                except:
                    pass
            
            adjusted_width = min(max_length + 2, 50)
            ws.column_dimensions[column_letter].width = adjusted_width
        
        # Save to output
        wb.save(output)
        
        return {
            "format": "xlsx",
            "recipe_count": len(recipes),
            "file_size": output.tell() if hasattr(output, 'tell') else 0,
            "batched": True,
            "batch_size": batch_size
        }
    
    async def get_export_statistics(
        self,
        user_id: Optional[int] = None,
        hours: int = 24
    ) -> Dict[str, Any]:
        """Get export statistics for monitoring."""
        # Get metrics summary
        metrics_summary = self.metrics_collector.get_metrics_summary()
        
        # Get error statistics
        error_stats = await self.error_logger.get_error_statistics(
            timedelta(hours=hours)
        )
        
        # Build response
        stats = {
            "time_range_hours": hours,
            "exports": {
                "total": metrics_summary["counters"].get("exports_completed", 0),
                "failed": metrics_summary["counters"].get("exports_failed", 0),
                "by_format": {}
            },
            "performance": {
                "average_duration_ms": {},
                "p95_duration_ms": {}
            },
            "errors": error_stats,
            "fallbacks_used": metrics_summary["counters"].get("export_fallbacks", 0)
        }
        
        # Extract format-specific stats
        for key, value in metrics_summary["counters"].items():
            if key.startswith("exports_completed,format="):
                format_name = key.split("format=")[1].split(",")[0]
                stats["exports"]["by_format"][format_name] = value
        
        # Extract performance stats
        for key, timing_data in metrics_summary["timings"].items():
            if key.startswith("export_duration,format="):
                format_name = key.split("format=")[1].split(",")[0]
                stats["performance"]["average_duration_ms"][format_name] = \
                    timing_data.get("mean", 0)
                stats["performance"]["p95_duration_ms"][format_name] = \
                    timing_data.get("p95", 0)
        
        return stats
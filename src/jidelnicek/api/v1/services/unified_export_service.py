"""
Unified export service that coordinates all exporters.

This service provides a single interface for exporting trips, recipes, and shopping lists
to various formats, handling both synchronous and asynchronous exports.
"""

import asyncio
import io
import json
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Any, Optional, List, Union, BinaryIO
from uuid import UUID, uuid4

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload

from ....core.config import settings
from ....core.storage.service import StorageService
from ....core.services.notification_service import NotificationService
from ....core.monitoring.metrics import export_metrics
from ....core.exceptions.export_exceptions import (
    ExportValidationError,
    ExportGenerationError,
    ExportStorageError
)
from ....trip.services.trip_service import TripService
from ....trip.services.export.export_manager import TripExportManager, ExportOptions as TripExportOptions
from ....recipe.services.recipe_service import RecipeService
from ....recipe.services.export_service_enhanced import EnhancedRecipeExportService
from ....shopping.services.shopping_list_generator import ShoppingListGenerator
from ....shopping.services.export_manager import ExportManager as ShoppingExportManager
from ....shopping.services.export import ExportFormat as ShoppingExportFormat
from ..schemas.export_schemas import (
    ExportType,
    ExportFormat,
    ExportStatus,
    ExportJobResponse,
    ExportHistoryResponse,
    ExportResponse,
    ExportOptionsValidator
)
from ..models.export_models import ExportJob, ExportPreset

logger = logging.getLogger(__name__)


class UnifiedExportService:
    """
    Unified service for all export operations.
    
    Coordinates between different export managers and provides:
    - Unified interface for all export types
    - Async/sync export handling
    - Batch export capabilities
    - Export history and status tracking
    - Storage management
    - Notification handling
    """
    
    def __init__(self, session: AsyncSession):
        """Initialize the unified export service."""
        self.session = session
        self.storage_service = StorageService()
        self.notification_service = NotificationService()
        
        # Initialize specialized export managers
        self.trip_export_manager = TripExportManager()
        self.shopping_export_manager = ShoppingExportManager()
        self.recipe_export_service = EnhancedRecipeExportService(session)
        
        # Export configuration
        self.export_ttl_days = settings.export_ttl_days or 7
        self.max_file_size = settings.max_export_file_size or 100 * 1024 * 1024  # 100MB
        
    async def export_single(
        self,
        user_id: int,
        export_type: ExportType,
        export_format: ExportFormat,
        item_id: Union[int, str],
        options: Dict[str, Any]
    ) -> ExportResponse:
        """
        Export a single item synchronously.
        
        Args:
            user_id: ID of the user performing the export
            export_type: Type of item to export
            export_format: Desired export format
            item_id: ID of the item to export
            options: Export options
            
        Returns:
            ExportResponse with file content and metadata
        """
        # Validate options based on format
        validated_options = self._validate_options(export_format, options)
        
        # Track export start
        export_metrics.record_export_start(export_format.value, user_id)
        start_time = datetime.utcnow()
        
        try:
            # Generate export based on type
            if export_type == ExportType.TRIP:
                content = await self._export_trip(
                    int(item_id),
                    export_format,
                    validated_options
                )
            elif export_type == ExportType.RECIPE:
                content = await self._export_recipe(
                    int(item_id),
                    export_format,
                    validated_options
                )
            elif export_type == ExportType.SHOPPING_LIST:
                content = await self._export_shopping_list(
                    str(item_id),
                    export_format,
                    validated_options
                )
            else:
                raise ExportValidationError(f"Unsupported export type: {export_type}")
            
            # Generate filename
            filename = self._generate_filename(export_type, export_format, item_id)
            
            # Get MIME type
            mime_type = self._get_mime_type(export_format)
            
            # Track success
            duration_ms = (datetime.utcnow() - start_time).total_seconds() * 1000
            export_metrics.record_export_success(
                export_format.value,
                user_id,
                duration_ms,
                len(content)
            )
            
            return ExportResponse(
                filename=filename,
                mime_type=mime_type,
                file_size=len(content),
                content=content,
                metadata={
                    "export_type": export_type.value,
                    "export_format": export_format.value,
                    "generated_at": datetime.utcnow().isoformat()
                }
            )
            
        except Exception as e:
            # Track failure
            export_metrics.record_export_failure(export_format.value, user_id, str(e))
            logger.error(f"Export failed: {e}")
            raise ExportGenerationError(f"Failed to generate export: {str(e)}")
    
    async def start_async_export(
        self,
        user_id: int,
        export_type: ExportType,
        export_format: ExportFormat,
        item_ids: List[Union[int, str]],
        options: Dict[str, Any]
    ) -> UUID:
        """
        Start an asynchronous export job.
        
        Args:
            user_id: ID of the user performing the export
            export_type: Type of items to export
            export_format: Desired export format
            item_ids: IDs of items to export
            options: Export options
            
        Returns:
            Job ID for tracking
        """
        # Create export job
        job = ExportJob(
            id=uuid4(),
            user_id=user_id,
            export_type=export_type,
            export_format=export_format,
            item_ids=item_ids,
            options=options,
            status=ExportStatus.PENDING,
            created_at=datetime.utcnow()
        )
        
        self.session.add(job)
        await self.session.commit()
        
        return job.id
    
    async def process_async_export(self, job_id: UUID):
        """
        Process an asynchronous export job.
        
        This method is called by background tasks to process exports.
        """
        try:
            # Get job
            result = await self.session.execute(
                select(ExportJob).where(ExportJob.id == job_id)
            )
            job = result.scalar_one_or_none()
            
            if not job:
                logger.error(f"Export job {job_id} not found")
                return
            
            # Update status
            job.status = ExportStatus.PROCESSING
            job.updated_at = datetime.utcnow()
            await self.session.commit()
            
            # Process based on number of items
            if len(job.item_ids) == 1:
                # Single item export
                result = await self.export_single(
                    user_id=job.user_id,
                    export_type=job.export_type,
                    export_format=job.export_format,
                    item_id=job.item_ids[0],
                    options=job.options
                )
                
                # Store result
                storage_path = await self._store_export_result(
                    job_id=job.id,
                    filename=result.filename,
                    content=result.content
                )
                
                # Update job
                job.status = ExportStatus.COMPLETED
                job.completed_at = datetime.utcnow()
                job.file_path = storage_path
                job.file_size = result.file_size
                job.mime_type = result.mime_type
                
            else:
                # Multiple items - merge or create archive
                results = []
                for item_id in job.item_ids:
                    result = await self.export_single(
                        user_id=job.user_id,
                        export_type=job.export_type,
                        export_format=job.export_format,
                        item_id=item_id,
                        options=job.options
                    )
                    results.append(result)
                
                # Merge or archive results
                merged_result = await self._merge_export_results(
                    results,
                    job.export_format,
                    job.options.get("merge_into_single_file", True)
                )
                
                # Store result
                storage_path = await self._store_export_result(
                    job_id=job.id,
                    filename=merged_result.filename,
                    content=merged_result.content
                )
                
                # Update job
                job.status = ExportStatus.COMPLETED
                job.completed_at = datetime.utcnow()
                job.file_path = storage_path
                job.file_size = merged_result.file_size
                job.mime_type = merged_result.mime_type
            
            await self.session.commit()
            
            # Send notification
            await self._send_completion_notification(job)
            
        except Exception as e:
            logger.error(f"Failed to process export job {job_id}: {e}")
            
            # Update job status
            if job:
                job.status = ExportStatus.FAILED
                job.error_message = str(e)
                job.updated_at = datetime.utcnow()
                await self.session.commit()
    
    async def get_export_status(
        self,
        job_id: UUID,
        user_id: int
    ) -> Optional[ExportJobResponse]:
        """Get status of an export job."""
        result = await self.session.execute(
            select(ExportJob).where(
                ExportJob.id == job_id,
                ExportJob.user_id == user_id
            )
        )
        job = result.scalar_one_or_none()
        
        if not job:
            return None
        
        # Calculate progress
        progress = None
        if job.status == ExportStatus.PROCESSING and job.total_items:
            progress = (job.processed_items / job.total_items) * 100
        
        # Generate download URL if completed
        result_url = None
        if job.status == ExportStatus.COMPLETED and job.file_path:
            result_url = f"/api/v1/exports/download/{job.id}"
        
        return ExportJobResponse(
            job_id=job.id,
            status=job.status,
            created_at=job.created_at,
            updated_at=job.updated_at,
            completed_at=job.completed_at,
            export_type=job.export_type,
            export_format=job.export_format,
            progress=progress,
            error_message=job.error_message,
            result_url=result_url,
            file_size=job.file_size
        )
    
    async def get_export_result(
        self,
        job_id: UUID,
        user_id: int
    ) -> Optional[ExportResponse]:
        """Get export result for download."""
        result = await self.session.execute(
            select(ExportJob).where(
                ExportJob.id == job_id,
                ExportJob.user_id == user_id,
                ExportJob.status == ExportStatus.COMPLETED
            )
        )
        job = result.scalar_one_or_none()
        
        if not job or not job.file_path:
            return None
        
        # Retrieve file from storage
        content = await self.storage_service.retrieve(job.file_path)
        
        if not content:
            return None
        
        # Update download count
        job.download_count += 1
        await self.session.commit()
        
        return ExportResponse(
            filename=Path(job.file_path).name,
            mime_type=job.mime_type,
            file_size=job.file_size,
            content=content
        )
    
    async def get_user_export_history(
        self,
        user_id: int,
        skip: int = 0,
        limit: int = 20,
        export_type: Optional[ExportType] = None,
        export_format: Optional[ExportFormat] = None,
        status: Optional[ExportStatus] = None
    ) -> List[ExportHistoryResponse]:
        """Get user's export history."""
        query = select(ExportJob).where(ExportJob.user_id == user_id)
        
        if export_type:
            query = query.where(ExportJob.export_type == export_type)
        if export_format:
            query = query.where(ExportJob.export_format == export_format)
        if status:
            query = query.where(ExportJob.status == status)
        
        query = query.order_by(ExportJob.created_at.desc())
        query = query.offset(skip).limit(limit)
        
        result = await self.session.execute(query)
        jobs = result.scalars().all()
        
        history = []
        for job in jobs:
            # Calculate expiration
            expires_at = None
            if job.completed_at:
                expires_at = job.completed_at + timedelta(days=self.export_ttl_days)
            
            history.append(ExportHistoryResponse(
                job_id=job.id,
                export_type=job.export_type,
                export_format=job.export_format,
                status=job.status,
                created_at=job.created_at,
                completed_at=job.completed_at,
                file_size=job.file_size,
                filename=Path(job.file_path).name if job.file_path else None,
                download_count=job.download_count,
                expires_at=expires_at
            ))
        
        return history
    
    async def delete_export(
        self,
        job_id: UUID,
        user_id: int
    ) -> bool:
        """Delete an export and its files."""
        result = await self.session.execute(
            select(ExportJob).where(
                ExportJob.id == job_id,
                ExportJob.user_id == user_id
            )
        )
        job = result.scalar_one_or_none()
        
        if not job:
            return False
        
        # Delete file from storage
        if job.file_path:
            await self.storage_service.delete(job.file_path)
        
        # Delete job record
        await self.session.delete(job)
        await self.session.commit()
        
        return True
    
    async def create_batch_export(
        self,
        user_id: int,
        exports: List[Dict[str, Any]]
    ) -> UUID:
        """Create a batch export job."""
        batch_id = uuid4()
        
        # Create individual export jobs
        for export_config in exports:
            job_id = await self.start_async_export(
                user_id=user_id,
                export_type=export_config["export_type"],
                export_format=export_config["export_format"],
                item_ids=export_config["item_ids"],
                options=export_config.get("options", {})
            )
            
            # Link to batch
            await self.session.execute(
                update(ExportJob)
                .where(ExportJob.id == job_id)
                .values(batch_id=batch_id)
            )
        
        await self.session.commit()
        
        return batch_id
    
    async def process_batch_export(self, batch_id: UUID):
        """Process all jobs in a batch."""
        result = await self.session.execute(
            select(ExportJob).where(ExportJob.batch_id == batch_id)
        )
        jobs = result.scalars().all()
        
        # Process jobs concurrently with limit
        semaphore = asyncio.Semaphore(settings.max_concurrent_exports or 5)
        
        async def process_with_limit(job_id):
            async with semaphore:
                await self.process_async_export(job_id)
        
        tasks = [process_with_limit(job.id) for job in jobs]
        await asyncio.gather(*tasks, return_exceptions=True)
    
    async def create_preset(
        self,
        user_id: int,
        name: str,
        export_type: ExportType,
        export_format: ExportFormat,
        options: Dict[str, Any]
    ) -> UUID:
        """Create an export preset."""
        preset = ExportPreset(
            id=uuid4(),
            user_id=user_id,
            name=name,
            export_type=export_type,
            export_format=export_format,
            options=options,
            created_at=datetime.utcnow()
        )
        
        self.session.add(preset)
        await self.session.commit()
        
        return preset.id
    
    async def get_user_presets(self, user_id: int) -> List[Dict[str, Any]]:
        """Get user's export presets."""
        result = await self.session.execute(
            select(ExportPreset)
            .where(ExportPreset.user_id == user_id)
            .order_by(ExportPreset.name)
        )
        presets = result.scalars().all()
        
        return [
            {
                "id": preset.id,
                "name": preset.name,
                "description": preset.description,
                "export_type": preset.export_type,
                "export_format": preset.export_format,
                "options": preset.options,
                "created_at": preset.created_at,
                "usage_count": preset.usage_count
            }
            for preset in presets
        ]
    
    async def generate_preview(
        self,
        user_id: int,
        export_type: ExportType,
        export_format: ExportFormat,
        item_id: Union[int, str],
        options: Dict[str, Any]
    ) -> ExportResponse:
        """Generate a preview of the export."""
        # Add preview flag to options
        preview_options = options.copy()
        preview_options["preview"] = True
        preview_options["max_pages"] = 2
        preview_options["max_rows"] = 20
        
        # Generate preview
        result = await self.export_single(
            user_id=user_id,
            export_type=export_type,
            export_format=export_format,
            item_id=item_id,
            options=preview_options
        )
        
        # Modify filename to indicate preview
        result.filename = f"preview_{result.filename}"
        
        return result
    
    # Private helper methods
    
    def _validate_options(
        self,
        export_format: ExportFormat,
        options: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Validate export options based on format."""
        if export_format == ExportFormat.PDF:
            return ExportOptionsValidator.validate_pdf_options(options)
        elif export_format == ExportFormat.EXCEL:
            return ExportOptionsValidator.validate_excel_options(options)
        elif export_format == ExportFormat.CSV:
            return ExportOptionsValidator.validate_csv_options(options)
        else:
            return options
    
    async def _export_trip(
        self,
        trip_id: int,
        export_format: ExportFormat,
        options: Dict[str, Any]
    ) -> bytes:
        """Export a trip."""
        # Get trip data
        trip_service = TripService(self.session)
        trip_data = await trip_service.get_trip_export_data(trip_id)
        
        if not trip_data:
            raise ExportValidationError(f"Trip {trip_id} not found")
        
        # Convert export format
        trip_export_format = self._convert_to_trip_format(export_format)
        
        # Create trip export options
        trip_options = TripExportOptions(
            format=trip_export_format,
            **options
        )
        
        # Export
        return self.trip_export_manager.export(trip_data, trip_options)
    
    async def _export_recipe(
        self,
        recipe_id: int,
        export_format: ExportFormat,
        options: Dict[str, Any]
    ) -> bytes:
        """Export a recipe."""
        # Get recipe
        recipe_service = RecipeService(self.session)
        recipe = await recipe_service.get_recipe(recipe_id)
        
        if not recipe:
            raise ExportValidationError(f"Recipe {recipe_id} not found")
        
        # Export based on format
        output = io.BytesIO()
        
        if export_format == ExportFormat.PDF:
            await self.recipe_export_service.export_recipes_to_pdf(
                [recipe],
                output,
                **options
            )
        elif export_format == ExportFormat.JSON:
            # Simple JSON export
            recipe_data = recipe.to_dict()
            json_str = json.dumps(recipe_data, ensure_ascii=False, indent=2)
            output.write(json_str.encode('utf-8'))
        else:
            raise ExportValidationError(f"Recipe export format {export_format} not implemented")
        
        output.seek(0)
        return output.read()
    
    async def _export_shopping_list(
        self,
        list_id: str,
        export_format: ExportFormat,
        options: Dict[str, Any]
    ) -> bytes:
        """Export a shopping list."""
        # For now, generate from trip ID
        # In the future, this could be a saved shopping list ID
        try:
            trip_id = int(list_id)
            
            # Generate shopping list
            generator = ShoppingListGenerator()
            trip_service = TripService(self.session)
            trip_data = await trip_service.get_trip_export_data(trip_id)
            
            if not trip_data:
                raise ExportValidationError(f"Trip {trip_id} not found")
            
            shopping_list = generator.generate_from_trip(trip_data)
            
            # Convert format
            shopping_format = self._convert_to_shopping_format(export_format)
            
            # Export
            return self.shopping_export_manager.export(
                shopping_list,
                shopping_format,
                options
            )
            
        except ValueError:
            raise ExportValidationError(f"Invalid shopping list ID: {list_id}")
    
    def _convert_to_trip_format(self, format: ExportFormat):
        """Convert unified format to trip export format."""
        from ....trip.services.export.export_manager import ExportFormat as TripFormat
        
        mapping = {
            ExportFormat.PDF: TripFormat.PDF,
            ExportFormat.EXCEL: TripFormat.EXCEL,
            ExportFormat.TEXT: TripFormat.TEXT,
            ExportFormat.MARKDOWN: TripFormat.MARKDOWN,
            ExportFormat.JSON: TripFormat.JSON
        }
        
        return mapping.get(format, TripFormat.PDF)
    
    def _convert_to_shopping_format(self, format: ExportFormat):
        """Convert unified format to shopping export format."""
        mapping = {
            ExportFormat.PDF: ShoppingExportFormat.PDF,
            ExportFormat.EXCEL: ShoppingExportFormat.EXCEL,
            ExportFormat.CSV: ShoppingExportFormat.CSV,
            ExportFormat.JSON: ShoppingExportFormat.JSON,
            ExportFormat.HTML: ShoppingExportFormat.HTML,
            ExportFormat.TEXT: ShoppingExportFormat.TEXT
        }
        
        return mapping.get(format, ShoppingExportFormat.TEXT)
    
    def _generate_filename(
        self,
        export_type: ExportType,
        export_format: ExportFormat,
        item_id: Union[int, str]
    ) -> str:
        """Generate filename for export."""
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        extension = self._get_file_extension(export_format)
        
        return f"{export_type.value}_{item_id}_{timestamp}{extension}"
    
    def _get_file_extension(self, format: ExportFormat) -> str:
        """Get file extension for format."""
        extensions = {
            ExportFormat.PDF: ".pdf",
            ExportFormat.EXCEL: ".xlsx",
            ExportFormat.CSV: ".csv",
            ExportFormat.JSON: ".json",
            ExportFormat.HTML: ".html",
            ExportFormat.TEXT: ".txt",
            ExportFormat.MARKDOWN: ".md"
        }
        
        return extensions.get(format, ".bin")
    
    def _get_mime_type(self, format: ExportFormat) -> str:
        """Get MIME type for format."""
        mime_types = {
            ExportFormat.PDF: "application/pdf",
            ExportFormat.EXCEL: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ExportFormat.CSV: "text/csv",
            ExportFormat.JSON: "application/json",
            ExportFormat.HTML: "text/html",
            ExportFormat.TEXT: "text/plain",
            ExportFormat.MARKDOWN: "text/markdown"
        }
        
        return mime_types.get(format, "application/octet-stream")
    
    async def _store_export_result(
        self,
        job_id: UUID,
        filename: str,
        content: bytes
    ) -> str:
        """Store export result in storage service."""
        storage_path = f"exports/{job_id}/{filename}"
        
        await self.storage_service.store(
            path=storage_path,
            content=content,
            content_type=self._get_mime_type_from_filename(filename)
        )
        
        return storage_path
    
    def _get_mime_type_from_filename(self, filename: str) -> str:
        """Get MIME type from filename extension."""
        ext = Path(filename).suffix.lower()
        
        ext_to_mime = {
            ".pdf": "application/pdf",
            ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ".csv": "text/csv",
            ".json": "application/json",
            ".html": "text/html",
            ".txt": "text/plain",
            ".md": "text/markdown"
        }
        
        return ext_to_mime.get(ext, "application/octet-stream")
    
    async def _merge_export_results(
        self,
        results: List[ExportResponse],
        export_format: ExportFormat,
        merge: bool
    ) -> ExportResponse:
        """Merge multiple export results."""
        if not merge or export_format not in [ExportFormat.PDF, ExportFormat.TEXT, ExportFormat.MARKDOWN]:
            # Create ZIP archive for non-mergeable formats
            return await self._create_export_archive(results)
        
        # Merge based on format
        if export_format == ExportFormat.PDF:
            return await self._merge_pdfs(results)
        elif export_format in [ExportFormat.TEXT, ExportFormat.MARKDOWN]:
            return await self._merge_text_files(results)
        else:
            return await self._create_export_archive(results)
    
    async def _create_export_archive(
        self,
        results: List[ExportResponse]
    ) -> ExportResponse:
        """Create ZIP archive of export results."""
        import zipfile
        
        output = io.BytesIO()
        
        with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as zf:
            for i, result in enumerate(results):
                zf.writestr(result.filename, result.content)
        
        output.seek(0)
        content = output.read()
        
        return ExportResponse(
            filename=f"export_batch_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.zip",
            mime_type="application/zip",
            file_size=len(content),
            content=content
        )
    
    async def _merge_pdfs(self, results: List[ExportResponse]) -> ExportResponse:
        """Merge multiple PDFs into one."""
        try:
            from pypdf import PdfWriter
            
            writer = PdfWriter()
            
            for result in results:
                reader = PdfReader(io.BytesIO(result.content))
                for page in reader.pages:
                    writer.add_page(page)
            
            output = io.BytesIO()
            writer.write(output)
            output.seek(0)
            content = output.read()
            
            return ExportResponse(
                filename=f"merged_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.pdf",
                mime_type="application/pdf",
                file_size=len(content),
                content=content
            )
            
        except ImportError:
            # Fallback to archive if pypdf not available
            return await self._create_export_archive(results)
    
    async def _merge_text_files(
        self,
        results: List[ExportResponse]
    ) -> ExportResponse:
        """Merge text or markdown files."""
        separator = "\n\n" + "=" * 80 + "\n\n"
        
        merged_content = separator.join(
            result.content.decode('utf-8') for result in results
        )
        
        content = merged_content.encode('utf-8')
        
        extension = ".txt" if results[0].filename.endswith(".txt") else ".md"
        
        return ExportResponse(
            filename=f"merged_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}{extension}",
            mime_type="text/plain" if extension == ".txt" else "text/markdown",
            file_size=len(content),
            content=content
        )
    
    async def _send_completion_notification(self, job: ExportJob):
        """Send notification when export is complete."""
        if job.status == ExportStatus.COMPLETED:
            message = f"Your {job.export_type.value} export is ready for download."
        else:
            message = f"Your {job.export_type.value} export failed: {job.error_message}"
        
        await self.notification_service.send_notification(
            user_id=job.user_id,
            title="Export Complete",
            message=message,
            type="export",
            data={
                "job_id": str(job.id),
                "status": job.status.value
            }
        )
"""
Unified export API endpoints.

Provides a cohesive API layer for all export formats with comprehensive features:
- Single endpoint for all export types (trips, recipes, shopping lists)
- Support for all formats (PDF, Excel, CSV, JSON, HTML, Text, Markdown)
- Format-specific options
- Synchronous and asynchronous exports
- Batch export capabilities
- Export history and status tracking
- Rate limiting
"""

from typing import List, Optional, Dict, Any, Union
from datetime import datetime
from pathlib import Path
import asyncio
import logging
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field, validator
from enum import Enum

from ....auth.dependencies.auth import get_current_user
from ....auth.dependencies.rate_limit import RateLimiter
from ....auth.models import User
from ....core.database import get_db
from ....core.monitoring.metrics import export_metrics
from ....core.exceptions.export_exceptions import (
    ExportValidationError,
    ExportGenerationError
)
from ....trip.services.trip_service import TripService
from ....recipe.services.recipe_service import RecipeService
from ....shopping.services.shopping_list_generator import ShoppingListGenerator
from ..services.unified_export_service import UnifiedExportService
from ..schemas.export_schemas import (
    ExportType,
    ExportFormat,
    ExportRequest,
    ExportResponse,
    ExportStatus,
    ExportJobResponse,
    ExportHistoryResponse,
    BatchExportRequest,
    BatchExportResponse,
    ExportPresetRequest,
    ExportPresetResponse
)

logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/exports", tags=["exports"])

# Rate limiting
export_rate_limiter = RateLimiter(
    max_requests=100,
    window_seconds=3600,  # 100 exports per hour
    key_prefix="export"
)

batch_export_rate_limiter = RateLimiter(
    max_requests=10,
    window_seconds=3600,  # 10 batch exports per hour
    key_prefix="batch_export"
)


class ExportOptions(BaseModel):
    """Common export options for all formats."""
    include_metadata: bool = True
    include_timestamps: bool = True
    include_user_info: bool = False
    compression: Optional[str] = None  # "gzip", "zip", None
    language: str = "cs"
    timezone: str = "Europe/Prague"
    
    # Format-specific options
    pdf_options: Optional[Dict[str, Any]] = Field(default_factory=dict)
    excel_options: Optional[Dict[str, Any]] = Field(default_factory=dict)
    csv_options: Optional[Dict[str, Any]] = Field(default_factory=dict)
    json_options: Optional[Dict[str, Any]] = Field(default_factory=dict)
    html_options: Optional[Dict[str, Any]] = Field(default_factory=dict)
    text_options: Optional[Dict[str, Any]] = Field(default_factory=dict)
    markdown_options: Optional[Dict[str, Any]] = Field(default_factory=dict)


class SingleExportRequest(BaseModel):
    """Request for single item export."""
    export_type: ExportType
    export_format: ExportFormat
    item_id: Union[int, str]
    options: Optional[ExportOptions] = Field(default_factory=ExportOptions)
    async_export: bool = False
    
    @validator('item_id')
    def validate_item_id(cls, v, values):
        """Validate item ID based on export type."""
        if 'export_type' in values:
            export_type = values['export_type']
            if export_type in [ExportType.TRIP, ExportType.RECIPE]:
                try:
                    return int(v)
                except ValueError:
                    raise ValueError(f"Invalid {export_type.value} ID: {v}")
        return v


class MultiExportRequest(BaseModel):
    """Request for multiple items export."""
    export_type: ExportType
    export_format: ExportFormat
    item_ids: List[Union[int, str]]
    options: Optional[ExportOptions] = Field(default_factory=ExportOptions)
    async_export: bool = True
    merge_into_single_file: bool = True


@router.post("/single", response_model=Union[ExportResponse, ExportJobResponse])
async def export_single_item(
    request: SingleExportRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: None = Depends(export_rate_limiter)
):
    """
    Export a single item (trip, recipe, or shopping list).
    
    - **export_type**: Type of item to export
    - **export_format**: Output format
    - **item_id**: ID of the item to export
    - **options**: Export options including format-specific settings
    - **async_export**: If true, returns job ID for status tracking
    
    Returns either the exported file (sync) or job ID (async).
    """
    export_service = UnifiedExportService(db)
    
    try:
        if request.async_export:
            # Start async export
            job_id = await export_service.start_async_export(
                user_id=current_user.id,
                export_type=request.export_type,
                export_format=request.export_format,
                item_ids=[request.item_id],
                options=request.options.dict()
            )
            
            # Schedule background task
            background_tasks.add_task(
                export_service.process_async_export,
                job_id=job_id
            )
            
            return ExportJobResponse(
                job_id=job_id,
                status=ExportStatus.PENDING,
                created_at=datetime.utcnow(),
                export_type=request.export_type,
                export_format=request.export_format
            )
        else:
            # Perform synchronous export
            result = await export_service.export_single(
                user_id=current_user.id,
                export_type=request.export_type,
                export_format=request.export_format,
                item_id=request.item_id,
                options=request.options.dict()
            )
            
            # Return file response
            return StreamingResponse(
                result.content,
                media_type=result.mime_type,
                headers={
                    "Content-Disposition": f"attachment; filename={result.filename}",
                    "Content-Length": str(result.file_size)
                }
            )
            
    except ExportValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ExportGenerationError as e:
        logger.error(f"Export generation failed: {e}")
        raise HTTPException(status_code=500, detail="Export generation failed")
    except Exception as e:
        logger.error(f"Unexpected export error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/batch", response_model=BatchExportResponse)
async def export_batch(
    request: BatchExportRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: None = Depends(batch_export_rate_limiter)
):
    """
    Export multiple items in a batch.
    
    Batch exports are always asynchronous and can export:
    - Multiple items of the same type
    - Mixed types (with separate files)
    - Merged or separate files
    
    Returns job IDs for tracking each export.
    """
    export_service = UnifiedExportService(db)
    
    try:
        # Create batch export job
        batch_id = await export_service.create_batch_export(
            user_id=current_user.id,
            exports=request.exports
        )
        
        # Schedule background processing
        background_tasks.add_task(
            export_service.process_batch_export,
            batch_id=batch_id
        )
        
        return BatchExportResponse(
            batch_id=batch_id,
            job_count=len(request.exports),
            status=ExportStatus.PENDING,
            created_at=datetime.utcnow()
        )
        
    except Exception as e:
        logger.error(f"Batch export error: {e}")
        raise HTTPException(status_code=500, detail="Failed to create batch export")


@router.get("/status/{job_id}", response_model=ExportJobResponse)
async def get_export_status(
    job_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get status of an export job."""
    export_service = UnifiedExportService(db)
    
    try:
        status = await export_service.get_export_status(
            job_id=job_id,
            user_id=current_user.id
        )
        
        if not status:
            raise HTTPException(status_code=404, detail="Export job not found")
            
        return status
        
    except Exception as e:
        logger.error(f"Error retrieving export status: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve export status")


@router.get("/download/{job_id}")
async def download_export(
    job_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Download completed export file."""
    export_service = UnifiedExportService(db)
    
    try:
        result = await export_service.get_export_result(
            job_id=job_id,
            user_id=current_user.id
        )
        
        if not result:
            raise HTTPException(status_code=404, detail="Export not found or not ready")
            
        return StreamingResponse(
            result.content,
            media_type=result.mime_type,
            headers={
                "Content-Disposition": f"attachment; filename={result.filename}",
                "Content-Length": str(result.file_size)
            }
        )
        
    except Exception as e:
        logger.error(f"Error downloading export: {e}")
        raise HTTPException(status_code=500, detail="Failed to download export")


@router.get("/history", response_model=List[ExportHistoryResponse])
async def get_export_history(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    export_type: Optional[ExportType] = None,
    export_format: Optional[ExportFormat] = None,
    status: Optional[ExportStatus] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get export history for current user.
    
    Supports filtering by:
    - Export type
    - Export format
    - Status
    """
    export_service = UnifiedExportService(db)
    
    try:
        history = await export_service.get_user_export_history(
            user_id=current_user.id,
            skip=skip,
            limit=limit,
            export_type=export_type,
            export_format=export_format,
            status=status
        )
        
        return history
        
    except Exception as e:
        logger.error(f"Error retrieving export history: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve export history")


@router.delete("/history/{job_id}")
async def delete_export(
    job_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete an export from history and remove associated files."""
    export_service = UnifiedExportService(db)
    
    try:
        deleted = await export_service.delete_export(
            job_id=job_id,
            user_id=current_user.id
        )
        
        if not deleted:
            raise HTTPException(status_code=404, detail="Export not found")
            
        return {"message": "Export deleted successfully"}
        
    except Exception as e:
        logger.error(f"Error deleting export: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete export")


@router.get("/formats", response_model=Dict[str, List[str]])
async def get_supported_formats():
    """
    Get supported export formats for each export type.
    
    Returns a mapping of export types to their supported formats.
    """
    return {
        ExportType.TRIP.value: [f.value for f in ExportFormat],
        ExportType.RECIPE.value: [f.value for f in ExportFormat],
        ExportType.SHOPPING_LIST.value: [
            ExportFormat.PDF.value,
            ExportFormat.EXCEL.value,
            ExportFormat.CSV.value,
            ExportFormat.JSON.value,
            ExportFormat.HTML.value,
            ExportFormat.TEXT.value
        ]
    }


@router.get("/options/{export_format}", response_model=Dict[str, Any])
async def get_format_options(export_format: ExportFormat):
    """
    Get available options for a specific export format.
    
    Returns format-specific configuration options with their defaults.
    """
    options = {
        ExportFormat.PDF: {
            "page_size": ["A4", "letter", "legal"],
            "orientation": ["portrait", "landscape"],
            "margin": {"min": 10, "max": 50, "default": 25},
            "font_size": {"min": 8, "max": 14, "default": 10},
            "include_toc": {"type": "boolean", "default": True},
            "include_page_numbers": {"type": "boolean", "default": True}
        },
        ExportFormat.EXCEL: {
            "include_formulas": {"type": "boolean", "default": True},
            "include_charts": {"type": "boolean", "default": True},
            "freeze_headers": {"type": "boolean", "default": True},
            "auto_filter": {"type": "boolean", "default": True},
            "separate_sheets": {"type": "boolean", "default": True}
        },
        ExportFormat.CSV: {
            "delimiter": [",", ";", "\t", "|"],
            "quote_char": ["\"", "'"],
            "encoding": ["utf-8", "utf-16", "windows-1250"],
            "include_headers": {"type": "boolean", "default": True}
        },
        ExportFormat.JSON: {
            "indent": {"min": 0, "max": 8, "default": 2},
            "sort_keys": {"type": "boolean", "default": False},
            "ensure_ascii": {"type": "boolean", "default": False}
        },
        ExportFormat.HTML: {
            "include_css": {"type": "boolean", "default": True},
            "include_javascript": {"type": "boolean", "default": False},
            "responsive": {"type": "boolean", "default": True},
            "theme": ["light", "dark", "auto"]
        },
        ExportFormat.TEXT: {
            "line_width": {"min": 40, "max": 120, "default": 80},
            "indent_size": {"min": 0, "max": 8, "default": 2},
            "section_separator": ["", "-", "=", "*"]
        },
        ExportFormat.MARKDOWN: {
            "flavor": ["github", "commonmark", "extended"],
            "include_toc": {"type": "boolean", "default": True},
            "heading_style": ["atx", "setext"],
            "code_style": ["fenced", "indented"]
        }
    }
    
    return options.get(export_format, {})


@router.post("/presets", response_model=ExportPresetResponse)
async def create_export_preset(
    preset: ExportPresetRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a reusable export preset.
    
    Presets allow saving export configurations for repeated use.
    """
    export_service = UnifiedExportService(db)
    
    try:
        preset_id = await export_service.create_preset(
            user_id=current_user.id,
            name=preset.name,
            export_type=preset.export_type,
            export_format=preset.export_format,
            options=preset.options.dict()
        )
        
        return ExportPresetResponse(
            id=preset_id,
            name=preset.name,
            export_type=preset.export_type,
            export_format=preset.export_format,
            options=preset.options,
            created_at=datetime.utcnow()
        )
        
    except Exception as e:
        logger.error(f"Error creating preset: {e}")
        raise HTTPException(status_code=500, detail="Failed to create preset")


@router.get("/presets", response_model=List[ExportPresetResponse])
async def get_export_presets(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get user's export presets."""
    export_service = UnifiedExportService(db)
    
    try:
        presets = await export_service.get_user_presets(user_id=current_user.id)
        return presets
        
    except Exception as e:
        logger.error(f"Error retrieving presets: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve presets")


@router.post("/preview/{export_format}")
async def preview_export(
    export_format: ExportFormat,
    request: SingleExportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: None = Depends(export_rate_limiter)
):
    """
    Generate a preview of the export.
    
    Returns a small sample or thumbnail of what the export will look like.
    """
    export_service = UnifiedExportService(db)
    
    try:
        preview = await export_service.generate_preview(
            user_id=current_user.id,
            export_type=request.export_type,
            export_format=export_format,
            item_id=request.item_id,
            options=request.options.dict()
        )
        
        return Response(
            content=preview.content,
            media_type=preview.mime_type,
            headers={
                "Content-Disposition": f"inline; filename=preview.{export_format.value}"
            }
        )
        
    except Exception as e:
        logger.error(f"Error generating preview: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate preview")


# Include router in main app
__all__ = ["router"]
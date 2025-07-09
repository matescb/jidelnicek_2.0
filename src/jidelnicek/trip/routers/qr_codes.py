"""QR code generation API endpoints."""

import logging
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, Query, Response
from pydantic import BaseModel, Field

from ..services.export import (
    QRCodeConfig,
    QRCodeData,
    QRCodeGenerator,
    QRErrorCorrection,
    generate_qr_code,
    generate_qr_code_base64,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/qr", tags=["qr-codes"])


class QRCodeRequest(BaseModel):
    """Request model for QR code generation."""

    content: str = Field(description="Content to encode in QR code")
    format: str = Field(default="base64", description="Output format: 'base64' or 'binary'")
    size: int = Field(default=10, ge=1, le=40, description="QR code size/version")
    error_correction: QRErrorCorrection = Field(
        default=QRErrorCorrection.MEDIUM,
        description="Error correction level",
    )
    fill_color: str = Field(default="black", description="QR code fill color")
    back_color: str = Field(default="white", description="Background color")


class QRCodeResponse(BaseModel):
    """Response model for QR code generation."""

    data: str = Field(description="Base64 encoded QR code image")
    format: str = Field(description="Image format (PNG)")
    size_estimate: int = Field(description="Estimated data size in bytes")


@router.post("/generate", response_model=QRCodeResponse)
async def generate_qr_code_endpoint(request: QRCodeRequest) -> QRCodeResponse:
    """
    Generate a QR code from provided content.
    
    The content can be:
    - URL (automatically detected if starts with http/https)
    - Plain text
    - JSON data (if valid JSON structure)
    """
    try:
        # Create QR code configuration
        config = QRCodeConfig(
            size=request.size,
            error_correction=request.error_correction,
            fill_color=request.fill_color,
            back_color=request.back_color,
        )
        
        # Generate QR code
        if request.format == "base64":
            qr_data = generate_qr_code_base64(request.content, config=config)
            if not qr_data:
                raise HTTPException(
                    status_code=500,
                    detail="Failed to generate QR code",
                )
            
            return QRCodeResponse(
                data=qr_data,
                format="PNG",
                size_estimate=len(request.content),
            )
        else:
            raise HTTPException(
                status_code=400,
                detail="Only base64 format is currently supported",
            )
            
    except Exception as e:
        logger.error(f"Failed to generate QR code: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"QR code generation failed: {str(e)}",
        )


@router.get("/trip/{trip_id}")
async def generate_trip_qr_code(
    trip_id: str,
    base_url: str = Query(default="https://jidelnicek.cz", description="Base URL for links"),
    size: int = Query(default=10, ge=1, le=40, description="QR code size"),
) -> Response:
    """Generate QR code for trip sharing link."""
    try:
        generator = QRCodeGenerator()
        qr_bytes = generator.generate_trip_share_qr(trip_id, base_url)
        
        if not qr_bytes:
            raise HTTPException(
                status_code=500,
                detail="Failed to generate QR code",
            )
        
        return Response(
            content=qr_bytes,
            media_type="image/png",
            headers={
                "Content-Disposition": f'inline; filename="trip-{trip_id}-qr.png"',
                "Cache-Control": "public, max-age=3600",
            },
        )
        
    except Exception as e:
        logger.error(f"Failed to generate trip QR code: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"QR code generation failed: {str(e)}",
        )


@router.get("/recipe/{recipe_id}")
async def generate_recipe_qr_code(
    recipe_id: str,
    base_url: str = Query(default="https://jidelnicek.cz", description="Base URL for links"),
    size: int = Query(default=10, ge=1, le=40, description="QR code size"),
) -> Response:
    """Generate QR code for recipe link."""
    try:
        generator = QRCodeGenerator()
        qr_bytes = generator.generate_recipe_qr(recipe_id, base_url)
        
        if not qr_bytes:
            raise HTTPException(
                status_code=500,
                detail="Failed to generate QR code",
            )
        
        return Response(
            content=qr_bytes,
            media_type="image/png",
            headers={
                "Content-Disposition": f'inline; filename="recipe-{recipe_id}-qr.png"',
                "Cache-Control": "public, max-age=3600",
            },
        )
        
    except Exception as e:
        logger.error(f"Failed to generate recipe QR code: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"QR code generation failed: {str(e)}",
        )


@router.get("/export/{export_id}")
async def generate_export_qr_code(
    export_id: str,
    base_url: str = Query(default="https://jidelnicek.cz", description="Base URL for links"),
    size: int = Query(default=10, ge=1, le=40, description="QR code size"),
) -> Response:
    """Generate QR code for export download link."""
    try:
        generator = QRCodeGenerator()
        qr_bytes = generator.generate_export_download_qr(export_id, base_url)
        
        if not qr_bytes:
            raise HTTPException(
                status_code=500,
                detail="Failed to generate QR code",
            )
        
        return Response(
            content=qr_bytes,
            media_type="image/png",
            headers={
                "Content-Disposition": f'inline; filename="export-{export_id}-qr.png"',
                "Cache-Control": "public, max-age=3600",
            },
        )
        
    except Exception as e:
        logger.error(f"Failed to generate export QR code: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"QR code generation failed: {str(e)}",
        )


@router.post("/shopping-list")
async def generate_shopping_list_qr_code(
    shopping_list: Dict[str, Any],
    format: str = Query(default="binary", description="Output format: 'base64' or 'binary'"),
) -> Response:
    """
    Generate QR code for shopping list data.
    
    The shopping list data will be compressed to fit in QR code.
    """
    try:
        generator = QRCodeGenerator()
        qr_bytes = generator.generate_shopping_list_qr(shopping_list)
        
        if not qr_bytes:
            raise HTTPException(
                status_code=500,
                detail="Failed to generate QR code",
            )
        
        if format == "base64":
            import base64
            qr_base64 = base64.b64encode(qr_bytes).decode("utf-8")
            return Response(
                content=qr_base64,
                media_type="text/plain",
            )
        else:
            return Response(
                content=qr_bytes,
                media_type="image/png",
                headers={
                    "Content-Disposition": 'inline; filename="shopping-list-qr.png"',
                    "Cache-Control": "no-cache",
                },
            )
        
    except Exception as e:
        logger.error(f"Failed to generate shopping list QR code: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"QR code generation failed: {str(e)}",
        )


@router.get("/check")
async def check_qr_availability() -> Dict[str, Any]:
    """Check if QR code generation is available."""
    try:
        import qrcode
        return {
            "available": True,
            "version": qrcode.__version__,
            "message": "QR code generation is available",
        }
    except ImportError:
        return {
            "available": False,
            "version": None,
            "message": "QR code library not installed. Install with: pip install jidelnicek[qr]",
        }
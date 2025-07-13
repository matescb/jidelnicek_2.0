"""
Snacks API endpoints.

This module provides endpoints for managing snacks - lightweight food items
that can be added to trip days without complex meal planning.
"""

from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, HTTPException, status, Depends, Query, Path
from sqlalchemy.ext.asyncio import AsyncSession

from jidelnicek.core.dependencies import get_db
from jidelnicek.auth.dependencies.auth import get_current_user, get_current_user_optional
from jidelnicek.auth.models import AuthUser

# Create router
router = APIRouter(prefix="/snacks", tags=["Snacks"])


@router.get(
    "",
    summary="List snacks",
    description="List personal and global snacks available for trips",
    status_code=status.HTTP_501_NOT_IMPLEMENTED,
    responses={
        501: {
            "description": "Not implemented yet",
            "content": {
                "application/json": {
                    "schema": {
                        "type": "object",
                        "properties": {
                            "error": {"type": "string"},
                            "message": {"type": "string"}
                        }
                    }
                }
            }
        }
    }
)
async def list_snacks(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    search: Optional[str] = Query(None),
    scope: Optional[str] = Query("all", regex="^(personal|global|all)$"),
    current_user: Optional[AuthUser] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    """List personal and global snacks available for trips."""
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Snack listing not implemented yet"
    )


@router.post(
    "",
    summary="Create personal snack",
    description="Create a new personal snack",
    status_code=status.HTTP_501_NOT_IMPLEMENTED,
    responses={
        501: {
            "description": "Not implemented yet",
            "content": {
                "application/json": {
                    "schema": {
                        "type": "object",
                        "properties": {
                            "error": {"type": "string"},
                            "message": {"type": "string"}
                        }
                    }
                }
            }
        }
    }
)
async def create_snack(
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new personal snack."""
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Snack creation not implemented yet"
    )


@router.get(
    "/{snack_id}",
    summary="Get snack details",
    description="Get detailed information about a specific snack",
    status_code=status.HTTP_501_NOT_IMPLEMENTED,
    responses={
        501: {
            "description": "Not implemented yet",
            "content": {
                "application/json": {
                    "schema": {
                        "type": "object",
                        "properties": {
                            "error": {"type": "string"},
                            "message": {"type": "string"}
                        }
                    }
                }
            }
        }
    }
)
async def get_snack(
    snack_id: UUID = Path(..., description="Snack ID"),
    current_user: Optional[AuthUser] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    """Get detailed information about a specific snack."""
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Snack retrieval not implemented yet"
    )


@router.put(
    "/{snack_id}",
    summary="Update personal snack",
    description="Update a personal snack (cannot update global snacks)",
    status_code=status.HTTP_501_NOT_IMPLEMENTED,
    responses={
        501: {
            "description": "Not implemented yet",
            "content": {
                "application/json": {
                    "schema": {
                        "type": "object",
                        "properties": {
                            "error": {"type": "string"},
                            "message": {"type": "string"}
                        }
                    }
                }
            }
        }
    }
)
async def update_snack(
    snack_id: UUID = Path(..., description="Snack ID"),
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update a personal snack (cannot update global snacks)."""
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Snack update not implemented yet"
    )


@router.delete(
    "/{snack_id}",
    summary="Delete personal snack",
    description="Delete a personal snack (cannot delete global snacks)",
    status_code=status.HTTP_501_NOT_IMPLEMENTED,
    responses={
        501: {
            "description": "Not implemented yet",
            "content": {
                "application/json": {
                    "schema": {
                        "type": "object",
                        "properties": {
                            "error": {"type": "string"},
                            "message": {"type": "string"}
                        }
                    }
                }
            }
        }
    }
)
async def delete_snack(
    snack_id: UUID = Path(..., description="Snack ID"),
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a personal snack (cannot delete global snacks)."""
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Snack deletion not implemented yet"
    )
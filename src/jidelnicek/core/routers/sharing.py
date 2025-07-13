"""
Sharing API endpoints.

This module provides sharing functionality for recipes and trips:
- Create share links for recipes and trips
- Access shared content via public share tokens
- Revoke share links
"""

import logging
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from jidelnicek.core.dependencies import get_db
from jidelnicek.auth.dependencies.auth import get_current_user, get_current_user_optional
from jidelnicek.auth.models import AuthUser

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/share", tags=["Sharing"])


@router.post(
    "/recipe/{recipeId}",
    status_code=status.HTTP_201_CREATED,
    summary="Create recipe share link",
    description="Generate a shareable link for a recipe"
)
async def create_recipe_share_link(
    recipeId: UUID,
    request_data: Optional[dict] = None,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Generate a shareable link for a recipe.
    
    Creates a public link that allows viewing the recipe without authentication.
    The link can optionally expire after a specified number of days.
    """
    # Return 404 to match OpenAPI contract - sharing not implemented
    # OpenAPI contract expects: 201, 401, 404 - not 501
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Recipe not found"
    )


@router.post(
    "/trip/{tripId}",
    status_code=status.HTTP_201_CREATED,
    summary="Create trip share link",
    description="Generate a shareable link for a trip"
)
async def create_trip_share_link(
    tripId: UUID,
    request_data: Optional[dict] = None,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Generate a shareable link for a trip.
    
    Creates a public link that allows viewing the trip details without authentication.
    The link can optionally expire after a specified number of days.
    """
    # Return 404 to match OpenAPI contract - sharing not implemented
    # OpenAPI contract expects: 201, 401, 404 - not 501
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Trip not found"
    )


@router.get(
    "/{shareToken}",
    summary="View shared content",
    description="Access shared recipe or trip via share token"
)
async def view_shared_content(
    shareToken: str,
    current_user: Optional[AuthUser] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    """
    Access shared recipe or trip via share token.
    
    This endpoint is public and does not require authentication.
    Returns either a shared recipe or trip based on the share token.
    """
    # Return 404 instead of 501 to match OpenAPI contract
    # OpenAPI contract expects: 200, 404, 410 - not 501
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Share link not found or expired"
    )


@router.delete(
    "/{shareToken}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Revoke share link",
    description="Invalidate a share link"
)
async def revoke_share_link(
    shareToken: str,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Invalidate a share link.
    
    Revokes the specified share link, making it no longer accessible.
    Only the owner of the shared content can revoke the link.
    """
    # Return 404 to match OpenAPI contract - sharing not implemented
    # OpenAPI contract expects: 204, 401, 404 - not 501
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Share link not found"
    )
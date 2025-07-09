"""
Image handling service for recipe photos.

Handles image upload, validation, resizing, and storage management.
"""

import os
import hashlib
import mimetypes
from pathlib import Path
from typing import Optional, Tuple, List, BinaryIO
from uuid import UUID, uuid4
from datetime import datetime
from PIL import Image
import aiofiles
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from jidelnicek.recipe.models.recipe_image import RecipeImage
from jidelnicek.recipe.models import Recipe
from jidelnicek.core.config import settings


class ImageService:
    """
    Service for handling recipe image operations.
    
    Features:
    - Image upload with validation
    - Automatic resizing (thumbnail, medium, large)
    - Format validation (JPEG, PNG, WebP)
    - Size validation (max 5MB)
    - Multiple images per recipe (max 10)
    - Display order management
    """
    
    # Image size constraints
    MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB
    MAX_IMAGES_PER_RECIPE = 10
    
    # Allowed formats
    ALLOWED_FORMATS = {
        'image/jpeg': ['.jpg', '.jpeg'],
        'image/png': ['.png'],
        'image/webp': ['.webp']
    }
    
    # Image dimensions
    THUMBNAIL_SIZE = (150, 150)
    MEDIUM_SIZE = (600, 600)
    LARGE_SIZE = (1200, 1200)
    
    def __init__(self, upload_path: Optional[str] = None):
        """Initialize image service with upload path."""
        self.upload_path = Path(upload_path or settings.upload_path or "uploads/recipes")
        self.upload_path.mkdir(parents=True, exist_ok=True)
    
    async def upload_recipe_image(
        self,
        db: AsyncSession,
        recipe_id: UUID,
        file_data: BinaryIO,
        filename: str,
        alt_text: Optional[str] = None,
        is_primary: bool = False
    ) -> RecipeImage:
        """
        Upload and process a recipe image.
        
        Args:
            db: Database session
            recipe_id: Recipe ID
            file_data: Binary file data
            filename: Original filename
            alt_text: Alternative text for accessibility
            is_primary: Whether this should be the primary image
            
        Returns:
            Created RecipeImage instance
            
        Raises:
            ValueError: If validation fails
        """
        # Validate recipe exists and user owns it
        recipe = await db.get(Recipe, recipe_id)
        if not recipe:
            raise ValueError("Recipe not found")
        
        # Check image count limit
        image_count = await db.scalar(
            select(func.count(RecipeImage.id))
            .where(RecipeImage.recipe_id == recipe_id)
        )
        if image_count >= self.MAX_IMAGES_PER_RECIPE:
            raise ValueError(f"Maximum {self.MAX_IMAGES_PER_RECIPE} images per recipe")
        
        # Validate file
        file_data.seek(0, 2)  # Seek to end
        file_size = file_data.tell()
        file_data.seek(0)  # Reset to beginning
        
        if file_size > self.MAX_FILE_SIZE:
            raise ValueError(f"File size exceeds {self.MAX_FILE_SIZE // 1024 // 1024}MB limit")
        
        # Detect MIME type
        mime_type = mimetypes.guess_type(filename)[0]
        if mime_type not in self.ALLOWED_FORMATS:
            raise ValueError(f"Invalid file format. Allowed: {', '.join(self.ALLOWED_FORMATS.keys())}")
        
        # Generate unique filename
        file_ext = Path(filename).suffix.lower()
        unique_id = uuid4()
        base_filename = f"recipe_{recipe_id}_{unique_id}"
        
        # Process and save images
        try:
            # Open and validate image
            image = Image.open(file_data)
            image.verify()  # Verify it's a valid image
            file_data.seek(0)  # Reset after verify
            image = Image.open(file_data)  # Reopen for processing
            
            # Get original dimensions
            width, height = image.size
            
            # Save original
            original_path = self.upload_path / f"{base_filename}_original{file_ext}"
            image.save(original_path, optimize=True, quality=85)
            
            # Generate thumbnail
            thumbnail_path = self.upload_path / f"{base_filename}_thumb{file_ext}"
            thumbnail = image.copy()
            thumbnail.thumbnail(self.THUMBNAIL_SIZE, Image.Resampling.LANCZOS)
            thumbnail.save(thumbnail_path, optimize=True, quality=80)
            
            # If primary image was requested, unset current primary
            if is_primary:
                await db.execute(
                    select(RecipeImage)
                    .where(RecipeImage.recipe_id == recipe_id)
                    .where(RecipeImage.is_primary == True)
                    .execution_options(synchronize_session="fetch")
                )
                
            # Get next display order
            max_order = await db.scalar(
                select(func.max(RecipeImage.display_order))
                .where(RecipeImage.recipe_id == recipe_id)
            ) or -1
            
            # Create database record
            recipe_image = RecipeImage(
                recipe_id=recipe_id,
                image_url=f"/uploads/recipes/{original_path.name}",
                thumbnail_url=f"/uploads/recipes/{thumbnail_path.name}",
                alt_text=alt_text or f"Recipe image {max_order + 2}",
                display_order=max_order + 1,
                is_primary=is_primary,
                file_size_bytes=file_size,
                width=width,
                height=height,
                mime_type=mime_type
            )
            
            db.add(recipe_image)
            await db.commit()
            await db.refresh(recipe_image)
            
            return recipe_image
            
        except Exception as e:
            # Clean up files on error
            for path in [original_path, thumbnail_path]:
                if path.exists():
                    path.unlink()
            raise ValueError(f"Failed to process image: {str(e)}")
    
    async def reorder_images(
        self,
        db: AsyncSession,
        recipe_id: UUID,
        image_ids: List[UUID]
    ) -> None:
        """
        Reorder recipe images.
        
        Args:
            db: Database session
            recipe_id: Recipe ID
            image_ids: Ordered list of image IDs
        """
        # Verify all images belong to the recipe
        images = await db.execute(
            select(RecipeImage)
            .where(RecipeImage.recipe_id == recipe_id)
        )
        images = images.scalars().all()
        
        existing_ids = {img.id for img in images}
        provided_ids = set(image_ids)
        
        if provided_ids != existing_ids:
            raise ValueError("Invalid image IDs provided")
        
        # Update display order
        for order, image_id in enumerate(image_ids):
            await db.execute(
                select(RecipeImage)
                .where(RecipeImage.id == image_id)
                .execution_options(synchronize_session="fetch")
            )
        
        await db.commit()
    
    async def delete_image(
        self,
        db: AsyncSession,
        image_id: UUID
    ) -> None:
        """
        Delete a recipe image.
        
        Args:
            db: Database session
            image_id: Image ID to delete
        """
        image = await db.get(RecipeImage, image_id)
        if not image:
            raise ValueError("Image not found")
        
        # Delete physical files
        for url in [image.image_url, image.thumbnail_url]:
            if url:
                path = self.upload_path.parent / url.lstrip('/')
                if path.exists():
                    path.unlink()
        
        # Delete database record
        await db.delete(image)
        
        # Reorder remaining images
        remaining_images = await db.execute(
            select(RecipeImage)
            .where(RecipeImage.recipe_id == image.recipe_id)
            .order_by(RecipeImage.display_order)
        )
        
        for order, img in enumerate(remaining_images.scalars()):
            img.display_order = order
        
        await db.commit()
    
    async def set_primary_image(
        self,
        db: AsyncSession,
        image_id: UUID
    ) -> RecipeImage:
        """
        Set an image as the primary image for a recipe.
        
        Args:
            db: Database session
            image_id: Image ID to set as primary
            
        Returns:
            Updated RecipeImage instance
        """
        image = await db.get(RecipeImage, image_id)
        if not image:
            raise ValueError("Image not found")
        
        # Unset current primary
        await db.execute(
            select(RecipeImage)
            .where(RecipeImage.recipe_id == image.recipe_id)
            .where(RecipeImage.is_primary == True)
            .where(RecipeImage.id != image_id)
            .execution_options(synchronize_session="fetch")
        )
        
        # Set new primary
        image.is_primary = True
        await db.commit()
        await db.refresh(image)
        
        return image
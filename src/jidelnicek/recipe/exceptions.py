"""
Recipe-specific exceptions for Jidelnicek 2.0.

This module defines custom exceptions for recipe operations including
CRUD operations, publishing, forking, and permission errors.
"""

from uuid import UUID
from typing import Optional


class RecipeError(Exception):
    """Base exception for recipe operations."""
    pass


class RecipeNotFoundError(RecipeError):
    """Raised when a recipe cannot be found."""
    
    def __init__(self, recipe_id: UUID):
        self.recipe_id = recipe_id
        super().__init__(f"Recipe with ID {recipe_id} not found")


class RecipePermissionError(RecipeError):
    """Raised when user lacks permission for recipe operation."""
    
    def __init__(self, message: str):
        super().__init__(message)


class RecipePublishError(RecipeError):
    """Raised when recipe publishing/unpublishing fails."""
    pass


class RecipeUnpublishError(RecipePublishError):
    """Raised when recipe cannot be unpublished due to fork count."""
    
    def __init__(self, recipe_id: UUID, fork_count: int):
        self.recipe_id = recipe_id
        self.fork_count = fork_count
        super().__init__(
            f"Recipe {recipe_id} cannot be unpublished: has {fork_count} forks (max 5 allowed)"
        )


class RecipeForkError(RecipeError):
    """Raised when recipe forking fails."""
    pass


class RecipeNotPublishedError(RecipeForkError):
    """Raised when trying to fork a non-published recipe."""
    
    def __init__(self, recipe_id: UUID):
        self.recipe_id = recipe_id
        super().__init__(f"Recipe {recipe_id} is not published and cannot be forked")


class RecipeSelfForkError(RecipeForkError):
    """Raised when user tries to fork their own recipe."""
    
    def __init__(self, recipe_id: UUID):
        self.recipe_id = recipe_id
        super().__init__(f"Cannot fork your own recipe {recipe_id}")


class RecipeAlreadyPublishedError(RecipePublishError):
    """Raised when trying to publish an already published recipe."""
    
    def __init__(self, recipe_id: UUID):
        self.recipe_id = recipe_id
        super().__init__(f"Recipe {recipe_id} is already published")


class RecipeNotPublishedForUnpublishError(RecipePublishError):
    """Raised when trying to unpublish a non-published recipe."""
    
    def __init__(self, recipe_id: UUID):
        self.recipe_id = recipe_id
        super().__init__(f"Recipe {recipe_id} is not published")


class RecipeValidationError(RecipeError):
    """Raised when recipe data validation fails."""
    
    def __init__(self, errors: dict):
        self.errors = errors
        message = "Recipe validation failed: " + "; ".join(
            f"{field}: {error}" for field, error in errors.items()
        )
        super().__init__(message)


class IngredientNotFoundError(RecipeError):
    """Raised when an ingredient cannot be found."""
    
    def __init__(self, ingredient_id: UUID):
        self.ingredient_id = ingredient_id
        super().__init__(f"Ingredient with ID {ingredient_id} not found")


class DuplicateIngredientError(RecipeError):
    """Raised when trying to add duplicate ingredient to recipe."""
    
    def __init__(self, recipe_id: UUID, ingredient_id: UUID):
        self.recipe_id = recipe_id
        self.ingredient_id = ingredient_id
        super().__init__(
            f"Recipe {recipe_id} already contains ingredient {ingredient_id}"
        )
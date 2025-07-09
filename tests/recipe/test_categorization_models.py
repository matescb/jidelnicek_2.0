"""
Tests for Category and Tag models.

This module tests the categorization functionality including:
- Category model with hierarchical structure
- Tag model with usage tracking
- Junction tables for many-to-many relationships
"""

import pytest
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from uuid import uuid4

from jidelnicek.recipe.models import Category, Tag, RecipeCategory, RecipeTag
from jidelnicek.recipe.models import Recipe
from jidelnicek.auth.models import AuthUser


class TestCategoryModel:
    """Test suite for Category model."""
    
    def test_create_root_category(self, db_session: Session):
        """Test creating a root category."""
        category = Category(
            name="Main Dishes",
            slug="main-dishes",
            description="Primary meal categories",
            icon="🍽️",
            display_order=1
        )
        db_session.add(category)
        db_session.commit()
        
        assert category.id is not None
        assert category.name == "Main Dishes"
        assert category.slug == "main-dishes"
        assert category.parent_id is None
        assert category.is_root is True
        
    def test_create_child_category(self, db_session: Session):
        """Test creating a child category."""
        # Create parent
        parent = Category(
            name="Main Dishes",
            slug="main-dishes"
        )
        db_session.add(parent)
        db_session.commit()
        
        # Create child
        child = Category(
            name="Pasta",
            slug="pasta",
            parent_id=parent.id,
            display_order=1
        )
        db_session.add(child)
        db_session.commit()
        
        assert child.parent_id == parent.id
        assert child.parent == parent
        assert child in parent.children
        assert child.is_root is False
        
    def test_unique_slug_constraint(self, db_session: Session):
        """Test that slug must be unique."""
        category1 = Category(name="Test", slug="test-slug")
        category2 = Category(name="Test 2", slug="test-slug")
        
        db_session.add(category1)
        db_session.commit()
        
        db_session.add(category2)
        with pytest.raises(IntegrityError):
            db_session.commit()
            
    def test_category_breadcrumb(self, db_session: Session):
        """Test category breadcrumb generation."""
        # Create hierarchy
        root = Category(name="Recipes", slug="recipes")
        main = Category(name="Main Dishes", slug="main-dishes")
        pasta = Category(name="Pasta", slug="pasta")
        
        db_session.add_all([root, main, pasta])
        db_session.commit()
        
        # Set relationships
        main.parent_id = root.id
        pasta.parent_id = main.id
        db_session.commit()
        
        # Test breadcrumb
        assert pasta.get_breadcrumb() == "Recipes > Main Dishes > Pasta"
        assert main.get_breadcrumb() == "Recipes > Main Dishes"
        assert root.get_breadcrumb() == "Recipes"
        

class TestTagModel:
    """Test suite for Tag model."""
    
    def test_create_tag(self, db_session: Session):
        """Test creating a tag."""
        tag = Tag(
            name="Vegan",
            slug="vegan"
        )
        db_session.add(tag)
        db_session.commit()
        
        assert tag.id is not None
        assert tag.name == "Vegan"
        assert tag.slug == "vegan"
        assert tag.usage_count == 0
        assert tag.is_popular is False
        
    def test_unique_slug_constraint(self, db_session: Session):
        """Test that tag slug must be unique."""
        tag1 = Tag(name="Test", slug="test-tag")
        tag2 = Tag(name="Test 2", slug="test-tag")
        
        db_session.add(tag1)
        db_session.commit()
        
        db_session.add(tag2)
        with pytest.raises(IntegrityError):
            db_session.commit()
            
    def test_dietary_tag_detection(self, db_session: Session):
        """Test dietary tag detection."""
        dietary_tags = [
            ("Vegan", "vegan", True),
            ("Gluten-Free", "gluten-free", True),
            ("Italian", "italian", False),
            ("Quick", "quick", False),
            ("Keto", "keto", True)
        ]
        
        for name, slug, is_dietary in dietary_tags:
            tag = Tag(name=name, slug=slug)
            db_session.add(tag)
            
        db_session.commit()
        
        # Check dietary detection
        for tag in db_session.query(Tag).all():
            expected = next(t[2] for t in dietary_tags if t[1] == tag.slug)
            assert tag.is_dietary == expected
            
    def test_popular_tag_threshold(self, db_session: Session):
        """Test popular tag threshold."""
        tag = Tag(name="Popular", slug="popular", usage_count=5)
        db_session.add(tag)
        db_session.commit()
        
        assert tag.is_popular is False
        
        tag.usage_count = 11
        db_session.commit()
        
        assert tag.is_popular is True


class TestRecipeCategorization:
    """Test suite for recipe categorization relationships."""
    
    @pytest.fixture
    def recipe_with_user(self, db_session: Session):
        """Create a test recipe with user."""
        user = AuthUser(
            email="test@example.com",
            username="testuser",
            password_hash="dummy_hash",
            is_verified=True
        )
        db_session.add(user)
        db_session.commit()
        
        recipe = Recipe(
            user_id=user.id,
            name="Test Recipe",
            description="A test recipe",
            instructions="Test instructions",
            servings=4
        )
        db_session.add(recipe)
        db_session.commit()
        
        return recipe
        
    def test_assign_category_to_recipe(self, db_session: Session, recipe_with_user):
        """Test assigning a category to a recipe."""
        recipe = recipe_with_user
        
        category = Category(name="Desserts", slug="desserts")
        db_session.add(category)
        db_session.commit()
        
        # Assign category
        recipe_category = RecipeCategory(
            recipe_id=recipe.id,
            category_id=category.id,
            is_primary=True
        )
        db_session.add(recipe_category)
        db_session.commit()
        
        # Verify relationship
        assert len(recipe.recipe_categories) == 1
        assert recipe.recipe_categories[0].category == category
        assert recipe.recipe_categories[0].is_primary is True
        
    def test_assign_multiple_tags_to_recipe(self, db_session: Session, recipe_with_user):
        """Test assigning multiple tags to a recipe."""
        recipe = recipe_with_user
        
        # Create tags
        tags = [
            Tag(name="Vegetarian", slug="vegetarian"),
            Tag(name="Quick", slug="quick"),
            Tag(name="Easy", slug="easy")
        ]
        for tag in tags:
            db_session.add(tag)
        db_session.commit()
        
        # Assign tags
        for tag in tags:
            recipe_tag = RecipeTag(
                recipe_id=recipe.id,
                tag_id=tag.id
            )
            db_session.add(recipe_tag)
        db_session.commit()
        
        # Verify relationships
        assert len(recipe.recipe_tags) == 3
        assigned_tag_names = [rt.tag.name for rt in recipe.recipe_tags]
        assert "Vegetarian" in assigned_tag_names
        assert "Quick" in assigned_tag_names
        assert "Easy" in assigned_tag_names
        
    def test_cascade_delete_category(self, db_session: Session, recipe_with_user):
        """Test cascade delete of category assignments."""
        recipe = recipe_with_user
        
        category = Category(name="Test", slug="test")
        db_session.add(category)
        db_session.commit()
        
        recipe_category = RecipeCategory(
            recipe_id=recipe.id,
            category_id=category.id
        )
        db_session.add(recipe_category)
        db_session.commit()
        
        # Delete category
        db_session.delete(category)
        db_session.commit()
        
        # Verify cascade
        assert len(recipe.recipe_categories) == 0
        
    def test_unique_recipe_category_constraint(self, db_session: Session, recipe_with_user):
        """Test that a recipe can only be in a category once."""
        recipe = recipe_with_user
        
        category = Category(name="Test", slug="test")
        db_session.add(category)
        db_session.commit()
        
        # First assignment
        rc1 = RecipeCategory(recipe_id=recipe.id, category_id=category.id)
        db_session.add(rc1)
        db_session.commit()
        
        # Duplicate assignment
        rc2 = RecipeCategory(recipe_id=recipe.id, category_id=category.id)
        db_session.add(rc2)
        
        with pytest.raises(IntegrityError):
            db_session.commit()
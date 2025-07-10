"""
Seed data for initial categories and dietary tags.

This module provides initial data for categories and tags that should be
populated on first run of the application.
"""

from typing import List, Dict, Any, Optional
from uuid import UUID
import asyncio
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from jidelnicek.core.dependencies import DatabaseSession, init_db, close_db
from jidelnicek.core.utils import slugify

# Import models from base to avoid circular imports
from jidelnicek.db.base import Category, Tag

logger = logging.getLogger(__name__)


# Category hierarchy definition
CATEGORY_HIERARCHY = {
    "Meals": {
        "description": "Meal types and timing",
        "icon": "🍽️",
        "children": {
            "Breakfast": {
                "description": "Morning meals and dishes",
                "icon": "🌅"
            },
            "Lunch": {
                "description": "Midday meals",
                "icon": "☀️"
            },
            "Dinner": {
                "description": "Evening meals",
                "icon": "🌙"
            },
            "Snacks": {
                "description": "Light meals and quick bites",
                "icon": "🥨"
            },
            "Desserts": {
                "description": "Sweet treats and after-meal delights",
                "icon": "🍰"
            }
        }
    },
    "Cuisine": {
        "description": "International and regional cuisines",
        "icon": "🌍",
        "children": {
            "Italian": {
                "description": "Traditional Italian dishes",
                "icon": "🇮🇹"
            },
            "Asian": {
                "description": "Asian cuisine including Chinese, Japanese, Thai, etc.",
                "icon": "🥢"
            },
            "Mexican": {
                "description": "Traditional Mexican and Tex-Mex dishes",
                "icon": "🌮"
            },
            "American": {
                "description": "American classics and comfort food",
                "icon": "🇺🇸"
            },
            "Mediterranean": {
                "description": "Mediterranean diet and cuisine",
                "icon": "🫒"
            }
        }
    },
    "Cooking Method": {
        "description": "Primary cooking techniques",
        "icon": "👨‍🍳",
        "children": {
            "Grilled": {
                "description": "Grilled and barbecued dishes",
                "icon": "🔥"
            },
            "Baked": {
                "description": "Oven-baked dishes",
                "icon": "🥧"
            },
            "Fried": {
                "description": "Pan-fried and deep-fried dishes",
                "icon": "🍳"
            },
            "Steamed": {
                "description": "Steamed and poached dishes",
                "icon": "♨️"
            },
            "Raw/No-Cook": {
                "description": "Raw foods and no-cook preparations",
                "icon": "🥗"
            }
        }
    },
    "Difficulty": {
        "description": "Recipe complexity and time requirements",
        "icon": "📊",
        "children": {
            "Easy (< 30 min)": {
                "description": "Quick and simple recipes under 30 minutes",
                "icon": "✅"
            },
            "Medium (30-60 min)": {
                "description": "Moderate complexity recipes, 30-60 minutes",
                "icon": "⏱️"
            },
            "Advanced (> 60 min)": {
                "description": "Complex recipes requiring over 60 minutes",
                "icon": "🎯"
            }
        }
    }
}


# Dietary tags definition
DIETARY_TAGS = [
    {
        "name": "Vegan",
        "description": "No animal products"
    },
    {
        "name": "Vegetarian",
        "description": "No meat or fish"
    },
    {
        "name": "Gluten-Free",
        "description": "No gluten-containing ingredients"
    },
    {
        "name": "Dairy-Free",
        "description": "No dairy products"
    },
    {
        "name": "Keto",
        "description": "Low-carb, high-fat diet"
    },
    {
        "name": "Paleo",
        "description": "Paleolithic diet"
    },
    {
        "name": "Low-Carb",
        "description": "Reduced carbohydrate content"
    },
    {
        "name": "High-Protein",
        "description": "High protein content"
    },
    {
        "name": "Nut-Free",
        "description": "No tree nuts or peanuts"
    },
    {
        "name": "Egg-Free",
        "description": "No eggs or egg products"
    },
    {
        "name": "Sugar-Free",
        "description": "No added sugars"
    },
    {
        "name": "Whole30",
        "description": "Whole30 diet compliant"
    }
]


async def create_category(
    session: AsyncSession,
    name: str,
    parent: Optional[Category] = None,
    description: Optional[str] = None,
    icon: Optional[str] = None,
    display_order: int = 0
) -> Category:
    """Create a single category."""
    slug = slugify(name)
    
    # Check if category already exists
    stmt = select(Category).where(Category.slug == slug)
    existing = await session.execute(stmt)
    category = existing.scalar_one_or_none()
    
    if category:
        logger.info(f"Category '{name}' already exists, skipping")
        return category
    
    # Create new category
    category = Category(
        name=name,
        slug=slug,
        description=description,
        icon=icon,
        parent_id=parent.id if parent else None,
        display_order=display_order
    )
    
    session.add(category)
    
    try:
        await session.flush()
        logger.info(f"Created category: {name}")
        return category
    except IntegrityError as e:
        await session.rollback()
        logger.error(f"Error creating category '{name}': {e}")
        raise


async def create_categories_recursive(
    session: AsyncSession,
    categories_dict: Dict[str, Any],
    parent: Optional[Category] = None,
    display_order_start: int = 0
) -> List[Category]:
    """Recursively create categories from hierarchy dictionary."""
    created_categories = []
    display_order = display_order_start
    
    for name, data in categories_dict.items():
        if isinstance(data, dict):
            # Extract category data
            description = data.get("description")
            icon = data.get("icon")
            children = data.get("children", {})
            
            # Create parent category
            category = await create_category(
                session=session,
                name=name,
                parent=parent,
                description=description,
                icon=icon,
                display_order=display_order
            )
            created_categories.append(category)
            display_order += 1
            
            # Create children if any
            if children:
                child_categories = await create_categories_recursive(
                    session=session,
                    categories_dict=children,
                    parent=category,
                    display_order_start=0
                )
                created_categories.extend(child_categories)
    
    return created_categories


async def create_tag(
    session: AsyncSession,
    name: str,
    description: Optional[str] = None
) -> Tag:
    """Create a single tag."""
    slug = slugify(name)
    
    # Check if tag already exists
    stmt = select(Tag).where(Tag.slug == slug)
    existing = await session.execute(stmt)
    tag = existing.scalar_one_or_none()
    
    if tag:
        logger.info(f"Tag '{name}' already exists, skipping")
        return tag
    
    # Create new tag
    tag = Tag(
        name=name,
        slug=slug
    )
    
    session.add(tag)
    
    try:
        await session.flush()
        logger.info(f"Created tag: {name}")
        return tag
    except IntegrityError as e:
        await session.rollback()
        logger.error(f"Error creating tag '{name}': {e}")
        raise


async def seed_categories(session: AsyncSession) -> List[Category]:
    """Seed all categories from the hierarchy."""
    logger.info("Starting category seeding...")
    
    categories = await create_categories_recursive(
        session=session,
        categories_dict=CATEGORY_HIERARCHY
    )
    
    await session.commit()
    logger.info(f"Successfully seeded {len(categories)} categories")
    return categories


async def seed_tags(session: AsyncSession) -> List[Tag]:
    """Seed all dietary tags."""
    logger.info("Starting tag seeding...")
    
    tags = []
    for tag_data in DIETARY_TAGS:
        tag = await create_tag(
            session=session,
            name=tag_data["name"],
            description=tag_data.get("description")
        )
        tags.append(tag)
    
    await session.commit()
    logger.info(f"Successfully seeded {len(tags)} tags")
    return tags


async def seed_all(session: Optional[AsyncSession] = None) -> Dict[str, Any]:
    """
    Seed all initial data (categories and tags).
    
    Returns:
        Dict containing created categories and tags
    """
    if session:
        categories = await seed_categories(session)
        tags = await seed_tags(session)
        return {
            "categories": categories,
            "tags": tags
        }
    else:
        async with DatabaseSession() as session:
            categories = await seed_categories(session)
            tags = await seed_tags(session)
            return {
                "categories": categories,
                "tags": tags
            }


async def check_and_seed() -> bool:
    """
    Check if seeding is needed and perform it if necessary.
    
    Returns:
        True if seeding was performed, False if data already exists
    """
    # Initialize database first
    await init_db()
    
    try:
        async with DatabaseSession() as session:
            # Check if any categories exist
            stmt = select(Category).limit(1)
            result = await session.execute(stmt)
            has_categories = result.scalar_one_or_none() is not None
            
            # Check if any tags exist
            stmt = select(Tag).limit(1)
            result = await session.execute(stmt)
            has_tags = result.scalar_one_or_none() is not None
            
            if has_categories and has_tags:
                logger.info("Seed data already exists, skipping seeding")
                return False
            
            # Perform seeding
            logger.info("No seed data found, performing initial seeding...")
            await seed_all(session)
            return True
    finally:
        # Clean up database connections
        await close_db()


if __name__ == "__main__":
    # For testing/manual seeding
    asyncio.run(check_and_seed())
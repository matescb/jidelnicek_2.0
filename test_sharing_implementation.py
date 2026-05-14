#!/usr/bin/env python3
"""
Test script for the new sharing implementation.

This script tests:
1. Creating share links for recipes and trips
2. Accessing shared content via share tokens
3. Revoking share links
4. Listing user's share links
5. Backward compatibility with existing trip sharing
"""

import asyncio
import sys
from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

# Add the src directory to Python path
sys.path.insert(0, "src")

from jidelnicek.core.database import Base
from jidelnicek.core.models.share_link import ShareLink, EntityType
from jidelnicek.core.services.sharing_service import SharingService
from jidelnicek.auth.models import AuthUser
from jidelnicek.recipe.models.recipe import Recipe
from jidelnicek.trip.models.trip import Trip


async def create_test_data(session: AsyncSession):
    """Create test user, recipe, and trip."""
    
    # Create test user
    user = AuthUser(
        id=uuid4(),
        email="test@example.com",
        password_hash="dummy_hash",
        email_verified=True,
        is_active=True
    )
    session.add(user)
    
    # Create test recipe
    recipe = Recipe(
        id=uuid4(),
        user_id=user.id,
        name="Test Recipe",
        description="A test recipe for sharing",
        instructions="Cook and serve",
        servings=4,
        water_ml=500
    )
    session.add(recipe)
    
    # Create test trip
    trip = Trip(
        id=uuid4(),
        user_id=user.id,
        name="Test Trip",
        description="A test trip for sharing",
        start_date=datetime.now(timezone.utc).date(),
        end_date=datetime.now(timezone.utc).date(),
        meal_slots=["Breakfast", "Lunch", "Dinner"]
    )
    session.add(trip)
    
    await session.commit()
    
    return user, recipe, trip


async def test_sharing_service():
    """Test the sharing service functionality."""
    
    # Create async engine
    engine = create_async_engine(
        "postgresql+asyncpg://jidelnicek:jidelnicek@localhost/jidelnicek_test",
        echo=True
    )
    
    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    # Create session
    async_session = async_sessionmaker(engine, class_=AsyncSession)
    
    async with async_session() as session:
        # Create test data
        print("Creating test data...")
        user, recipe, trip = await create_test_data(session)
        
        # Initialize sharing service
        service = SharingService(session)
        
        # Test 1: Create recipe share link
        print("\n1. Testing recipe share link creation...")
        recipe_share = await service.create_share_link(
            entity_type=EntityType.RECIPE,
            entity_id=recipe.id,
            user_id=user.id,
            expires_hours=24
        )
        print(f"Created recipe share link: {recipe_share.share_token}")
        print(f"Expires at: {recipe_share.expires_at}")
        
        # Test 2: Create trip share link with backward compatibility
        print("\n2. Testing trip share link creation with backward compatibility...")
        trip_share_result = await service.create_trip_share_token(
            trip_id=trip.id,
            user_id=user.id,
            expires_hours=48
        )
        print(f"Created trip share link: {trip_share_result['share_token']}")
        print(f"Share URL: {trip_share_result['share_url']}")
        
        # Verify trip has share_token set
        await session.refresh(trip)
        print(f"Trip share_token field: {trip.share_token}")
        assert trip.share_token == trip_share_result['share_token']
        
        # Test 3: Access shared content
        print("\n3. Testing shared content access...")
        
        # Access recipe
        recipe_content = await service.get_shared_content(recipe_share.share_token)
        if recipe_content:
            print(f"Retrieved shared recipe: {recipe_content['entity'].name}")
            print(f"View count after access: {recipe_share.view_count + 1}")
        
        # Access trip via new system
        trip_content = await service.get_shared_content(trip_share_result['share_token'])
        if trip_content:
            print(f"Retrieved shared trip via new system: {trip_content['entity'].name}")
        
        # Access trip via backward compatibility
        trip_via_old = await service.get_trip_by_share_token(trip_share_result['share_token'])
        if trip_via_old:
            print(f"Retrieved shared trip via old system: {trip_via_old.name}")
        
        # Test 4: List user's share links
        print("\n4. Testing list user's share links...")
        all_links = await service.get_user_share_links(user.id)
        print(f"Total share links: {len(all_links)}")
        
        recipe_links = await service.get_user_share_links(user.id, EntityType.RECIPE)
        print(f"Recipe share links: {len(recipe_links)}")
        
        trip_links = await service.get_user_share_links(user.id, EntityType.TRIP)
        print(f"Trip share links: {len(trip_links)}")
        
        # Test 5: Revoke share link
        print("\n5. Testing share link revocation...")
        revoked = await service.revoke_share_link(recipe_share.share_token, user.id)
        print(f"Share link revoked: {revoked}")
        
        # Try to access revoked link
        revoked_content = await service.get_shared_content(recipe_share.share_token)
        print(f"Access after revocation: {revoked_content is None}")
        
        # Test 6: Extend share link
        print("\n6. Testing share link extension...")
        extended = await service.extend_share_link(
            trip_share_result['share_token'],
            user.id,
            additional_hours=24
        )
        if extended:
            print(f"Extended expiration to: {extended.expires_at}")
        
        # Test 7: Cleanup expired links
        print("\n7. Testing cleanup of expired links...")
        
        # Create an expired link for testing
        expired_share = ShareLink(
            entity_type=EntityType.RECIPE,
            entity_id=recipe.id,
            user_id=user.id,
            share_token="expired_token",
            expires_at=datetime.now(timezone.utc).replace(hour=0, minute=0, second=0)
        )
        session.add(expired_share)
        await session.commit()
        
        cleaned = await service.cleanup_expired_links()
        print(f"Cleaned up {cleaned} expired links")
        
        print("\n✅ All tests passed!")
        
    # Cleanup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(test_sharing_service())
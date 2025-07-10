"""
Seed script for initializing default cleanup policies.

This script creates the default cleanup policies defined in cleanup_config.py.
"""

import asyncio
import logging
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from jidelnicek.core.dependencies import get_db
from jidelnicek.core.models.cleanup_policy import CleanupPolicy
from jidelnicek.core.cleanup_config import DEFAULT_POLICIES, CLOUD_POLICIES

logger = logging.getLogger(__name__)


async def seed_cleanup_policies(db: AsyncSession) -> None:
    """Seed default cleanup policies into the database."""
    all_policies = DEFAULT_POLICIES + CLOUD_POLICIES
    
    for policy_data in all_policies:
        # Check if policy already exists
        result = await db.execute(
            select(CleanupPolicy).where(CleanupPolicy.name == policy_data["name"])
        )
        existing_policy = result.scalar_one_or_none()
        
        if existing_policy:
            logger.info(f"Policy '{policy_data['name']}' already exists, skipping")
            continue
        
        # Create new policy
        policy = CleanupPolicy(**policy_data)
        db.add(policy)
        logger.info(f"Created cleanup policy: {policy_data['name']}")
    
    await db.commit()
    logger.info("Cleanup policies seeding completed")


async def main():
    """Main function to run the seeding script."""
    async with get_db() as db:
        await seed_cleanup_policies(db)


if __name__ == "__main__":
    import sys
    import os
    
    # Add the parent directory to Python path
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Run the seeding
    asyncio.run(main())
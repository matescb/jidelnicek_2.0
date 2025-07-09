#!/usr/bin/env python3
"""
Script to manually seed categories and tags.

Usage:
    python scripts/seed_data.py
"""

import asyncio
import sys
from pathlib import Path

# Add project root to Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from jidelnicek.core.seed_data import check_and_seed, seed_all
from jidelnicek.core.database import async_session_maker
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def main():
    """Main function to run seeding."""
    logger.info("Starting manual seed process...")
    
    try:
        # Check if seeding is needed
        seeded = await check_and_seed()
        
        if seeded:
            logger.info("✅ Successfully seeded categories and tags!")
        else:
            logger.info("ℹ️  Data already exists, no seeding needed.")
            
            # Ask if user wants to force re-seed
            response = input("\nDo you want to force re-seed? This will add any missing items. (y/N): ")
            if response.lower() == 'y':
                async with async_session_maker() as session:
                    result = await seed_all(session)
                    logger.info(f"✅ Force seeded {len(result['categories'])} categories and {len(result['tags'])} tags!")
    
    except Exception as e:
        logger.error(f"❌ Error during seeding: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
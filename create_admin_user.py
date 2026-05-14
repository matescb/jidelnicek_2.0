#!/usr/bin/env python3
"""
Script to create an admin user for testing admin functionality.

Usage:
    python create_admin_user.py
"""

import asyncio
import os
import secrets
import sys
from pathlib import Path

# Add project root to Python path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from sqlalchemy import select, update
from jidelnicek.core.database import async_session_maker
from jidelnicek.auth.models import User
from jidelnicek.auth.utils.password import hash_password
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def create_admin_user():
    """Create an admin user for testing.

    Password sourcing:
      - If ADMIN_PASSWORD env var is set, that value is used (caller's responsibility).
      - Otherwise a random 16-byte password is generated and printed to stdout once.
    """

    admin_email = os.environ.get("ADMIN_EMAIL", "admin@jidelnicek.com")
    admin_password = os.environ.get("ADMIN_PASSWORD")
    password_was_generated = admin_password is None
    if password_was_generated:
        admin_password = secrets.token_urlsafe(16)

    try:
        async with async_session_maker() as session:
            # Check if admin user already exists
            stmt = select(User).where(User.email == admin_email)
            result = await session.execute(stmt)
            existing_user = result.scalar_one_or_none()
            
            if existing_user:
                # Update existing user to admin role
                stmt = update(User).where(User.email == admin_email).values(role='admin')
                await session.execute(stmt)
                await session.commit()
                logger.info(f"✅ Updated existing user {admin_email} to admin role")
            else:
                # Create new admin user
                hashed_password = hash_password(admin_password)
                
                admin_user = User(
                    email=admin_email,
                    hashed_password=hashed_password,
                    full_name="Admin User",
                    is_active=True,
                    is_verified=True,
                    role='admin'
                )
                
                session.add(admin_user)
                await session.commit()
                logger.info(f"✅ Created new admin user: {admin_email}")
            
            logger.info("Admin email: %s", admin_email)
            if password_was_generated:
                # Print to stdout (not logger) so it isn't captured by structured log
                # aggregators; the operator must record this value now, it is not
                # recoverable later.
                print(
                    "\nGenerated admin password (record this once; it will not "
                    "be displayed again):"
                )
                print(f"  {admin_password}\n", flush=True)
            else:
                logger.info("Admin password set from $ADMIN_PASSWORD env var.")
            logger.info("Access admin at: http://localhost:3000/admin")
            
    except Exception:
        logger.exception("Error creating admin user")
        return False

    return True


async def main():
    """Main function."""
    logger.info("Creating admin user...")
    success = await create_admin_user()
    
    if success:
        logger.info("✅ Admin user setup complete!")
    else:
        logger.error("❌ Failed to create admin user")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
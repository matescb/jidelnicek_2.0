"""
CLI command to initialize RBAC system and create initial super admin user.

Usage:
    python -m jidelnicek.admin.cli.rbac_init
"""

import asyncio
import sys
from getpass import getpass
from typing import Optional

import click
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from jidelnicek.core.database import AsyncSessionLocal
from jidelnicek.auth.models import AuthUser
from jidelnicek.auth.utils.password import hash_password
from jidelnicek.admin.services.rbac_service import RBACService
from jidelnicek.admin.models.rbac import Role


async def initialize_rbac_system(email: str, password: str) -> None:
    """Initialize RBAC system and create super admin user."""
    async with AsyncSessionLocal() as session:
        # Initialize RBAC service
        rbac_service = RBACService(session, None)
        
        # Initialize system roles and permissions
        click.echo("Initializing RBAC system...")
        await rbac_service.initialize_system_roles_and_permissions()
        click.echo("✓ System roles and permissions created")
        
        # Check if user exists
        result = await session.execute(
            select(AuthUser).where(AuthUser.email == email.lower())
        )
        user = result.scalar_one_or_none()
        
        if not user:
            # Create new super admin user
            click.echo(f"Creating super admin user: {email}")
            user = AuthUser(
                email=email.lower(),
                password_hash=hash_password(password),
                email_verified=True,
                is_active=True,
                role="admin"  # Legacy role field
            )
            session.add(user)
            await session.commit()
            await session.refresh(user)
            click.echo("✓ Super admin user created")
        else:
            click.echo(f"User {email} already exists")
            # Update password if provided
            if password:
                user.password_hash = hash_password(password)
                user.is_active = True
                user.email_verified = True
                await session.commit()
                click.echo("✓ User password updated")
        
        # Get super admin role
        result = await session.execute(
            select(Role).where(Role.code == "super_admin")
        )
        super_admin_role = result.scalar_one()
        
        # Check if user already has super admin role
        user_roles = await rbac_service.get_user_roles(user.id)
        if any(r.code == "super_admin" for r in user_roles):
            click.echo("✓ User already has super admin role")
        else:
            # Assign super admin role
            await rbac_service.assign_role(
                user_id=user.id,
                role_id=super_admin_role.id,
                assigned_by=user.id,  # Self-assignment for initial setup
                reason="Initial RBAC system setup"
            )
            click.echo("✓ Super admin role assigned to user")
        
        await session.commit()
        
        # Display summary
        click.echo("\n" + "="*50)
        click.echo("RBAC System Initialization Complete!")
        click.echo("="*50)
        click.echo(f"\nSuper Admin User:")
        click.echo(f"  Email: {user.email}")
        click.echo(f"  ID: {user.id}")
        click.echo(f"\nSystem Roles Created:")
        
        roles = await rbac_service.list_roles(is_active=True)
        for role in sorted(roles, key=lambda r: -r.priority):
            click.echo(f"  - {role.name} ({role.code}) - Priority: {role.priority}")
        
        click.echo(f"\nTotal Permissions: {len(rbac_service.SYSTEM_PERMISSIONS)}")
        click.echo("\nYou can now login with the super admin credentials.")


@click.command()
@click.option(
    '--email',
    prompt='Super admin email',
    help='Email address for the super admin user'
)
@click.option(
    '--password',
    prompt=True,
    hide_input=True,
    confirmation_prompt=True,
    help='Password for the super admin user'
)
def main(email: str, password: str) -> None:
    """Initialize RBAC system and create super admin user."""
    try:
        asyncio.run(initialize_rbac_system(email, password))
    except KeyboardInterrupt:
        click.echo("\nOperation cancelled.")
        sys.exit(1)
    except Exception as e:
        click.echo(f"\nError: {e}", err=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
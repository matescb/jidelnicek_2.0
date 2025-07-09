"""Add RBAC system tables

Revision ID: 0913b7f11427
Revises: 90aef19e3f7d
Create Date: 2025-07-10 00:32:02.370121

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "0913b7f11427"
down_revision = "90aef19e3f7d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Apply migration."""
    # Create permissions table
    op.create_table(
        'admin_permissions',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('code', sa.String(100), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.String(500), nullable=True),
        sa.Column('category', sa.String(50), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code'),
        sa.CheckConstraint(
            "category IN ('users', 'roles', 'content', 'recipes', 'ingredients', 'moderation', 'analytics', 'system', 'audit', 'settings')",
            name='check_permission_category'
        )
    )
    op.create_index('idx_admin_permissions_code', 'admin_permissions', ['code'])
    op.create_index('idx_admin_permissions_category', 'admin_permissions', ['category'])
    
    # Create roles table
    op.create_table(
        'admin_roles',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('code', sa.String(50), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.String(500), nullable=True),
        sa.Column('parent_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('priority', sa.Integer(), nullable=False, default=0),
        sa.Column('is_system', sa.Boolean(), nullable=False, default=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.Column('max_users', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['parent_id'], ['admin_roles.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['created_by'], ['auth_users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code')
    )
    op.create_index('idx_admin_roles_code', 'admin_roles', ['code'])
    
    # Create role_permissions association table
    op.create_table(
        'admin_role_permissions',
        sa.Column('role_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('permission_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.ForeignKeyConstraint(['role_id'], ['admin_roles.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['permission_id'], ['admin_permissions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('role_id', 'permission_id')
    )
    op.create_index('idx_role_permissions_role_id', 'admin_role_permissions', ['role_id'])
    op.create_index('idx_role_permissions_permission_id', 'admin_role_permissions', ['permission_id'])
    
    # Create user_roles association table
    op.create_table(
        'admin_user_roles',
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('role_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('assigned_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('assigned_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['auth_users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['role_id'], ['admin_roles.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['assigned_by'], ['auth_users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('user_id', 'role_id')
    )
    op.create_index('idx_user_roles_user_id', 'admin_user_roles', ['user_id'])
    op.create_index('idx_user_roles_role_id', 'admin_user_roles', ['role_id'])
    op.create_index('idx_user_roles_expires_at', 'admin_user_roles', ['expires_at'])
    
    # Create user role assignments table (detailed tracking)
    op.create_table(
        'admin_user_role_assignments',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('role_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('assigned_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('assigned_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('reason', sa.String(500), nullable=True),
        sa.Column('revoked_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('revoke_reason', sa.String(500), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.ForeignKeyConstraint(['user_id'], ['auth_users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['role_id'], ['admin_roles.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['assigned_by'], ['auth_users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['revoked_by'], ['auth_users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint(
            'user_id', 'role_id',
            name='uq_user_role_assignment',
            postgresql_where=sa.text('is_active = true AND revoked_at IS NULL')
        )
    )
    op.create_index('idx_user_role_assignments_user_id', 'admin_user_role_assignments', ['user_id'])
    op.create_index('idx_user_role_assignments_role_id', 'admin_user_role_assignments', ['role_id'])
    op.create_index('idx_user_role_assignments_is_active', 'admin_user_role_assignments', ['is_active'])
    op.create_index(
        'idx_user_role_assignments_valid',
        'admin_user_role_assignments',
        ['user_id', 'role_id'],
        postgresql_where=sa.text('is_active = true AND revoked_at IS NULL')
    )
    
    # Create permission delegations table
    op.create_table(
        'admin_permission_delegations',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('delegator_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('delegate_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('permissions', postgresql.JSON(), nullable=False),
        sa.Column('starts_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('reason', sa.String(500), nullable=False),
        sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('revoke_reason', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.ForeignKeyConstraint(['delegator_id'], ['auth_users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['delegate_id'], ['auth_users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint('delegator_id != delegate_id', name='check_different_users'),
        sa.CheckConstraint('expires_at > starts_at', name='check_valid_period')
    )
    op.create_index('idx_permission_delegations_delegator_id', 'admin_permission_delegations', ['delegator_id'])
    op.create_index('idx_permission_delegations_delegate_id', 'admin_permission_delegations', ['delegate_id'])
    op.create_index('idx_permission_delegations_expires_at', 'admin_permission_delegations', ['expires_at'])


def downgrade() -> None:
    """Revert migration."""
    # Drop tables in reverse order
    op.drop_table('admin_permission_delegations')
    op.drop_table('admin_user_role_assignments')
    op.drop_table('admin_user_roles')
    op.drop_table('admin_role_permissions')
    op.drop_table('admin_roles')
    op.drop_table('admin_permissions')

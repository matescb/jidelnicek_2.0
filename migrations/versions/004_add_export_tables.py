"""Add export-related tables.

Revision ID: 004_add_export_tables
Revises: 003_add_monitoring_tables
Create Date: 2025-01-09 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '004_add_export_tables'
down_revision = '003_add_monitoring_tables'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create export-related tables."""
    
    # Create export type enum
    export_type_enum = postgresql.ENUM(
        'trip', 'recipe', 'shopping_list',
        name='exporttype',
        create_type=True
    )
    export_type_enum.create(op.get_bind(), checkfirst=True)
    
    # Create export format enum
    export_format_enum = postgresql.ENUM(
        'pdf', 'excel', 'csv', 'json', 'html', 'text', 'markdown',
        name='exportformat',
        create_type=True
    )
    export_format_enum.create(op.get_bind(), checkfirst=True)
    
    # Create export status enum
    export_status_enum = postgresql.ENUM(
        'pending', 'processing', 'completed', 'failed', 'cancelled',
        name='exportstatus',
        create_type=True
    )
    export_status_enum.create(op.get_bind(), checkfirst=True)
    
    # Create export_jobs table
    op.create_table(
        'export_jobs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('export_type', sa.Enum('trip', 'recipe', 'shopping_list', name='exporttype'), nullable=False),
        sa.Column('export_format', sa.Enum('pdf', 'excel', 'csv', 'json', 'html', 'text', 'markdown', name='exportformat'), nullable=False),
        sa.Column('item_ids', sa.JSON(), nullable=False),
        sa.Column('options', sa.JSON(), nullable=False, server_default='{}'),
        sa.Column('status', sa.Enum('pending', 'processing', 'completed', 'failed', 'cancelled', name='exportstatus'), nullable=False, server_default='pending'),
        sa.Column('progress', sa.Float(), server_default='0.0'),
        sa.Column('total_items', sa.Integer()),
        sa.Column('processed_items', sa.Integer(), server_default='0'),
        sa.Column('batch_id', postgresql.UUID(as_uuid=True)),
        sa.Column('file_path', sa.String(500)),
        sa.Column('file_size', sa.BigInteger()),
        sa.Column('mime_type', sa.String(100)),
        sa.Column('error_message', sa.Text()),
        sa.Column('retry_count', sa.Integer(), server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime()),
        sa.Column('completed_at', sa.DateTime()),
        sa.Column('expires_at', sa.DateTime()),
        sa.Column('download_count', sa.Integer(), server_default='0'),
        sa.Column('last_downloaded_at', sa.DateTime()),
    )
    
    # Create indexes for export_jobs
    op.create_index('idx_export_jobs_user_status', 'export_jobs', ['user_id', 'status'])
    op.create_index('idx_export_jobs_batch', 'export_jobs', ['batch_id'])
    op.create_index('idx_export_jobs_created', 'export_jobs', ['created_at'])
    
    # Create export_presets table
    op.create_table(
        'export_presets',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE')),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('description', sa.Text()),
        sa.Column('export_type', sa.Enum('trip', 'recipe', 'shopping_list', name='exporttype'), nullable=False),
        sa.Column('export_format', sa.Enum('pdf', 'excel', 'csv', 'json', 'html', 'text', 'markdown', name='exportformat'), nullable=False),
        sa.Column('options', sa.JSON(), nullable=False, server_default='{}'),
        sa.Column('is_public', sa.Boolean(), server_default='false'),
        sa.Column('is_system', sa.Boolean(), server_default='false'),
        sa.Column('usage_count', sa.Integer(), server_default='0'),
        sa.Column('last_used_at', sa.DateTime()),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime()),
    )
    
    # Create indexes for export_presets
    op.create_index('idx_export_presets_user', 'export_presets', ['user_id'])
    op.create_index('idx_export_presets_public', 'export_presets', ['is_public'])
    
    # Create export_quotas table
    op.create_table(
        'export_quotas',
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('exports_today', sa.Integer(), server_default='0'),
        sa.Column('daily_limit', sa.Integer(), server_default='100'),
        sa.Column('daily_reset_at', sa.DateTime()),
        sa.Column('exports_this_month', sa.Integer(), server_default='0'),
        sa.Column('monthly_limit', sa.Integer(), server_default='1000'),
        sa.Column('monthly_reset_at', sa.DateTime()),
        sa.Column('total_size_bytes', sa.BigInteger(), server_default='0'),
        sa.Column('size_limit_bytes', sa.BigInteger(), server_default='1073741824'),  # 1GB
        sa.Column('format_limits', sa.JSON(), server_default='{}'),
        sa.Column('format_usage', sa.JSON(), server_default='{}'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime()),
    )
    
    # Create export_statistics table
    op.create_table(
        'export_statistics',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE')),
        sa.Column('date', sa.DateTime(), nullable=False),
        sa.Column('total_exports', sa.Integer(), server_default='0'),
        sa.Column('successful_exports', sa.Integer(), server_default='0'),
        sa.Column('failed_exports', sa.Integer(), server_default='0'),
        sa.Column('exports_by_type', sa.JSON(), server_default='{}'),
        sa.Column('exports_by_format', sa.JSON(), server_default='{}'),
        sa.Column('total_duration_ms', sa.BigInteger(), server_default='0'),
        sa.Column('average_duration_ms', sa.Float()),
        sa.Column('min_duration_ms', sa.Integer()),
        sa.Column('max_duration_ms', sa.Integer()),
        sa.Column('total_size_bytes', sa.BigInteger(), server_default='0'),
        sa.Column('average_size_bytes', sa.Float()),
        sa.Column('error_types', sa.JSON(), server_default='{}'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime()),
    )
    
    # Create indexes for export_statistics
    op.create_index('idx_export_stats_date', 'export_statistics', ['date'])
    op.create_index('idx_export_stats_user_date', 'export_statistics', ['user_id', 'date'])
    
    # Add system presets
    op.execute("""
        INSERT INTO export_presets (id, name, description, export_type, export_format, options, is_system, is_public)
        VALUES 
        (gen_random_uuid(), 'Výlet PDF - Kompletní', 'Kompletní export výletu včetně receptů a nákupního seznamu', 
         'trip', 'pdf', '{"include_recipes": true, "include_shopping": true, "include_nutrition": true, "page_size": "A4"}', true, true),
        
        (gen_random_uuid(), 'Výlet Excel - Plánování', 'Excel export pro plánování výletu s formulemi', 
         'trip', 'excel', '{"include_formulas": true, "include_charts": true, "separate_sheets": true}', true, true),
        
        (gen_random_uuid(), 'Recepty PDF - Kuchařka', 'Export receptů ve formátu kuchařky', 
         'recipe', 'pdf', '{"include_photos": true, "include_nutrition": true, "page_size": "A4", "orientation": "portrait"}', true, true),
        
        (gen_random_uuid(), 'Nákupní seznam - Tisk', 'Jednoduchý nákupní seznam pro tisk', 
         'shopping_list', 'pdf', '{"compact": true, "include_categories": true, "page_size": "A4"}', true, true);
    """)


def downgrade() -> None:
    """Drop export-related tables."""
    op.drop_table('export_statistics')
    op.drop_table('export_quotas')
    op.drop_table('export_presets')
    op.drop_table('export_jobs')
    
    # Drop enums
    sa.Enum(name='exportstatus').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='exportformat').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='exporttype').drop(op.get_bind(), checkfirst=True)
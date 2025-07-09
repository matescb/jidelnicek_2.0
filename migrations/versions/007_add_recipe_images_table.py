"""Add recipe images table

Revision ID: c9a7b8e0f1d2
Revises: 624c83f973a5
Create Date: 2025-07-09 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'c9a7b8e0f1d2'
down_revision = '624c83f973a5'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('recipe_images',
    sa.Column('id', sa.dialects.postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('recipe_id', sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('image_url', sa.String(length=500), nullable=False, comment='URL to full-size image'),
    sa.Column('thumbnail_url', sa.String(length=500), nullable=True, comment='URL to thumbnail image'),
    sa.Column('alt_text', sa.String(length=200), nullable=True, comment='Alternative text for accessibility'),
    sa.Column('display_order', sa.Integer(), server_default='0', nullable=False, comment='Order of display (0 = first)'),
    sa.Column('is_primary', sa.Boolean(), server_default=sa.text('false'), nullable=False, comment='Whether this is the primary/featured image'),
    sa.Column('file_size_bytes', sa.Integer(), nullable=True, comment='Original file size in bytes'),
    sa.Column('width', sa.Integer(), nullable=True, comment='Image width in pixels'),
    sa.Column('height', sa.Integer(), nullable=True, comment='Image height in pixels'),
    sa.Column('mime_type', sa.String(length=50), nullable=True, comment='MIME type (e.g., image/jpeg)'),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['recipe_id'], ['recipe_recipes.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('recipe_id', 'display_order', name='uq_recipe_images_recipe_id_display_order'),
    sa.CheckConstraint('file_size_bytes <= 5242880', name='recipe_images_file_size_check')
    )
    op.create_index('idx_recipe_primary_image', 'recipe_images', ['recipe_id', 'is_primary'], unique=True, postgresql_where=sa.text('is_primary = true'))
    op.create_index(op.f('ix_recipe_images_recipe_id'), 'recipe_images', ['recipe_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_recipe_images_recipe_id'), table_name='recipe_images')
    op.drop_index('idx_recipe_primary_image', table_name='recipe_images')
    op.drop_table('recipe_images')

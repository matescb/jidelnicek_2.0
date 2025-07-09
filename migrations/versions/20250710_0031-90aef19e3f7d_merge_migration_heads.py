"""Merge migration heads

Revision ID: 90aef19e3f7d
Revises: 003, 010_add_trip_description_status_fields
Create Date: 2025-07-10 00:31:57.640126

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "90aef19e3f7d"
down_revision = ("003", "010_add_trip_description_status_fields")
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Apply migration."""
    pass


def downgrade() -> None:
    """Revert migration."""
    pass

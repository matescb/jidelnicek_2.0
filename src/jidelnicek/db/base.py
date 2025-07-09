"""Database base configuration for Jídelníček 2.0."""
from jidelnicek.core.database import Base

# Import all models here to ensure they are registered with Base
# This is important for Alembic to detect all tables
from jidelnicek.auth.models import *  # noqa: F401, F403
# from jidelnicek.common.models import *  # noqa: F401, F403  # Commented out to avoid Ingredient conflict
from jidelnicek.recipe.models import *  # noqa: F401, F403
from jidelnicek.trip.models import *  # noqa: F401, F403
from jidelnicek.core.models.job import Job, JobNotification  # noqa: F401
# from jidelnicek.sharing.models import *  # noqa: F401, F403 - not yet implemented
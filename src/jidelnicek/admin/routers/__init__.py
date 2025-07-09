"""Admin routers package."""

from jidelnicek.admin.routers.users import router as users_router
from jidelnicek.admin.routers.dashboard import router as dashboard_router
from jidelnicek.admin.routers.ingredients import router as ingredients_router
from jidelnicek.admin.routers.audit import router as audit_router
from jidelnicek.admin.routers.roles import router as roles_router

__all__ = ["users_router", "dashboard_router", "ingredients_router", "audit_router", "roles_router"]
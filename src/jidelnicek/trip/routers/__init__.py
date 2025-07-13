"""Trip router module."""

from .trips import router as trips_router
from .qr_codes import router as qr_codes_router
from .invitations import router as invitations_router
from .meals import router as meals_router
from .templates import router as templates_router
from .export import router as export_router

__all__ = ["trips_router", "qr_codes_router", "invitations_router", "meals_router", "templates_router", "export_router"]
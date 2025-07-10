"""Trip router module."""

from .trips import router as trips_router
from .qr_codes import router as qr_codes_router
from .invitations import router as invitations_router

__all__ = ["trips_router", "qr_codes_router", "invitations_router"]
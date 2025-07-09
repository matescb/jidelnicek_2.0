"""
Trip module exceptions.

This module defines custom exceptions for trip-related operations.
"""

from typing import Optional
from uuid import UUID


class TripException(Exception):
    """Base exception for trip operations."""
    pass


class TripNotFoundError(TripException):
    """Raised when a trip is not found."""
    
    def __init__(self, trip_id: Optional[UUID] = None, message: Optional[str] = None):
        if message is None:
            if trip_id:
                message = f"Trip with ID {trip_id} not found"
            else:
                message = "Trip not found"
        super().__init__(message)
        self.trip_id = trip_id


class TripPermissionError(TripException):
    """Raised when user doesn't have permission to access/modify a trip."""
    
    def __init__(self, message: str = "You don't have permission to access this trip"):
        super().__init__(message)


class TripValidationError(TripException):
    """Raised when trip data validation fails."""
    pass


class TripParticipantLimitError(TripValidationError):
    """Raised when trying to add more than 20 participants to a trip."""
    
    def __init__(self, message: str = "Maximum 20 participants allowed per trip"):
        super().__init__(message)


class TripDateRangeError(TripValidationError):
    """Raised when trip date range is invalid."""
    
    def __init__(self, message: str = "Invalid trip date range"):
        super().__init__(message)


class TripShareLinkExpiredError(TripException):
    """Raised when trying to access a trip with an expired share link."""
    
    def __init__(self, message: str = "Share link has expired"):
        super().__init__(message)


class TripArchiveError(TripException):
    """Raised when there's an error archiving/unarchiving a trip."""
    pass
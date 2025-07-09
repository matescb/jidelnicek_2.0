"""Core utilities package."""

# Import from utils.py module
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from ..utils import get_utc_now

__all__ = ["get_utc_now"]
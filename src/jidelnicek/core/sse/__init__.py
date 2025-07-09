"""
Server-Sent Events (SSE) support for real-time communication.

This module provides SSE functionality as a fallback for clients
that don't support WebSockets.
"""

from .handlers import sse_endpoint

__all__ = ["sse_endpoint"]
"""
Database type utilities for PostgreSQL.

This module provides PostgreSQL-specific column types.
All databases in this project use PostgreSQL.
"""

from sqlalchemy import String
from sqlalchemy.dialects.postgresql import JSONB, ARRAY
from sqlalchemy.sql.type_api import TypeEngine


def get_json_column_type() -> TypeEngine:
    """
    Return PostgreSQL JSONB column type.
    
    Returns:
        TypeEngine: JSONB for PostgreSQL
    """
    return JSONB()


def get_string_array_column_type() -> TypeEngine:
    """
    Return PostgreSQL string array column type.
    
    Returns:
        TypeEngine: ARRAY(String) for PostgreSQL
    """
    return ARRAY(String)
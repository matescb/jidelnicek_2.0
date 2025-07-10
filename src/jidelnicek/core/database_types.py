"""
Database type utilities for cross-database compatibility.

This module provides utilities for handling database-specific column types
across different database backends (PostgreSQL, SQLite, etc.).
"""

from sqlalchemy import JSON, String, Text
from sqlalchemy.dialects.postgresql import JSONB, ARRAY
from sqlalchemy.sql.type_api import TypeEngine, UserDefinedType


class CompatibleJSON(UserDefinedType):
    """
    A JSON column type that works across different database backends.
    
    Uses JSONB for PostgreSQL (better performance) and JSON for other databases.
    """
    
    def get_col_spec(self, **kwargs):
        return "JSON"
    
    def load_dialect_impl(self, dialect):
        """Load appropriate JSON type based on database dialect."""
        if dialect.name == 'postgresql':
            return dialect.type_descriptor(JSONB())
        else:
            return dialect.type_descriptor(JSON())
    
    def compare_values(self, x, y):
        """Compare JSON values."""
        return x == y


class CompatibleStringArray(UserDefinedType):
    """
    A string array column type that works across different database backends.
    
    Uses ARRAY(String) for PostgreSQL and TEXT for other databases (storing as comma-separated).
    """
    
    def get_col_spec(self, **kwargs):
        return "TEXT"
    
    def load_dialect_impl(self, dialect):
        """Load appropriate array type based on database dialect."""
        if dialect.name == 'postgresql':
            return dialect.type_descriptor(ARRAY(String))
        else:
            # Store as TEXT for SQLite, will need application-level parsing
            return dialect.type_descriptor(Text())
    
    def compare_values(self, x, y):
        """Compare array values."""
        return x == y


def get_json_column_type() -> TypeEngine:
    """
    Return appropriate JSON column type based on database dialect.
    
    Returns:
        TypeEngine: JSONB for PostgreSQL, JSON for other databases
    """
    return CompatibleJSON()


def get_string_array_column_type() -> TypeEngine:
    """
    Return appropriate string array column type based on database dialect.
    
    Returns:
        TypeEngine: ARRAY(String) for PostgreSQL, TEXT for other databases
    """
    return CompatibleStringArray()
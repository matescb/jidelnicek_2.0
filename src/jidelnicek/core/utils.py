"""
Core utility functions for Jidelnicek 2.0.
"""

import re
from datetime import datetime, timezone


def get_utc_now() -> datetime:
    """
    Get the current UTC timestamp with timezone awareness.
    
    Returns:
        datetime: Current UTC timestamp with timezone info
    """
    return datetime.now(timezone.utc)


def slugify(text: str) -> str:
    """
    Convert text to URL-friendly slug.
    
    Args:
        text: The text to convert to a slug
        
    Returns:
        str: URL-friendly slug
        
    Examples:
        >>> slugify("Hello World!")
        'hello-world'
        >>> slugify("Easy (< 30 min)")
        'easy-30-min'
    """
    # Convert to lowercase
    text = text.lower()
    
    # Replace parentheses and special characters with spaces
    text = re.sub(r'[(){}[\]<>]', ' ', text)
    
    # Replace any non-word characters (except hyphens) with spaces
    text = re.sub(r'[^\w\s-]', '', text)
    
    # Replace multiple spaces or hyphens with a single hyphen
    text = re.sub(r'[-\s]+', '-', text)
    
    # Remove leading/trailing hyphens
    text = text.strip('-')
    
    return text
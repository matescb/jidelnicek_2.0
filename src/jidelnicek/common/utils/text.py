"""
Text processing utilities.

This module provides utilities for text processing, including
sanitization, validation, and formatting.
"""

import re
import html
from typing import Optional


def sanitize_text(text: Optional[str], max_length: Optional[int] = None) -> Optional[str]:
    """
    Sanitize user input text.
    
    Args:
        text: Input text to sanitize
        max_length: Maximum allowed length
        
    Returns:
        Sanitized text or None if input was None
    """
    if text is None:
        return None
    
    # Remove leading/trailing whitespace
    text = text.strip()
    
    # Escape HTML entities
    text = html.escape(text)
    
    # Remove control characters (except newlines and tabs)
    text = re.sub(r'[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]', '', text)
    
    # Normalize whitespace (multiple spaces to single)
    text = re.sub(r'\s+', ' ', text)
    
    # Truncate if needed
    if max_length and len(text) > max_length:
        text = text[:max_length-3] + '...'
    
    return text


def strip_html(text: str) -> str:
    """
    Remove HTML tags from text.
    
    Args:
        text: Input text with potential HTML
        
    Returns:
        Text with HTML tags removed
    """
    # Remove HTML tags
    clean = re.compile('<.*?>')
    return re.sub(clean, '', text)


def is_safe_filename(filename: str) -> bool:
    """
    Check if a filename is safe to use.
    
    Args:
        filename: Filename to check
        
    Returns:
        True if filename is safe
    """
    # Allow only alphanumeric, dash, underscore, and dot
    pattern = re.compile(r'^[\w\-\.]+$')
    return bool(pattern.match(filename))


def truncate_text(text: str, max_length: int, suffix: str = '...') -> str:
    """
    Truncate text to a maximum length.
    
    Args:
        text: Text to truncate
        max_length: Maximum length
        suffix: Suffix to add if truncated
        
    Returns:
        Truncated text
    """
    if len(text) <= max_length:
        return text
    
    return text[:max_length - len(suffix)] + suffix
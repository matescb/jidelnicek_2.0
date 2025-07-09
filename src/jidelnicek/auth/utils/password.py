"""
Password utilities for Jidelnicek 2.0 authentication system.

This module provides secure password hashing and validation functions
using bcrypt with a cost factor of 12 as specified in the PRD.
"""

import bcrypt
import re
from typing import List, Tuple
import os


# Common passwords list (top 100 most common)
COMMON_PASSWORDS = {
    "password", "123456", "password123", "12345678", "qwerty", "abc123",
    "monkey", "1234567", "letmein", "trustno1", "dragon", "baseball",
    "111111", "iloveyou", "master", "sunshine", "ashley", "bailey",
    "passw0rd", "shadow", "123123", "654321", "superman", "qazwsx",
    "michael", "football", "password1", "password12", "password123",
    "welcome", "welcome123", "admin", "admin123", "root", "toor",
    "pass", "pass123", "pass1234", "password1234", "qwertyuiop",
    "1234567890", "123456789", "abcd1234", "1qaz2wsx", "qwerty123",
    "qwerty1234", "1q2w3e4r", "1q2w3e", "q1w2e3r4", "123qwe",
    "zxcvbnm", "zxcvbn", "asdfghjkl", "asdfgh", "qazwsxedc",
    "password!", "password@", "password#", "p@ssw0rd", "p@ssword",
    "passw0rd!", "hello123", "welcome1", "welcome12", "root123",
    "admin1234", "administrator", "guest", "guest123", "user",
    "user123", "test", "test123", "demo", "demo123", "oracle",
    "oracle123", "changeme", "changeme123", "default", "default123",
    "secret", "secret123", "12345", "123456789012", "1234567890123",
    "qwerty12345", "password12345", "12345qwerty", "qwerty123456",
    "password123456", "123456password", "abc12345", "abcd12345",
    "abcde12345", "abcdef123456", "password2023", "password2024"
}


class PasswordValidator:
    """Password validation with comprehensive security checks."""
    
    @staticmethod
    def validate_strength(password: str, email: str = None) -> Tuple[bool, List[str]]:
        """
        Validate password strength according to PRD requirements.
        
        Args:
            password: The password to validate
            email: User's email for checking if password contains email parts
            
        Returns:
            Tuple of (is_valid, list_of_errors)
        """
        errors = []
        
        # Length check
        if len(password) < 12:
            errors.append("Password must be at least 12 characters long")
        elif len(password) > 128:
            errors.append("Password must not exceed 128 characters")
        
        # Character type checks
        if not re.search(r'[A-Z]', password):
            errors.append("Password must contain at least one uppercase letter")
        if not re.search(r'[a-z]', password):
            errors.append("Password must contain at least one lowercase letter")
        if not re.search(r'[0-9]', password):
            errors.append("Password must contain at least one number")
        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
            errors.append("Password must contain at least one special character")
        
        # Sequential patterns check
        sequential_patterns = [
            'abc', 'bcd', 'cde', 'def', 'efg', 'fgh', 'ghi', 'hij', 'ijk',
            'jkl', 'klm', 'lmn', 'mno', 'nop', 'opq', 'pqr', 'qrs', 'rst',
            'stu', 'tuv', 'uvw', 'vwx', 'wxy', 'xyz', '012', '123', '234',
            '345', '456', '567', '678', '789', '890'
        ]
        
        password_lower = password.lower()
        for pattern in sequential_patterns:
            if pattern in password_lower:
                errors.append(f"Password cannot contain sequential patterns like '{pattern}'")
                break
        
        # Repeated characters check
        if re.search(r'(.)\1{2,}', password):
            errors.append("Password cannot contain more than 2 repeated characters in a row")
        
        # Common password check
        if password.lower() in COMMON_PASSWORDS:
            errors.append("Password is too common. Please choose a more unique password")
        
        # Email check
        if email:
            email_parts = email.lower().split('@')
            password_lower = password.lower()
            
            for part in email_parts:
                if len(part) > 3 and part in password_lower:
                    errors.append("Password cannot contain parts of your email address")
                    break
        
        return len(errors) == 0, errors
    
    @staticmethod
    def calculate_strength_score(password: str) -> int:
        """
        Calculate password strength score (0-100).
        
        Args:
            password: The password to score
            
        Returns:
            Score from 0 (weakest) to 100 (strongest)
        """
        score = 0
        
        # Base score for length
        length = len(password)
        if length >= 12:
            score += 20
        if length >= 16:
            score += 10
        if length >= 20:
            score += 10
        
        # Character diversity
        if re.search(r'[a-z]', password):
            score += 10
        if re.search(r'[A-Z]', password):
            score += 10
        if re.search(r'[0-9]', password):
            score += 10
        if re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
            score += 15
        
        # Additional special characters
        special_count = len(re.findall(r'[!@#$%^&*(),.?":{}|<>]', password))
        if special_count > 2:
            score += 5
        
        # No common patterns
        if password.lower() not in COMMON_PASSWORDS:
            score += 10
        
        # Character variety bonus
        unique_chars = len(set(password))
        if unique_chars >= 10:
            score += 5
        if unique_chars >= 15:
            score += 5
        
        return min(score, 100)


class PasswordHasher:
    """Secure password hashing using bcrypt."""
    
    # Cost factor for bcrypt (12 as specified in PRD)
    BCRYPT_COST_FACTOR = 12
    
    @classmethod
    def hash_password(cls, password: str) -> str:
        """
        Hash a password using bcrypt with cost factor 12.
        
        Args:
            password: Plain text password to hash
            
        Returns:
            Hashed password string
        """
        # Generate salt with specified cost factor
        salt = bcrypt.gensalt(rounds=cls.BCRYPT_COST_FACTOR)
        
        # Hash the password
        hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
        
        return hashed.decode('utf-8')
    
    @staticmethod
    def verify_password(password: str, hashed_password: str) -> bool:
        """
        Verify a password against its hash.
        
        Args:
            password: Plain text password to verify
            hashed_password: Bcrypt hash to verify against
            
        Returns:
            True if password matches, False otherwise
        """
        try:
            return bcrypt.checkpw(
                password.encode('utf-8'),
                hashed_password.encode('utf-8')
            )
        except Exception:
            # Invalid hash format or other error
            return False
    
    @staticmethod
    def needs_rehash(hashed_password: str, target_cost: int = 12) -> bool:
        """
        Check if a password hash needs to be rehashed with a higher cost factor.
        
        Args:
            hashed_password: The existing bcrypt hash
            target_cost: The desired cost factor (default 12)
            
        Returns:
            True if rehashing is needed, False otherwise
        """
        try:
            # Extract the cost factor from the hash
            # Bcrypt format: $2b$<cost>$<salt><hash>
            parts = hashed_password.split('$')
            if len(parts) >= 4:
                current_cost = int(parts[2])
                return current_cost < target_cost
        except (ValueError, IndexError):
            pass
        
        return False


def generate_secure_token(length: int = 32) -> str:
    """
    Generate a cryptographically secure random token.
    
    Args:
        length: Length of the token (default 32)
        
    Returns:
        Secure random token as hex string
    """
    return os.urandom(length).hex()


def generate_numeric_code(length: int = 6) -> str:
    """
    Generate a numeric verification code.
    
    Args:
        length: Length of the code (default 6)
        
    Returns:
        Numeric code as string
    """
    return ''.join(str(ord(os.urandom(1)) % 10) for _ in range(length))
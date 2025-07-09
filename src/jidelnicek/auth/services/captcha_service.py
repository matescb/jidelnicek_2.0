"""
CAPTCHA service for enhanced security.

This module provides CAPTCHA integration to prevent automated attacks
and bot submissions. Currently implements a mock service that can be
replaced with real CAPTCHA providers like reCAPTCHA or hCaptcha.
"""

import secrets
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, Tuple
import logging
from abc import ABC, abstractmethod

from redis.asyncio import Redis

from jidelnicek.core.config import settings

logger = logging.getLogger(__name__)


class CaptchaProvider(ABC):
    """Abstract base class for CAPTCHA providers."""
    
    @abstractmethod
    async def generate_challenge(self) -> Dict[str, Any]:
        """Generate a new CAPTCHA challenge."""
        pass
    
    @abstractmethod
    async def verify_response(
        self,
        challenge_id: str,
        user_response: str,
        client_ip: Optional[str] = None
    ) -> bool:
        """Verify user's response to CAPTCHA challenge."""
        pass


class MockCaptchaProvider(CaptchaProvider):
    """
    Mock CAPTCHA provider for testing and development.
    
    In production, this should be replaced with a real provider
    like Google reCAPTCHA, hCaptcha, or similar.
    """
    
    def __init__(self, redis_client: Optional[Redis] = None):
        self.redis_client = redis_client
        self._challenges: Dict[str, str] = {}
    
    async def generate_challenge(self) -> Dict[str, Any]:
        """
        Generate a mock CAPTCHA challenge.
        
        Returns:
            Dictionary with challenge_id and challenge_data
        """
        # Generate simple math problem as mock CAPTCHA
        import random
        
        num1 = random.randint(1, 10)
        num2 = random.randint(1, 10)
        operation = random.choice(['+', '-', '*'])
        
        if operation == '+':
            answer = num1 + num2
            question = f"{num1} + {num2}"
        elif operation == '-':
            # Ensure positive result
            if num1 < num2:
                num1, num2 = num2, num1
            answer = num1 - num2
            question = f"{num1} - {num2}"
        else:  # multiplication
            answer = num1 * num2
            question = f"{num1} × {num2}"
        
        # Generate unique challenge ID
        challenge_id = secrets.token_urlsafe(16)
        
        # Store challenge in Redis or memory
        if self.redis_client:
            # Store in Redis with 5 minute expiry
            challenge_key = f"captcha:challenge:{challenge_id}"
            await self.redis_client.setex(
                challenge_key,
                300,  # 5 minutes
                str(answer)
            )
        else:
            # Store in memory (not recommended for production)
            self._challenges[challenge_id] = str(answer)
        
        logger.debug(f"Generated CAPTCHA challenge: {challenge_id}")
        
        return {
            "challenge_id": challenge_id,
            "challenge_type": "math",
            "question": f"What is {question}?",
            "expires_in": 300  # 5 minutes
        }
    
    async def verify_response(
        self,
        challenge_id: str,
        user_response: str,
        client_ip: Optional[str] = None
    ) -> bool:
        """
        Verify user's response to CAPTCHA challenge.
        
        Args:
            challenge_id: The challenge identifier
            user_response: User's answer to the challenge
            client_ip: Client IP address (for logging)
            
        Returns:
            True if response is correct, False otherwise
        """
        try:
            # Get expected answer
            expected_answer = None
            
            if self.redis_client:
                challenge_key = f"captcha:challenge:{challenge_id}"
                expected_answer = await self.redis_client.get(challenge_key)
                
                if expected_answer:
                    # Delete challenge after use (one-time use)
                    await self.redis_client.delete(challenge_key)
                    expected_answer = expected_answer.decode() if isinstance(expected_answer, bytes) else expected_answer
            else:
                expected_answer = self._challenges.pop(challenge_id, None)
            
            if not expected_answer:
                logger.warning(
                    f"CAPTCHA verification failed: Invalid or expired challenge "
                    f"{challenge_id} from IP: {client_ip}"
                )
                return False
            
            # Verify answer
            is_correct = user_response.strip() == expected_answer
            
            if is_correct:
                logger.info(
                    f"CAPTCHA verification successful for challenge {challenge_id} "
                    f"from IP: {client_ip}"
                )
            else:
                logger.warning(
                    f"CAPTCHA verification failed: Incorrect answer for challenge "
                    f"{challenge_id} from IP: {client_ip}"
                )
            
            return is_correct
            
        except Exception as e:
            logger.error(f"CAPTCHA verification error: {str(e)}")
            return False


class ReCaptchaProvider(CaptchaProvider):
    """
    Google reCAPTCHA provider (placeholder for future implementation).
    
    This would integrate with Google's reCAPTCHA service for production use.
    """
    
    def __init__(self, site_key: str, secret_key: str):
        self.site_key = site_key
        self.secret_key = secret_key
    
    async def generate_challenge(self) -> Dict[str, Any]:
        """Generate reCAPTCHA challenge data."""
        # In real implementation, this would return the site key
        # and any other data needed by the frontend
        return {
            "challenge_id": secrets.token_urlsafe(16),
            "challenge_type": "recaptcha",
            "site_key": self.site_key
        }
    
    async def verify_response(
        self,
        challenge_id: str,
        user_response: str,
        client_ip: Optional[str] = None
    ) -> bool:
        """Verify reCAPTCHA response with Google's API."""
        # In real implementation, this would:
        # 1. Make API call to Google's verification endpoint
        # 2. Check the response score (for reCAPTCHA v3)
        # 3. Return verification result
        raise NotImplementedError("reCAPTCHA provider not yet implemented")


class CaptchaService:
    """
    Main CAPTCHA service for the application.
    
    Provides a unified interface for CAPTCHA operations and can switch
    between different providers based on configuration.
    """
    
    def __init__(self, redis_client: Optional[Redis] = None):
        self.redis_client = redis_client
        self._provider = self._initialize_provider()
    
    def _initialize_provider(self) -> CaptchaProvider:
        """Initialize the appropriate CAPTCHA provider based on config."""
        # For now, always use mock provider
        # In production, this would check settings to determine provider
        return MockCaptchaProvider(self.redis_client)
    
    async def generate_challenge(self) -> Dict[str, Any]:
        """
        Generate a new CAPTCHA challenge.
        
        Returns:
            Dictionary with challenge data for the frontend
        """
        return await self._provider.generate_challenge()
    
    async def verify_response(
        self,
        challenge_id: str,
        user_response: str,
        client_ip: Optional[str] = None
    ) -> bool:
        """
        Verify user's CAPTCHA response.
        
        Args:
            challenge_id: The challenge identifier
            user_response: User's response to the challenge
            client_ip: Client IP address for logging
            
        Returns:
            True if CAPTCHA is solved correctly, False otherwise
        """
        return await self._provider.verify_response(
            challenge_id,
            user_response,
            client_ip
        )
    
    async def should_require_captcha(
        self,
        identifier: str,
        action: str = "login"
    ) -> bool:
        """
        Determine if CAPTCHA should be required for a given action.
        
        Args:
            identifier: User identifier (IP, email, etc.)
            action: The action being performed (login, register, etc.)
            
        Returns:
            True if CAPTCHA should be required, False otherwise
        """
        if not self.redis_client:
            return False
        
        try:
            # Check failed attempts for this action
            failed_key = f"captcha:failed:{action}:{identifier}"
            failed_count = await self.redis_client.get(failed_key)
            
            if failed_count:
                count = int(failed_count)
                # Require CAPTCHA after 3 failed attempts
                if count >= 3:
                    logger.info(
                        f"CAPTCHA required for {action} from {identifier} "
                        f"after {count} failed attempts"
                    )
                    return True
            
            # Check if IP is marked as suspicious
            suspicious_key = f"suspicious_ips:{identifier}"
            suspicious_count = await self.redis_client.get(suspicious_key)
            
            if suspicious_count and int(suspicious_count) >= 3:
                logger.info(
                    f"CAPTCHA required for {action} from suspicious IP {identifier}"
                )
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"Error checking CAPTCHA requirement: {str(e)}")
            return False
    
    async def record_failed_attempt(
        self,
        identifier: str,
        action: str = "login"
    ) -> None:
        """
        Record a failed attempt for CAPTCHA tracking.
        
        Args:
            identifier: User identifier (IP, email, etc.)
            action: The action that failed
        """
        if not self.redis_client:
            return
        
        try:
            failed_key = f"captcha:failed:{action}:{identifier}"
            
            # Increment failed attempts with 1 hour expiry
            await self.redis_client.incr(failed_key)
            await self.redis_client.expire(failed_key, 3600)
            
        except Exception as e:
            logger.error(f"Error recording failed attempt: {str(e)}")
    
    async def clear_failed_attempts(
        self,
        identifier: str,
        action: str = "login"
    ) -> None:
        """
        Clear failed attempts after successful action.
        
        Args:
            identifier: User identifier (IP, email, etc.)
            action: The action that succeeded
        """
        if not self.redis_client:
            return
        
        try:
            failed_key = f"captcha:failed:{action}:{identifier}"
            await self.redis_client.delete(failed_key)
            
        except Exception as e:
            logger.error(f"Error clearing failed attempts: {str(e)}")
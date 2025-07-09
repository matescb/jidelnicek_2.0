"""
User-Agent parsing utilities for session tracking.

This module provides utilities to parse User-Agent strings
and extract device, browser, and OS information.
"""

from typing import Dict, Optional
import re
from user_agents import parse


def parse_user_agent(user_agent_string: str) -> Dict[str, Optional[str]]:
    """
    Parse User-Agent string to extract device and browser info.
    
    Args:
        user_agent_string: Raw User-Agent header value
        
    Returns:
        Dict containing:
        - device_name: Human-readable device name
        - device_type: Type of device (desktop, mobile, tablet)
        - browser: Browser name and version
        - os: Operating system name and version
        - is_bot: Whether this is a bot/crawler
    """
    if not user_agent_string:
        return {
            "device_name": "Unknown Device",
            "device_type": "unknown",
            "browser": "Unknown",
            "os": "Unknown",
            "is_bot": False
        }
    
    try:
        # Parse using user-agents library
        user_agent = parse(user_agent_string)
        
        # Determine device type
        if user_agent.is_mobile:
            device_type = "mobile"
        elif user_agent.is_tablet:
            device_type = "tablet"
        elif user_agent.is_pc:
            device_type = "desktop"
        else:
            device_type = "other"
        
        # Build device name
        device_parts = []
        if user_agent.device.brand:
            device_parts.append(user_agent.device.brand)
        if user_agent.device.model:
            device_parts.append(user_agent.device.model)
        
        device_name = " ".join(device_parts) if device_parts else None
        
        # If no specific device, use generic description
        if not device_name:
            if device_type == "desktop":
                device_name = f"{user_agent.os.family} Computer"
            elif device_type == "mobile":
                device_name = "Mobile Device"
            elif device_type == "tablet":
                device_name = "Tablet"
            else:
                device_name = "Unknown Device"
        
        # Build browser string
        browser_parts = []
        if user_agent.browser.family:
            browser_parts.append(user_agent.browser.family)
        if user_agent.browser.version_string:
            # Only include major version
            version = user_agent.browser.version_string.split('.')[0]
            browser_parts.append(version)
        
        browser = " ".join(browser_parts) if browser_parts else "Unknown"
        
        # Build OS string
        os_parts = []
        if user_agent.os.family:
            os_parts.append(user_agent.os.family)
        if user_agent.os.version_string:
            # Simplify version for common OSes
            if user_agent.os.family == "Windows":
                # Map Windows versions
                version_map = {
                    "10": "10",
                    "11": "11",
                    "8.1": "8.1",
                    "8": "8",
                    "7": "7",
                    "Vista": "Vista",
                    "XP": "XP"
                }
                for key, value in version_map.items():
                    if key in user_agent.os.version_string:
                        os_parts.append(value)
                        break
            else:
                # For other OSes, use major version
                version = user_agent.os.version_string.split('.')[0]
                os_parts.append(version)
        
        os = " ".join(os_parts) if os_parts else "Unknown"
        
        return {
            "device_name": device_name,
            "device_type": device_type,
            "browser": browser,
            "os": os,
            "is_bot": user_agent.is_bot
        }
        
    except Exception:
        # Fallback to basic regex parsing if library fails
        return _fallback_parse(user_agent_string)


def _fallback_parse(user_agent_string: str) -> Dict[str, Optional[str]]:
    """
    Fallback parser using regex patterns.
    
    Args:
        user_agent_string: Raw User-Agent string
        
    Returns:
        Basic parsed information
    """
    result = {
        "device_name": "Unknown Device",
        "device_type": "unknown",
        "browser": "Unknown",
        "os": "Unknown",
        "is_bot": False
    }
    
    # Check for bots
    bot_patterns = [
        r'bot', r'crawler', r'spider', r'scraper', r'curl', r'wget',
        r'python-requests', r'postman', r'insomnia'
    ]
    if any(re.search(pattern, user_agent_string.lower()) for pattern in bot_patterns):
        result["is_bot"] = True
        return result
    
    # Detect OS
    if "Windows NT 10" in user_agent_string:
        result["os"] = "Windows 10"
    elif "Windows NT 11" in user_agent_string:
        result["os"] = "Windows 11"
    elif "Mac OS X" in user_agent_string:
        result["os"] = "macOS"
    elif "Linux" in user_agent_string:
        result["os"] = "Linux"
    elif "Android" in user_agent_string:
        result["os"] = "Android"
        result["device_type"] = "mobile"
    elif "iPhone" in user_agent_string:
        result["os"] = "iOS"
        result["device_type"] = "mobile"
        result["device_name"] = "iPhone"
    elif "iPad" in user_agent_string:
        result["os"] = "iPadOS"
        result["device_type"] = "tablet"
        result["device_name"] = "iPad"
    
    # Detect browser
    if "Chrome" in user_agent_string and "Edg" not in user_agent_string:
        match = re.search(r'Chrome/(\d+)', user_agent_string)
        if match:
            result["browser"] = f"Chrome {match.group(1)}"
    elif "Firefox" in user_agent_string:
        match = re.search(r'Firefox/(\d+)', user_agent_string)
        if match:
            result["browser"] = f"Firefox {match.group(1)}"
    elif "Safari" in user_agent_string and "Chrome" not in user_agent_string:
        result["browser"] = "Safari"
    elif "Edg" in user_agent_string:
        match = re.search(r'Edg/(\d+)', user_agent_string)
        if match:
            result["browser"] = f"Edge {match.group(1)}"
    
    # Set device type if not already set
    if result["device_type"] == "unknown":
        if any(x in user_agent_string for x in ["Mobile", "Android", "iPhone"]):
            result["device_type"] = "mobile"
        elif "Tablet" in user_agent_string or "iPad" in user_agent_string:
            result["device_type"] = "tablet"
        else:
            result["device_type"] = "desktop"
    
    # Set generic device name if needed
    if result["device_name"] == "Unknown Device":
        if result["device_type"] == "desktop":
            result["device_name"] = f"{result['os']} Computer"
        elif result["device_type"] == "mobile":
            result["device_name"] = f"{result['os']} Phone"
        elif result["device_type"] == "tablet":
            result["device_name"] = f"{result['os']} Tablet"
    
    return result


def get_device_icon(device_type: str) -> str:
    """
    Get an emoji icon for the device type.
    
    Args:
        device_type: Type of device
        
    Returns:
        Emoji icon string
    """
    icons = {
        "desktop": "💻",
        "mobile": "📱",
        "tablet": "📲",
        "other": "🖥️",
        "unknown": "❓"
    }
    return icons.get(device_type, "❓")
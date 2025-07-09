"""
Security configuration for admin interface.

Centralizes all security-related settings and provides
environment-specific configurations.
"""

from typing import List, Dict, Any, Optional
from datetime import timedelta
import os
from dataclasses import dataclass, field


@dataclass
class SecurityConfig:
    """Main security configuration."""
    
    # Environment
    environment: str = field(default_factory=lambda: os.getenv("ENVIRONMENT", "development"))
    debug: bool = field(default_factory=lambda: os.getenv("DEBUG", "false").lower() == "true")
    
    # Session Management
    session_inactivity_timeout: timedelta = timedelta(minutes=30)
    session_absolute_timeout: timedelta = timedelta(hours=8)
    max_concurrent_sessions: int = 3
    session_token_length: int = 64
    session_secure_cookie: bool = True
    session_httponly_cookie: bool = True
    session_samesite_cookie: str = "strict"
    
    # Two-Factor Authentication
    require_2fa: bool = True
    totp_issuer: str = "Jidelnicek Admin"
    totp_period: int = 30
    totp_digits: int = 6
    sms_code_length: int = 6
    sms_code_expiry: timedelta = timedelta(minutes=10)
    backup_codes_count: int = 10
    backup_code_length: int = 8
    
    # IP Whitelisting
    enforce_ip_whitelist: bool = True
    allow_vpn_connections: bool = False
    allow_tor_connections: bool = False
    allow_proxy_connections: bool = False
    max_ip_risk_score: int = 50
    auto_block_suspicious_ips: bool = True
    auto_block_countries: List[str] = field(default_factory=list)
    ip_block_duration: timedelta = timedelta(hours=24)
    
    # Rate Limiting
    rate_limit_window: timedelta = timedelta(minutes=15)
    rate_limit_max_requests: int = 100
    rate_limit_lockout_duration: timedelta = timedelta(hours=1)
    max_failed_login_attempts: int = 5
    failed_login_lockout: timedelta = timedelta(minutes=30)
    
    # CSRF Protection
    csrf_token_length: int = 32
    csrf_header_name: str = "X-CSRF-Token"
    csrf_cookie_name: str = "csrf_token"
    csrf_cookie_secure: bool = True
    csrf_cookie_httponly: bool = True
    csrf_cookie_samesite: str = "strict"
    
    # Password Policy
    min_password_length: int = 12
    require_uppercase: bool = True
    require_lowercase: bool = True
    require_numbers: bool = True
    require_special_chars: bool = True
    password_history_count: int = 5
    password_expiry_days: int = 90
    
    # Encryption
    encryption_algorithm: str = "AES-256-GCM"
    key_derivation_function: str = "PBKDF2"
    key_derivation_iterations: int = 100000
    
    # Audit Logging
    audit_log_retention_days: int = 365
    audit_log_encryption: bool = True
    audit_sensitive_data_masking: bool = True
    
    # Security Headers
    hsts_max_age: int = 31536000  # 1 year
    hsts_include_subdomains: bool = True
    hsts_preload: bool = True
    x_frame_options: str = "DENY"
    x_content_type_options: str = "nosniff"
    referrer_policy: str = "strict-origin-when-cross-origin"
    
    # Content Security Policy
    csp_default_src: List[str] = field(default_factory=lambda: ["'self'"])
    csp_script_src: List[str] = field(default_factory=lambda: ["'self'", "'strict-dynamic'"])
    csp_style_src: List[str] = field(default_factory=lambda: ["'self'", "'unsafe-inline'"])
    csp_img_src: List[str] = field(default_factory=lambda: ["'self'", "data:", "https:"])
    csp_font_src: List[str] = field(default_factory=lambda: ["'self'", "data:"])
    csp_connect_src: List[str] = field(default_factory=lambda: ["'self'"])
    csp_frame_ancestors: List[str] = field(default_factory=lambda: ["'none'"])
    csp_report_uri: Optional[str] = "/admin/api/csp-report"
    
    # Permissions Policy
    permissions_policy: Dict[str, str] = field(default_factory=lambda: {
        "accelerometer": "()",
        "camera": "()",
        "geolocation": "()",
        "gyroscope": "()",
        "magnetometer": "()",
        "microphone": "()",
        "payment": "()",
        "usb": "()"
    })
    
    # API Security
    api_key_length: int = 32
    api_rate_limit_per_minute: int = 60
    api_burst_limit: int = 10
    require_api_key_rotation: bool = True
    api_key_rotation_days: int = 90
    
    # Data Protection
    encrypt_pii_at_rest: bool = True
    data_retention_days: int = 365
    auto_delete_expired_data: bool = True
    backup_encryption: bool = True
    
    # Compliance
    gdpr_enabled: bool = True
    ccpa_enabled: bool = False
    pci_dss_mode: bool = False
    
    # Security Monitoring
    enable_intrusion_detection: bool = True
    enable_anomaly_detection: bool = True
    security_alert_email: Optional[str] = None
    security_alert_webhook: Optional[str] = None
    
    # Development Overrides
    def __post_init__(self):
        """Apply environment-specific overrides."""
        if self.environment == "development":
            # Relax some settings for development
            self.enforce_ip_whitelist = False
            self.require_2fa = False
            self.session_secure_cookie = False
            self.csrf_cookie_secure = False
            self.rate_limit_max_requests = 1000
        
        elif self.environment == "staging":
            # Staging should mirror production mostly
            self.enforce_ip_whitelist = True
            self.require_2fa = True
        
        elif self.environment == "production":
            # Enforce all security measures
            self.debug = False
            self.enforce_ip_whitelist = True
            self.require_2fa = True
            self.encrypt_pii_at_rest = True
            self.audit_log_encryption = True
    
    @classmethod
    def from_env(cls) -> 'SecurityConfig':
        """Create config from environment variables."""
        config = cls()
        
        # Override from environment
        env_mappings = {
            'ADMIN_SESSION_TIMEOUT': ('session_inactivity_timeout', lambda x: timedelta(minutes=int(x))),
            'ADMIN_MAX_SESSIONS': ('max_concurrent_sessions', int),
            'ADMIN_REQUIRE_2FA': ('require_2fa', lambda x: x.lower() == 'true'),
            'ADMIN_ENFORCE_IP_WHITELIST': ('enforce_ip_whitelist', lambda x: x.lower() == 'true'),
            'ADMIN_RATE_LIMIT': ('rate_limit_max_requests', int),
            'ADMIN_PASSWORD_MIN_LENGTH': ('min_password_length', int),
            'ADMIN_AUDIT_RETENTION_DAYS': ('audit_log_retention_days', int),
            'ADMIN_SECURITY_ALERT_EMAIL': ('security_alert_email', str),
        }
        
        for env_var, (attr, converter) in env_mappings.items():
            value = os.getenv(env_var)
            if value:
                setattr(config, attr, converter(value))
        
        return config
    
    def validate(self) -> List[str]:
        """Validate configuration and return any issues."""
        issues = []
        
        # Check for insecure settings in production
        if self.environment == "production":
            if self.debug:
                issues.append("Debug mode enabled in production")
            
            if not self.enforce_ip_whitelist:
                issues.append("IP whitelist not enforced in production")
            
            if not self.require_2fa:
                issues.append("2FA not required in production")
            
            if not self.session_secure_cookie:
                issues.append("Session cookies not marked as secure")
            
            if self.min_password_length < 12:
                issues.append("Password minimum length too short for production")
            
            if not self.encrypt_pii_at_rest:
                issues.append("PII encryption disabled in production")
        
        # General validation
        if self.session_inactivity_timeout > timedelta(hours=2):
            issues.append("Session inactivity timeout too long")
        
        if self.max_concurrent_sessions > 10:
            issues.append("Excessive concurrent sessions allowed")
        
        if self.rate_limit_max_requests > 1000:
            issues.append("Rate limit too permissive")
        
        if self.password_expiry_days > 365:
            issues.append("Password expiry period too long")
        
        return issues
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert config to dictionary (for serialization)."""
        result = {}
        
        for key, value in self.__dict__.items():
            if isinstance(value, timedelta):
                result[key] = value.total_seconds()
            elif isinstance(value, (list, dict, str, int, bool)):
                result[key] = value
            elif value is None:
                result[key] = None
            else:
                result[key] = str(value)
        
        return result


# Create global config instance
security_config = SecurityConfig.from_env()

# Validate on import
validation_issues = security_config.validate()
if validation_issues:
    import warnings
    for issue in validation_issues:
        warnings.warn(f"Security config issue: {issue}")


def get_security_config() -> SecurityConfig:
    """Get the current security configuration."""
    return security_config


def reload_security_config() -> SecurityConfig:
    """Reload security configuration from environment."""
    global security_config
    security_config = SecurityConfig.from_env()
    return security_config
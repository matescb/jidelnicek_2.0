"""
Configuration management using Pydantic Settings.

This module provides type-safe configuration management with validation
for all environment variables used by the Jídelníček 2.0 application.
"""

import os
from typing import List, Optional, Dict, Any, Annotated, Union
from datetime import timedelta
from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic.networks import PostgresDsn, RedisDsn
from pydantic import EmailStr
from pydantic.networks import HttpUrl


class Settings(BaseSettings):
    """Application settings with validation."""
    
    # Environment
    environment: str = Field(default="development", pattern="^(development|staging|production|test)$")
    debug: bool = Field(default=False)
    log_level: str = Field(default="INFO", pattern="^(DEBUG|INFO|WARNING|ERROR|CRITICAL)$")
    
    # Application
    secret_key: str = Field(..., min_length=32)
    algorithm: str = Field(default="HS256")
    access_token_expire_minutes: int = Field(default=1440, ge=1)  # 24 hours as per PRD
    refresh_token_expire_days: int = Field(default=7, ge=1)
    rotate_refresh_tokens: bool = Field(default=False)  # Option to rotate refresh tokens on use
    
    # Database
    db_host: str = Field(default="localhost")
    db_port: int = Field(default=5432, ge=1, le=65535)
    db_name: str = Field(default="jidelnicek")
    db_user: str = Field(default="jidelnicek")
    db_password: str = Field(...)
    database_url: Optional[PostgresDsn] = None
    
    # Database Pool Settings
    db_pool_size: int = Field(default=20, ge=1)
    db_pool_max_overflow: int = Field(default=0, ge=0)
    db_pool_timeout: float = Field(default=30.0, gt=0)
    db_echo: bool = Field(default=False)
    
    # Redis
    redis_host: str = Field(default="localhost")
    redis_port: int = Field(default=6379, ge=1, le=65535)
    redis_db: int = Field(default=0, ge=0)
    redis_password: Optional[str] = None
    redis_url: Optional[RedisDsn] = None
    redis_pool_max_connections: int = Field(default=50, ge=1)
    redis_socket_timeout: int = Field(default=5, ge=1)
    redis_socket_connect_timeout: int = Field(default=5, ge=1)
    
    # CORS
    cors_origins: Union[str, List[str]] = Field(default=["http://localhost:3000"])
    cors_allow_credentials: bool = Field(default=True)
    cors_allow_methods: Union[str, List[str]] = Field(default=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
    cors_allow_headers: Union[str, List[str]] = Field(default=["*"])
    cors_max_age: int = Field(default=3600, ge=0)
    
    # Email
    email_host: str = Field(default="localhost")
    email_port: int = Field(default=1025, ge=1, le=65535)
    email_username: Optional[str] = None
    email_password: Optional[str] = None
    email_from: EmailStr = Field(default="noreply@jidelnicek.cz")
    email_from_name: str = Field(default="Jídelníček 2.0")
    email_use_tls: bool = Field(default=False)
    email_use_ssl: bool = Field(default=False)
    email_timeout: int = Field(default=30, ge=1)
    email_max_connections: int = Field(default=10, ge=1)
    
    # Security
    bcrypt_rounds: int = Field(default=12, ge=4, le=31)
    password_min_length: int = Field(default=8, ge=6)
    password_require_uppercase: bool = Field(default=True)
    password_require_lowercase: bool = Field(default=True)
    password_require_digits: bool = Field(default=True)
    password_require_special: bool = Field(default=True)
    max_login_attempts: int = Field(default=5, ge=1)
    lockout_duration_minutes: int = Field(default=15, ge=1)
    
    # CSRF Protection
    csrf_enabled: bool = Field(default=True)
    csrf_cookie_name: str = Field(default="jidelnicek_csrf")
    csrf_header_name: str = Field(default="X-CSRF-Token")
    csrf_token_length: int = Field(default=32, ge=16)
    csrf_max_age: int = Field(default=86400, ge=3600)  # 24 hours
    
    # Security Headers
    hsts_enabled: bool = Field(default=True)
    hsts_max_age: int = Field(default=31536000, ge=0)  # 1 year
    hsts_include_subdomains: bool = Field(default=True)
    hsts_preload: bool = Field(default=True)
    csp_enabled: bool = Field(default=True)
    csp_report_uri: Optional[HttpUrl] = None
    referrer_policy: str = Field(
        default="strict-origin-when-cross-origin",
        pattern="^(no-referrer|no-referrer-when-downgrade|origin|origin-when-cross-origin|same-origin|strict-origin|strict-origin-when-cross-origin|unsafe-url)$"
    )
    
    # File Upload
    max_upload_size: int = Field(default=10485760, ge=1)  # 10MB
    allowed_upload_extensions: Union[str, List[str]] = Field(
        default=[".jpg", ".jpeg", ".png", ".gif", ".pdf", ".doc", ".docx"]
    )
    upload_path: str = Field(default="uploads")
    secure_uploads: bool = Field(default=True)
    
    # API Rate Limiting
    rate_limit_enabled: bool = Field(default=True)
    rate_limit_requests: int = Field(default=100, ge=1)
    rate_limit_window: int = Field(default=60, ge=1)  # seconds
    rate_limit_burst: int = Field(default=10, ge=1)
    
    # Session
    session_cookie_name: str = Field(default="jidelnicek_session")
    session_cookie_secure: bool = Field(default=False)
    session_cookie_httponly: bool = Field(default=True)
    session_cookie_samesite: str = Field(default="lax", pattern="^(lax|strict|none)$")
    session_lifetime_hours: int = Field(default=24, ge=1)
    max_sessions_per_user: int = Field(default=5, ge=1)  # Maximum concurrent sessions per user
    
    # Monitoring
    sentry_dsn: Optional[HttpUrl] = None
    sentry_traces_sample_rate: float = Field(default=0.1, ge=0.0, le=1.0)
    otel_enabled: bool = Field(default=False)
    otel_endpoint: Optional[str] = None
    otel_service_name: str = Field(default="jidelnicek-backend")
    
    # External Services
    bakalari_api_url: Optional[HttpUrl] = None
    bakalari_api_key: Optional[str] = None
    bakalari_timeout: int = Field(default=30, ge=1)
    strava_api_url: Optional[HttpUrl] = None
    strava_api_key: Optional[str] = None
    strava_timeout: int = Field(default=30, ge=1)
    
    # Payment Gateway
    payment_gateway_enabled: bool = Field(default=False)
    payment_gateway_url: Optional[HttpUrl] = None
    payment_gateway_merchant_id: Optional[str] = None
    payment_gateway_secret_key: Optional[str] = None
    payment_gateway_timeout: int = Field(default=60, ge=1)
    
    # Feature Flags
    feature_student_ordering: bool = Field(default=True)
    feature_parent_portal: bool = Field(default=True)
    feature_nutrition_tracking: bool = Field(default=True)
    feature_allergen_alerts: bool = Field(default=True)
    feature_recipe_sharing: bool = Field(default=False)
    feature_meal_ratings: bool = Field(default=True)
    feature_mobile_app: bool = Field(default=False)
    feature_ai_recommendations: bool = Field(default=False)
    
    # Scheduled Jobs
    enable_scheduled_jobs: bool = Field(default=True)
    menu_sync_cron: str = Field(default="0 6 * * *")
    order_reminder_cron: str = Field(default="0 15 * * *")
    report_generation_cron: str = Field(default="0 2 * * 1")
    cleanup_cron: str = Field(default="0 3 * * *")
    
    # Backup
    backup_enabled: bool = Field(default=True)
    backup_retention_days: int = Field(default=30, ge=1)
    backup_s3_bucket: Optional[str] = None
    backup_s3_access_key: Optional[str] = None
    backup_s3_secret_key: Optional[str] = None
    backup_s3_region: str = Field(default="eu-central-1")
    backup_encryption_enabled: bool = Field(default=True)
    
    # Storage
    storage_backend: str = Field(default="local", pattern="^(local|s3|azure)$")
    storage_local_path: str = Field(default="/var/lib/jidelnicek/storage")
    storage_compression: str = Field(default="gzip", pattern="^(none|gzip|bzip2|xz|zip)$")
    storage_max_file_size: int = Field(default=104857600, ge=1)  # 100MB
    
    # S3 Storage
    storage_s3_bucket: Optional[str] = None
    storage_s3_region: str = Field(default="eu-central-1")
    storage_s3_access_key: Optional[str] = None
    storage_s3_secret_key: Optional[str] = None
    storage_s3_endpoint_url: Optional[str] = None  # For S3-compatible services
    storage_s3_storage_class: str = Field(default="STANDARD")
    storage_s3_encryption: Optional[str] = Field(default=None, pattern="^(AES256|aws:kms)?$")
    storage_s3_kms_key_id: Optional[str] = None
    
    # Azure Storage
    storage_azure_connection_string: Optional[str] = None
    storage_azure_container: Optional[str] = None
    storage_azure_account_name: Optional[str] = None
    storage_azure_account_key: Optional[str] = None
    storage_azure_sas_token: Optional[str] = None
    storage_azure_tier: str = Field(default="Hot", pattern="^(Hot|Cool|Archive)$")
    
    # Performance
    cache_ttl_seconds: int = Field(default=300, ge=0)
    query_timeout_seconds: int = Field(default=30, ge=1)
    request_timeout_seconds: int = Field(default=60, ge=1)
    worker_timeout_seconds: int = Field(default=120, ge=1)
    
    # WebSocket settings
    websocket_heartbeat_interval: int = Field(default=30, description="WebSocket heartbeat interval in seconds")
    websocket_heartbeat_timeout: int = Field(default=60, description="WebSocket heartbeat timeout in seconds")
    websocket_max_connections_per_user: int = Field(default=5, description="Max WebSocket connections per user")
    websocket_message_size_limit: int = Field(default=65536, description="Max WebSocket message size in bytes")
    
    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": False,
        "env_parse_none_str": "null"  # Don't parse empty strings as JSON
    }
    
    def __init__(self, **kwargs):
        # Load environment-specific config file if ENVIRONMENT is set
        environment = os.environ.get("ENVIRONMENT", "development")
        if environment == "test":
            self.model_config["env_file"] = ["config/test.env", ".env"]
        elif environment == "staging":
            self.model_config["env_file"] = ["config/staging.env", ".env"]
        elif environment == "production":
            self.model_config["env_file"] = ["config/production.env", ".env"]
        else:
            self.model_config["env_file"] = ["config/development.env", ".env"]
        
        super().__init__(**kwargs)
        
    @field_validator("database_url", mode="before")
    @classmethod
    def assemble_db_connection(cls, v: Optional[str], info) -> Any:
        """Construct database URL from components if not provided."""
        if isinstance(v, str):
            return v
        values = info.data
        from pydantic import PostgresDsn
        return str(PostgresDsn.build(
            scheme="postgresql",
            username=values.get("db_user"),
            password=values.get("db_password"),
            host=values.get("db_host"),
            port=values.get("db_port"),
            path=values.get('db_name') or '',
        ))
    
    @field_validator("redis_url", mode="before")
    @classmethod
    def assemble_redis_connection(cls, v: Optional[str], info) -> Any:
        """Construct Redis URL from components if not provided."""
        if isinstance(v, str):
            return v
        values = info.data
        password = values.get("redis_password")
        if password:
            return str(RedisDsn.build(
                scheme="redis",
                username=None,
                password=password,
                host=values.get("redis_host"),
                port=values.get("redis_port"),
                path=str(values.get('redis_db') or 0),
            ))
        return str(RedisDsn.build(
            scheme="redis",
            host=values.get("redis_host"),
            port=values.get("redis_port"),
            path=str(values.get('redis_db') or 0),
        ))
    
    @field_validator("cors_origins", mode="after")
    @classmethod
    def parse_cors_origins(cls, v: Any) -> List[str]:
        """Ensure CORS origins is always a list."""
        if isinstance(v, str):
            # Handle empty string case
            if not v.strip():
                return []
            # Parse as comma-separated string
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v if isinstance(v, list) else []
    
    @field_validator("allowed_upload_extensions", mode="after")
    @classmethod
    def parse_upload_extensions(cls, v: Any) -> List[str]:
        """Ensure upload extensions is always a list."""
        if isinstance(v, str):
            # Handle empty string case
            if not v.strip():
                return []
            # Handle comma-separated string e.g. '.jpg,.png' or 'jpg, png'
            return [f".{ext.strip().lstrip('.')}" for ext in v.split(',') if ext.strip()]
        return v if isinstance(v, list) else []
    
    @field_validator("cors_allow_methods", "cors_allow_headers", mode="after")
    @classmethod
    def parse_string_list(cls, v: Any) -> List[str]:
        """Parse comma-separated strings into lists."""
        if isinstance(v, str):
            if not v.strip():
                return []
            return [item.strip() for item in v.split(",") if item.strip()]
        return v if isinstance(v, list) else []
    
    @field_validator(
        "csp_report_uri", 
        "sentry_dsn", 
        "bakalari_api_url", 
        "strava_api_url", 
        "payment_gateway_url",
        "redis_password",
        "email_username",
        "email_password",
        "otel_endpoint",
        "bakalari_api_key",
        "strava_api_key",
        "payment_gateway_merchant_id",
        "payment_gateway_secret_key",
        mode="before"
    )
    @classmethod
    def empty_str_to_none(cls, v: Any) -> Any:
        """Convert empty string to None for optional fields."""
        if isinstance(v, str) and not v.strip():
            return None
        return v
    
    @field_validator("secret_key")
    @classmethod
    def validate_secret_key(cls, v: str, info) -> str:
        """Ensure secret key is secure in production."""
        values = info.data
        if values.get("environment") == "production" and v == "your-secret-key-here-change-in-production":
            raise ValueError("Secret key must be changed in production!")
        return v
    
    @field_validator("session_cookie_secure")
    @classmethod
    def validate_secure_cookies(cls, v: bool, info) -> bool:
        """Ensure secure cookies in production."""
        values = info.data
        if values.get("environment") == "production" and not v:
            raise ValueError("Secure cookies must be enabled in production!")
        return v
    
    @field_validator("payment_gateway_url", "payment_gateway_merchant_id", "payment_gateway_secret_key")
    @classmethod
    def validate_payment_gateway(cls, v: Optional[Any], info) -> Optional[Any]:
        """Validate payment gateway configuration."""
        values = info.data
        if values.get("payment_gateway_enabled") and not v:
            raise ValueError(f"{info.field_name} is required when payment gateway is enabled!")
        return v
    
    @property
    def is_production(self) -> bool:
        """Check if running in production."""
        return self.environment == "production"
    
    @property
    def is_development(self) -> bool:
        """Check if running in development."""
        return self.environment == "development"
    
    @property
    def is_testing(self) -> bool:
        """Check if running in test environment."""
        return self.environment == "test"
    
    @property
    def access_token_expire_timedelta(self) -> timedelta:
        """Get access token expiration as timedelta."""
        return timedelta(minutes=self.access_token_expire_minutes)
    
    @property
    def refresh_token_expire_timedelta(self) -> timedelta:
        """Get refresh token expiration as timedelta."""
        return timedelta(days=self.refresh_token_expire_days)
    
    @property
    def session_lifetime_timedelta(self) -> timedelta:
        """Get session lifetime as timedelta."""
        return timedelta(hours=self.session_lifetime_hours)
    
    @property
    def lockout_duration_timedelta(self) -> timedelta:
        """Get lockout duration as timedelta."""
        return timedelta(minutes=self.lockout_duration_minutes)
    
    def get_db_settings(self) -> Dict[str, Any]:
        """Get database configuration for SQLAlchemy."""
        return {
            "pool_size": self.db_pool_size,
            "max_overflow": self.db_pool_max_overflow,
            "pool_timeout": self.db_pool_timeout,
            "echo": self.db_echo,
            "pool_pre_ping": True,
            "pool_recycle": 3600,  # Recycle connections after 1 hour
        }
    
    def get_redis_settings(self) -> Dict[str, Any]:
        """Get Redis configuration."""
        return {
            "max_connections": self.redis_pool_max_connections,
            "socket_timeout": self.redis_socket_timeout,
            "socket_connect_timeout": self.redis_socket_connect_timeout,
            "decode_responses": True,
            "retry_on_timeout": True,
        }
    
    def get_email_settings(self) -> Dict[str, Any]:
        """Get email configuration."""
        return {
            "hostname": self.email_host,
            "port": self.email_port,
            "username": self.email_username,
            "password": self.email_password,
            "use_credentials": bool(self.email_username and self.email_password),
            "validate_certs": self.email_use_tls or self.email_use_ssl,
            "timeout": self.email_timeout,
            "max_connections": self.email_max_connections,
        }
    
    def get_cors_settings(self) -> Dict[str, Any]:
        """Get CORS configuration."""
        return {
            "allow_origins": self.cors_origins,
            "allow_credentials": self.cors_allow_credentials,
            "allow_methods": self.cors_allow_methods,
            "allow_headers": self.cors_allow_headers,
            "max_age": self.cors_max_age,
        }
    
    def validate_configuration(self) -> List[str]:
        """
        Validate configuration completeness and correctness.
        
        Returns:
            List of validation warnings (empty if all good)
        """
        warnings = []
        
        # Production checks
        if self.is_production:
            if self.debug:
                warnings.append("Debug mode should be disabled in production")
            if not self.session_cookie_secure:
                warnings.append("Session cookies should be secure in production")
            if not self.backup_enabled:
                warnings.append("Backups should be enabled in production")
            if not self.sentry_dsn:
                warnings.append("Sentry DSN should be configured for production error tracking")
        
        # Email configuration
        if self.email_use_tls and self.email_use_ssl:
            warnings.append("Cannot use both TLS and SSL for email")
        
        # Rate limiting
        if self.rate_limit_enabled and self.rate_limit_window <= 0:
            warnings.append("Rate limit window must be positive when rate limiting is enabled")
        
        # External services
        if self.bakalari_api_url and not self.bakalari_api_key:
            warnings.append("Bakaláři API key required when API URL is configured")
        if self.strava_api_url and not self.strava_api_key:
            warnings.append("Strava API key required when API URL is configured")
        
        # Backup configuration
        if self.backup_enabled and self.backup_s3_bucket:
            if not self.backup_s3_access_key or not self.backup_s3_secret_key:
                warnings.append("S3 credentials required when S3 backup is configured")
        
        # Storage configuration
        if self.storage_backend == "s3":
            if not self.storage_s3_bucket:
                warnings.append("S3 bucket name required when using S3 storage backend")
            if not self.storage_s3_access_key or not self.storage_s3_secret_key:
                warnings.append("S3 credentials required when using S3 storage backend")
        elif self.storage_backend == "azure":
            if not self.storage_azure_container:
                warnings.append("Azure container name required when using Azure storage backend")
            if not self.storage_azure_connection_string:
                if not (self.storage_azure_account_name and 
                       (self.storage_azure_account_key or self.storage_azure_sas_token)):
                    warnings.append("Azure credentials required when using Azure storage backend")
        
        return warnings


@lru_cache()
def get_settings() -> Settings:
    """
    Get cached settings instance.
    
    Returns:
        Settings instance
    """
    return Settings()


# Convenience function for accessing settings
settings = get_settings()
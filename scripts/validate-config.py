#!/usr/bin/env python3
"""
Configuration validation script for Jídelníček 2.0.

This script validates the application configuration, checks required services,
and reports any issues before starting the application.
"""

import sys
import os
import asyncio
import socket
from typing import List, Tuple, Optional
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    from src.jidelnicek.core.config import settings, Settings
    import asyncpg
    import redis.asyncio as redis
    from rich.console import Console
    from rich.table import Table
    from rich.panel import Panel
    from rich import box
except ImportError as e:
    print(f"Error: Missing required dependencies. Please run 'poetry install'")
    print(f"Details: {e}")
    sys.exit(1)

console = Console()


class ConfigValidator:
    """Validates application configuration and dependencies."""
    
    def __init__(self):
        self.errors: List[str] = []
        self.warnings: List[str] = []
        self.info: List[str] = []
        
    async def validate_all(self) -> bool:
        """
        Run all validation checks.
        
        Returns:
            True if validation passed, False otherwise
        """
        console.print(Panel.fit("🔍 Jídelníček 2.0 Configuration Validator", style="bold blue"))
        
        # Basic configuration
        self._validate_environment()
        self._validate_secrets()
        self._validate_paths()
        
        # External services
        await self._check_database()
        await self._check_redis()
        self._check_email_config()
        
        # Features and integrations
        self._check_external_services()
        self._check_feature_flags()
        self._check_backup_config()
        
        # Security
        self._validate_security_settings()
        
        # Performance
        self._validate_performance_settings()
        
        # Display results
        self._display_results()
        
        return len(self.errors) == 0
    
    def _validate_environment(self):
        """Validate environment settings."""
        console.print("\n[bold]Checking environment settings...[/bold]")
        
        if settings.environment not in ["development", "staging", "production", "test"]:
            self.errors.append(f"Invalid environment: {settings.environment}")
        else:
            self.info.append(f"Environment: {settings.environment}")
        
        if settings.is_production and settings.debug:
            self.errors.append("Debug mode is enabled in production!")
        
        # Run built-in validation
        validation_warnings = settings.validate_configuration()
        self.warnings.extend(validation_warnings)
    
    def _validate_secrets(self):
        """Validate secret keys and passwords."""
        console.print("\n[bold]Checking secrets...[/bold]")
        
        if len(settings.secret_key) < 32:
            self.errors.append("Secret key must be at least 32 characters long")
        
        if settings.is_production:
            if settings.secret_key == "your-secret-key-here-change-in-production":
                self.errors.append("Default secret key detected in production!")
            
            if settings.db_password == "your-secure-password-here":
                self.errors.append("Default database password detected in production!")
    
    def _validate_paths(self):
        """Validate file paths and permissions."""
        console.print("\n[bold]Checking file paths...[/bold]")
        
        upload_path = Path(settings.upload_path)
        if not upload_path.is_absolute():
            upload_path = Path.cwd() / upload_path
        
        if not upload_path.exists():
            try:
                upload_path.mkdir(parents=True, exist_ok=True)
                self.info.append(f"Created upload directory: {upload_path}")
            except Exception as e:
                self.errors.append(f"Cannot create upload directory: {e}")
        else:
            # Check write permissions
            test_file = upload_path / ".write_test"
            try:
                test_file.touch()
                test_file.unlink()
                self.info.append(f"Upload directory writable: {upload_path}")
            except Exception as e:
                self.errors.append(f"Upload directory not writable: {e}")
    
    async def _check_database(self):
        """Check database connectivity."""
        console.print("\n[bold]Checking database connection...[/bold]")
        
        try:
            # Test connection
            conn = await asyncpg.connect(
                str(settings.database_url),
                timeout=settings.db_pool_timeout
            )
            
            # Check version
            version = await conn.fetchval("SELECT version()")
            self.info.append(f"PostgreSQL connected: {version.split(',')[0]}")
            
            # Check database exists
            db_exists = await conn.fetchval(
                "SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = $1)",
                settings.db_name
            )
            
            if not db_exists and settings.environment != "test":
                self.warnings.append(f"Database '{settings.db_name}' does not exist")
            
            await conn.close()
            
        except asyncpg.PostgresError as e:
            self.errors.append(f"Database connection failed: {e}")
        except Exception as e:
            self.errors.append(f"Database check failed: {e}")
    
    async def _check_redis(self):
        """Check Redis connectivity."""
        console.print("\n[bold]Checking Redis connection...[/bold]")
        
        try:
            # Create connection
            r = redis.from_url(
                str(settings.redis_url),
                encoding="utf-8",
                decode_responses=True,
                socket_timeout=settings.redis_socket_timeout,
                socket_connect_timeout=settings.redis_socket_connect_timeout
            )
            
            # Test connection
            await r.ping()
            
            # Get Redis info
            info = await r.info()
            self.info.append(
                f"Redis connected: v{info.get('redis_version', 'unknown')} "
                f"(Memory: {info.get('used_memory_human', 'unknown')})"
            )
            
            # Test write
            test_key = "config_validator_test"
            await r.set(test_key, "test_value", ex=10)
            value = await r.get(test_key)
            
            if value != "test_value":
                self.errors.append("Redis write/read test failed")
            
            await r.close()
            
        except redis.RedisError as e:
            self.errors.append(f"Redis connection failed: {e}")
        except Exception as e:
            self.errors.append(f"Redis check failed: {e}")
    
    def _check_email_config(self):
        """Check email configuration."""
        console.print("\n[bold]Checking email configuration...[/bold]")
        
        if settings.email_use_tls and settings.email_use_ssl:
            self.errors.append("Cannot use both TLS and SSL for email")
        
        # Try to resolve email host
        try:
            socket.gethostbyname(settings.email_host)
            self.info.append(f"Email host reachable: {settings.email_host}:{settings.email_port}")
        except socket.gaierror:
            if settings.environment == "production":
                self.errors.append(f"Cannot resolve email host: {settings.email_host}")
            else:
                self.warnings.append(f"Cannot resolve email host: {settings.email_host}")
    
    def _check_external_services(self):
        """Check external service configurations."""
        console.print("\n[bold]Checking external services...[/bold]")
        
        # Bakaláři integration
        if settings.bakalari_api_url:
            if not settings.bakalari_api_key:
                self.warnings.append("Bakaláři API URL configured but no API key provided")
            else:
                self.info.append("Bakaláři integration configured")
        
        # Strava integration
        if settings.strava_api_url:
            if not settings.strava_api_key:
                self.warnings.append("Strava API URL configured but no API key provided")
            else:
                self.info.append("Strava integration configured")
        
        # Payment gateway
        if settings.payment_gateway_enabled:
            missing = []
            if not settings.payment_gateway_url:
                missing.append("URL")
            if not settings.payment_gateway_merchant_id:
                missing.append("Merchant ID")
            if not settings.payment_gateway_secret_key:
                missing.append("Secret Key")
            
            if missing:
                self.errors.append(f"Payment gateway enabled but missing: {', '.join(missing)}")
            else:
                self.info.append("Payment gateway configured")
    
    def _check_feature_flags(self):
        """Check feature flag configurations."""
        console.print("\n[bold]Checking feature flags...[/bold]")
        
        features = {
            "Student Ordering": settings.feature_student_ordering,
            "Parent Portal": settings.feature_parent_portal,
            "Nutrition Tracking": settings.feature_nutrition_tracking,
            "Allergen Alerts": settings.feature_allergen_alerts,
            "Recipe Sharing": settings.feature_recipe_sharing,
            "Meal Ratings": settings.feature_meal_ratings,
            "Mobile App": settings.feature_mobile_app,
            "AI Recommendations": settings.feature_ai_recommendations,
        }
        
        enabled = [name for name, status in features.items() if status]
        
        if enabled:
            self.info.append(f"Enabled features: {', '.join(enabled)}")
        
        # Check for experimental features in production
        if settings.is_production:
            experimental = ["Recipe Sharing", "Mobile App", "AI Recommendations"]
            enabled_experimental = [f for f in experimental if features.get(f, False)]
            
            if enabled_experimental:
                self.warnings.append(
                    f"Experimental features enabled in production: {', '.join(enabled_experimental)}"
                )
    
    def _check_backup_config(self):
        """Check backup configuration."""
        console.print("\n[bold]Checking backup configuration...[/bold]")
        
        if not settings.backup_enabled:
            if settings.is_production:
                self.warnings.append("Backups are disabled in production!")
            return
        
        if settings.backup_s3_bucket:
            if not settings.backup_s3_access_key or not settings.backup_s3_secret_key:
                self.errors.append("S3 backup enabled but credentials missing")
            else:
                self.info.append(
                    f"S3 backup configured: {settings.backup_s3_bucket} "
                    f"(retention: {settings.backup_retention_days} days)"
                )
    
    def _validate_security_settings(self):
        """Validate security configurations."""
        console.print("\n[bold]Checking security settings...[/bold]")
        
        # HTTPS/Secure cookies
        if settings.is_production and not settings.session_cookie_secure:
            self.errors.append("Secure cookies must be enabled in production")
        
        # Password policy
        if settings.password_min_length < 8:
            self.warnings.append(f"Password minimum length ({settings.password_min_length}) is less than 8")
        
        # Bcrypt rounds
        if settings.bcrypt_rounds < 10 and settings.is_production:
            self.warnings.append(f"Bcrypt rounds ({settings.bcrypt_rounds}) should be at least 10 in production")
        
        # Rate limiting
        if not settings.rate_limit_enabled and settings.is_production:
            self.warnings.append("Rate limiting is disabled in production")
    
    def _validate_performance_settings(self):
        """Validate performance configurations."""
        console.print("\n[bold]Checking performance settings...[/bold]")
        
        # Database pool
        if settings.db_pool_size < 10 and settings.is_production:
            self.warnings.append(f"Database pool size ({settings.db_pool_size}) may be too small for production")
        
        # Redis pool
        if settings.redis_pool_max_connections < 50 and settings.is_production:
            self.warnings.append(f"Redis pool size ({settings.redis_pool_max_connections}) may be too small for production")
        
        # Timeouts
        if settings.query_timeout_seconds > 60:
            self.warnings.append(f"Query timeout ({settings.query_timeout_seconds}s) seems too high")
    
    def _display_results(self):
        """Display validation results."""
        console.print("\n" + "=" * 80 + "\n")
        
        # Create summary table
        table = Table(title="Validation Summary", box=box.ROUNDED)
        table.add_column("Type", style="bold")
        table.add_column("Count", justify="right")
        table.add_column("Status", justify="center")
        
        error_status = "[red]✗[/red]" if self.errors else "[green]✓[/green]"
        warning_status = "[yellow]![/yellow]" if self.warnings else "[green]✓[/green]"
        
        table.add_row("Errors", str(len(self.errors)), error_status)
        table.add_row("Warnings", str(len(self.warnings)), warning_status)
        table.add_row("Info", str(len(self.info)), "[blue]i[/blue]")
        
        console.print(table)
        
        # Display details
        if self.errors:
            console.print("\n[bold red]Errors:[/bold red]")
            for error in self.errors:
                console.print(f"  ❌ {error}")
        
        if self.warnings:
            console.print("\n[bold yellow]Warnings:[/bold yellow]")
            for warning in self.warnings:
                console.print(f"  ⚠️  {warning}")
        
        if self.info:
            console.print("\n[bold blue]Information:[/bold blue]")
            for info in self.info:
                console.print(f"  ℹ️  {info}")
        
        # Final status
        console.print("\n" + "=" * 80 + "\n")
        
        if self.errors:
            console.print(
                "[bold red]❌ Configuration validation FAILED![/bold red]\n"
                "Please fix the errors above before starting the application."
            )
        else:
            if self.warnings:
                console.print(
                    "[bold yellow]⚠️  Configuration validation passed with warnings.[/bold yellow]\n"
                    "The application can start, but you should review the warnings."
                )
            else:
                console.print(
                    "[bold green]✅ Configuration validation PASSED![/bold green]\n"
                    "All checks completed successfully."
                )


async def main():
    """Main entry point."""
    validator = ConfigValidator()
    
    try:
        success = await validator.validate_all()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        console.print("\n[yellow]Validation interrupted by user[/yellow]")
        sys.exit(1)
    except Exception as e:
        console.print(f"\n[red]Unexpected error: {e}[/red]")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
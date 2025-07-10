"""
Main FastAPI application for Jídelníček 2.0.

This module sets up the FastAPI application with all routers,
middleware, and event handlers.
"""

import logging
import uuid
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.exceptions import RequestValidationError, ResponseValidationError
from pydantic import ValidationError
import uvicorn

from jidelnicek.core.config import settings
from jidelnicek.core.dependencies import init_db, close_db, init_redis, close_redis
from jidelnicek.auth.routers import auth_router, monitoring_router
from jidelnicek.auth.tasks import start_session_cleanup_background_task
from jidelnicek.recipe.routers import categories_router, tags_router, recipes_router, search_router, scaling_router
from jidelnicek.trip.routers import trips_router
from jidelnicek.core.routers.jobs import router as jobs_router, export_router
# from jidelnicek.core.routers.cleanup import router as cleanup_router
from jidelnicek.core.routers.progress import router as progress_router
# from jidelnicek.api.v1.endpoints.exports import router as unified_export_router
# from jidelnicek.admin.routers import users_router as admin_users_router, dashboard_router as admin_dashboard_router
from jidelnicek.core.middleware.security import (
    SecurityMiddleware,
    CSRFProtectMiddleware,
    RateLimitMiddleware,
    RequestSanitizationMiddleware
)
from jidelnicek.core.middleware.validation import (
    ValidationMiddleware,
    validation_exception_handler,
    response_validation_exception_handler,
    pydantic_validation_exception_handler,
    custom_validation_exception_handler,
    ValidationException
)
from jidelnicek.core.seed_data import check_and_seed

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.log_level),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator:
    """
    Application lifespan manager.
    
    Handles startup and shutdown events.
    """
    # Startup
    logger.info("Starting Jídelníček 2.0 API...")
    
    # Initialize database
    await init_db()
    
    # Seed initial data if needed
    try:
        seeded = await check_and_seed()
        if seeded:
            logger.info("Successfully seeded initial categories and tags")
    except Exception as e:
        logger.error(f"Failed to seed initial data: {e}")
        # Don't fail startup if seeding fails - app can still work
    
    # Initialize Redis
    await init_redis()
    
    # Start background tasks
    if settings.enable_scheduled_jobs:
        start_session_cleanup_background_task()
        logger.info("Started session cleanup background task")
    
    # Log configuration warnings
    warnings = settings.validate_configuration()
    for warning in warnings:
        logger.warning(f"Configuration warning: {warning}")
    
    logger.info("Jídelníček 2.0 API started successfully")
    
    yield
    
    # Shutdown
    logger.info("Shutting down Jídelníček 2.0 API...")
    
    # Close database connections
    await close_db()
    
    # Close Redis connections
    await close_redis()
    
    logger.info("Jídelníček 2.0 API shutdown complete")


# Create FastAPI application
app = FastAPI(
    title="Jídelníček 2.0 API",
    description="Modern meal planning and school cafeteria management system",
    version="2.0.0",
    docs_url="/docs" if not settings.is_production else None,
    redoc_url="/redoc" if not settings.is_production else None,
    openapi_url="/openapi.json" if not settings.is_production else None,
    lifespan=lifespan
)

# Add Security middleware first (outermost)
app.add_middleware(
    SecurityMiddleware,
    hsts_max_age=settings.hsts_max_age if settings.hsts_enabled else 0,
    hsts_include_subdomains=settings.hsts_include_subdomains,
    hsts_preload=settings.hsts_preload,
    api_version="2.0.0",
    supported_versions=["1.0.0", "2.0.0"],
    max_request_size=settings.max_upload_size,
    referrer_policy=settings.referrer_policy
)

# Add Request Sanitization middleware
app.add_middleware(
    RequestSanitizationMiddleware,
    max_filename_length=255,
    allowed_upload_paths={
        "/api/upload",
        "/api/users/avatar",
        "/api/recipes/images",
        "/api/menus/documents"
    },
    sanitize_filenames=True
)

# Add Validation middleware
app.add_middleware(
    ValidationMiddleware,
    max_request_size=settings.max_upload_size,
    allowed_extensions=settings.allowed_upload_extensions,
    log_validation_errors=not settings.is_production
)

# Add CSRF Protection middleware
if settings.csrf_enabled:
    app.add_middleware(
        CSRFProtectMiddleware,
        cookie_name=settings.csrf_cookie_name,
        header_name=settings.csrf_header_name,
        excluded_paths={
            "/auth/login",
            "/auth/register",
            "/auth/token",
            "/auth/refresh",
            "/auth/logout",
            "/health",
            "/docs",
            "/redoc",
            "/openapi.json",
            "/",
        },
        token_length=settings.csrf_token_length,
        max_age=settings.csrf_max_age
    )

# Add Rate Limiting middleware
if settings.rate_limit_enabled:
    app.add_middleware(
        RateLimitMiddleware,
        requests_per_window=settings.rate_limit_requests,
        window_seconds=settings.rate_limit_window,
        burst_size=settings.rate_limit_burst,
        excluded_paths={
            "/health",
            "/docs",
            "/redoc",
            "/openapi.json",
            "/",
        }
    )

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=settings.cors_allow_credentials,
    allow_methods=settings.cors_allow_methods,
    allow_headers=settings.cors_allow_headers,
    max_age=settings.cors_max_age,
    expose_headers=[
        "X-Request-ID",
        "X-CSRF-Token",
        "X-RateLimit-Limit",
        "X-RateLimit-Remaining",
        "X-RateLimit-Reset",
        "API-Version",
        "API-Supported-Versions",
        "API-Deprecation",
        "API-Deprecation-Date",
        "API-Deprecation-Info"
    ]
)

# Add Trusted Host middleware for security
if settings.is_production:
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=["jidelnicek.cz", "*.jidelnicek.cz", "api.jidelnicek.cz"]
    )

# Add GZip middleware for response compression
app.add_middleware(GZipMiddleware, minimum_size=1000)


# Register validation exception handlers
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(ResponseValidationError, response_validation_exception_handler)
app.add_exception_handler(ValidationError, pydantic_validation_exception_handler)
app.add_exception_handler(ValidationException, custom_validation_exception_handler)


# Request ID middleware
@app.middleware("http")
async def add_request_id(request: Request, call_next):
    """Add unique request ID to each request for tracking."""
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id
    
    # Add request ID to logs
    logger_context = logging.LoggerAdapter(
        logger,
        {"request_id": request_id}
    )
    
    # Log request
    logger_context.info(
        f"Request: {request.method} {request.url.path}"
    )
    
    # Process request
    response = await call_next(request)
    
    # Add request ID to response headers
    response.headers["X-Request-ID"] = request_id
    
    return response


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Handle all unhandled exceptions."""
    request_id = getattr(request.state, "request_id", "unknown")
    
    logger.error(
        f"Unhandled exception in request {request_id}: {str(exc)}",
        exc_info=True
    )
    
    # Don't expose internal errors in production
    if settings.is_production:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "detail": "An internal server error occurred",
                "request_id": request_id
            }
        )
    else:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "detail": str(exc),
                "request_id": request_id,
                "type": type(exc).__name__
            }
        )


# Health check endpoint
@app.get(
    "/health",
    tags=["monitoring"],
    summary="Health check endpoint",
    response_model=dict
)
async def health_check():
    """
    Check application health status.
    
    Returns basic health information without sensitive data.
    """
    return {
        "status": "healthy",
        "version": "2.0.0",
        "environment": settings.environment
    }


# Include routers
app.include_router(auth_router)
app.include_router(monitoring_router)

# Recipe module routers
app.include_router(categories_router, prefix="/api/v1/recipes")
app.include_router(tags_router, prefix="/api/v1/recipes")
app.include_router(recipes_router, prefix="/api/v1")
app.include_router(search_router, prefix="/api/v1")
app.include_router(scaling_router, prefix="/api/v1")

# Trip module routers
app.include_router(trips_router, prefix="/api/v1")

# Job and export routers
app.include_router(jobs_router)
app.include_router(export_router)

# Unified export API router
# app.include_router(unified_export_router, prefix="/api/v1")

# Progress tracking router
app.include_router(progress_router)

# Cleanup management router (temporarily disabled)
# app.include_router(cleanup_router, prefix="/api/v1")

# Admin routers (temporarily disabled)
# app.include_router(admin_users_router)
# app.include_router(admin_dashboard_router)

# Additional routers will be added here as they are implemented:
# app.include_router(users.router)
# app.include_router(menus.router)
# app.include_router(orders.router)


# Root endpoint
@app.get("/", include_in_schema=False)
async def root():
    """Root endpoint - redirects to documentation in development."""
    if settings.is_development:
        return {
            "message": "Welcome to Jídelníček 2.0 API",
            "documentation": "/docs",
            "health": "/health"
        }
    else:
        return {"message": "Jídelníček 2.0 API"}


if __name__ == "__main__":
    # Run with uvicorn when executed directly
    uvicorn.run(
        "jidelnicek.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.is_development,
        log_level=settings.log_level.lower()
    )
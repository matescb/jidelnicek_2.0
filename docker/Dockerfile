# Multi-stage Dockerfile for Jídelníček 2.0
# Stage 1: Builder
FROM python:3.11-alpine AS builder

# Install build dependencies
RUN apk add --no-cache \
    gcc \
    musl-dev \
    postgresql-dev \
    python3-dev \
    libffi-dev \
    openssl-dev \
    cargo \
    build-base

# Set working directory
WORKDIR /app

# Install Poetry
ENV POETRY_VERSION=1.8.2
ENV POETRY_HOME=/opt/poetry
ENV POETRY_VENV=/opt/poetry-venv
ENV POETRY_CACHE_DIR=/opt/.cache

RUN python3 -m venv $POETRY_VENV \
    && $POETRY_VENV/bin/pip install --upgrade pip setuptools \
    && $POETRY_VENV/bin/pip install poetry==${POETRY_VERSION}

ENV PATH="$POETRY_VENV/bin:$PATH"

# Copy Poetry files
COPY pyproject.toml poetry.lock ./

# Install dependencies
RUN poetry config virtualenvs.create false \
    && poetry install --no-interaction --no-ansi --no-root --only main

# Stage 2: Runtime
FROM python:3.11-alpine

# Install runtime dependencies
RUN apk add --no-cache \
    postgresql-libs \
    libffi \
    openssl \
    curl \
    && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S jidelnicek \
    && adduser -u 1001 -S jidelnicek -G jidelnicek

# Set working directory
WORKDIR /app

# Copy Python dependencies from builder
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy application code
COPY --chown=jidelnicek:jidelnicek . .

# Create necessary directories
RUN mkdir -p /app/logs /app/static /app/media \
    && chown -R jidelnicek:jidelnicek /app/logs /app/static /app/media

# Switch to non-root user
USER jidelnicek

# Set environment variables
ENV PYTHONPATH=/app/src
ENV PYTHONUNBUFFERED=1
ENV PORT=8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# Expose port
EXPOSE ${PORT}

# Run the application
CMD ["uvicorn", "jidelnicek.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
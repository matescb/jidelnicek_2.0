# Jidelnicek 2.0 Documentation

This directory contains technical documentation for the Jidelnicek 2.0 meal planning application.

## Documentation Structure

### Core Documentation

- **[Database Schema](database_schema.md)** - Complete database schema documentation including:
  - Entity Relationship Diagrams
  - Table definitions and relationships
  - Performance optimization strategies
  - Index usage and query optimization
  - Migration guidelines

### API Documentation

- **API Design** - RESTful API design and OpenAPI specifications
- **Authentication** - JWT-based authentication flow documentation

### Development Guides

- **Performance Testing** - Guidelines for database performance testing
- **Security** - Security best practices and threat model
- **Deployment** - Deployment procedures for vpsFree.cz

## Quick Links

### Database Performance

For database performance optimization, see:
- [Database Schema Documentation](database_schema.md#performance-optimizations)
- Performance test suite: `tests/core/test_database_performance.py`
- Performance utilities: `src/jidelnicek/core/database_performance.py`

### Testing

- Unit tests: `tests/`
- Performance tests: `tests/core/test_database_performance.py`
- Testing utilities: `src/jidelnicek/core/testing/`

## Contributing

When adding new documentation:
1. Follow the existing structure and formatting
2. Include code examples where appropriate
3. Keep documentation up-to-date with code changes
4. Add entries to this README for new documents
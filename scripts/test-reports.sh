#!/bin/bash
# Test script to verify GitLab CI test reports are generated correctly

set -e

echo "🧪 Testing report generation for GitLab CI..."

# Set environment variables for testing
export ENVIRONMENT=test
export SECRET_KEY="test-secret-key-for-ci-integration-testing-32chars"
export DATABASE_URL="postgresql://test_user:test_password@localhost:5432/test_jidelnicek"
export REDIS_URL="redis://localhost:6379/0"
export TESTING=true

# Clean up any existing reports
echo "🧹 Cleaning up existing reports..."
rm -f junit-report.xml coverage.xml unit-test-report.html
rm -rf htmlcov/

# Run pytest with the exact same options as GitLab CI
echo "📊 Running tests with report generation..."
poetry run pytest tests/ \
    --cov=src/jidelnicek \
    --cov-report=xml \
    --cov-report=html \
    --cov-report=term-missing \
    --cov-fail-under=0 \
    --junitxml=junit-report.xml \
    --html=unit-test-report.html \
    --self-contained-html \
    -v \
    --tb=short \
    --maxfail=10 || echo "Some tests failed (expected)"

# Check if files were created
echo "✅ Checking generated files..."

if [ -f "junit-report.xml" ]; then
    echo "✅ junit-report.xml generated ($(wc -l < junit-report.xml) lines)"
else
    echo "❌ junit-report.xml NOT generated"
fi

if [ -f "coverage.xml" ]; then
    echo "✅ coverage.xml generated ($(wc -l < coverage.xml) lines)"
else
    echo "❌ coverage.xml NOT generated"
fi

if [ -f "unit-test-report.html" ]; then
    echo "✅ unit-test-report.html generated ($(wc -c < unit-test-report.html) bytes)"
else
    echo "❌ unit-test-report.html NOT generated"
fi

if [ -d "htmlcov" ]; then
    echo "✅ htmlcov/ directory generated ($(find htmlcov -name "*.html" | wc -l) HTML files)"
else
    echo "❌ htmlcov/ directory NOT generated"
fi

echo ""
echo "📋 Report generation test complete!"
echo "ℹ️  Use these files to verify GitLab CI artifact configuration."
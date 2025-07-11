# Performance Tests

This directory contains comprehensive performance tests for the frontend application.

## Test Categories

### 1. Component Performance Tests (`components.test.tsx`)
- Tests for lazy loading components
- Memoization effectiveness
- Virtual scrolling performance
- Image optimization
- Memory leak prevention

### 2. Hook Performance Tests (`hooks.test.ts`)
- Debounce/throttle implementation
- Memoization hooks
- Virtual scrolling hooks
- Performance monitoring hooks

### 3. Bundle Size Tests (`bundle.test.ts`)
- JavaScript bundle size monitoring
- CSS bundle optimization
- Code splitting verification
- Tree shaking effectiveness
- Asset optimization

### 4. Performance Benchmarks (`benchmarks.test.tsx`)
- List rendering performance
- Form input handling
- Route switching speed
- Large dataset operations
- Animation performance

## Running Performance Tests

```bash
# Run all performance tests
npm test -- __tests__/performance

# Run specific test file
npm test -- __tests__/performance/components.test.tsx

# Run with coverage
npm test -- __tests__/performance --coverage

# Run benchmarks only
npm test -- __tests__/performance/benchmarks.test.tsx
```

## Performance Metrics

### Render Time Targets
- Small lists (100 items): < 50ms
- Medium lists (1000 items): < 200ms
- Large forms (100 fields): < 100ms
- Route switching: < 100ms

### Bundle Size Targets
- Main bundle: < 150KB gzipped
- Vendor bundle: < 250KB gzipped
- Per-route chunks: < 30KB gzipped
- Total bundle: < 600KB gzipped

### Memory Targets
- No memory leaks on component unmount
- < 5MB memory increase after repeated mounting/unmounting

## CI/CD Integration

These tests are designed to be run in CI/CD pipelines:

1. **Pre-commit**: Run component and hook tests
2. **Pre-build**: Run all tests including benchmarks
3. **Post-build**: Run bundle size tests
4. **Nightly**: Run full benchmark suite

## Custom Matchers

The test utils provide custom Jest matchers:

```typescript
expect(renderTime).toRenderWithinMs(50)
expect(memoryUsage).toUseMemoryLessThan(5 * 1024 * 1024)
expect(fps).toMaintainFPSAbove(30)
```

## Performance Monitoring

The tests include utilities for:
- Component render time tracking
- Memory usage monitoring
- FPS measurement
- Bundle size analysis
- Re-render counting

## Writing New Performance Tests

When adding new performance tests:

1. Use the provided utilities from `utils.ts`
2. Set realistic performance targets
3. Test with production-like data volumes
4. Include memory leak checks
5. Document expected performance characteristics

Example:

```typescript
import { renderWithPerformance, benchmark } from './utils'

it('should render efficiently', async () => {
  const { performanceMonitor } = renderWithPerformance(
    <MyComponent data={largeDataset} />
  )
  
  expect(performanceMonitor.getAverageRenderTime()).toBeLessThan(100)
})
```

## Troubleshooting

### Tests Failing Due to Performance
- Check if development mode optimizations are disabled
- Ensure test environment matches production
- Consider increasing timeout for slow CI environments

### Memory Tests
- Memory tests require Chrome with `--enable-precise-memory-info`
- May not work in all test environments
- Use as guidance rather than hard requirements

### Bundle Size Tests
- Require built application (`npm run build`)
- Check dist directory exists before running
- Update size limits as application grows
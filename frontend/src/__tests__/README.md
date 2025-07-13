# Comprehensive Responsive Design and Accessibility Testing Framework

This directory contains a comprehensive testing framework for responsive design and accessibility compliance in the Jidelnicek 2.0 frontend application.

## Overview

The testing framework provides:

- **Responsive Design Testing**: Comprehensive viewport testing, breakpoint validation, and mobile interaction testing
- **Accessibility Testing**: WCAG 2.1 AA compliance, screen reader compatibility, and keyboard navigation testing  
- **Mobile-Specific Testing**: Touch gestures, mobile UI patterns, and performance optimization testing
- **Integration Testing**: Cross-component compatibility and real-world user flow testing

## Directory Structure

```
src/__tests__/
├── README.md                           # This file
├── accessibility/                      # Accessibility-specific tests
│   ├── navigation.test.tsx             # Navigation accessibility tests
│   ├── forms.test.tsx                  # Form accessibility tests
│   └── advanced-patterns.test.tsx      # Complex UI pattern accessibility tests
├── responsive/                         # Responsive design tests
│   ├── README.md                       # Responsive testing guide
│   ├── comprehensive.test.tsx          # Comprehensive responsive tests
│   ├── utils.ts                        # Responsive testing utilities
│   ├── hooks.test.ts                   # Responsive hook tests
│   ├── grid.test.tsx                   # Grid system tests
│   ├── navigation.test.tsx             # Navigation responsive tests
│   ├── adaptive.test.tsx               # Adaptive component tests
│   ├── mobile.test.tsx                 # Mobile component tests
│   ├── gestures.test.ts                # Gesture interaction tests
│   └── typography.test.tsx             # Typography responsive tests
├── mobile/                             # Mobile-specific tests
│   └── interactions.test.tsx           # Mobile interaction patterns
├── utils/                              # Testing utilities
│   ├── accessibility.ts               # Accessibility testing helpers
│   ├── responsive.ts                   # Responsive testing helpers
│   └── test-helpers.ts                 # Comprehensive test utilities
├── performance/                        # Performance tests
│   ├── benchmarks.test.tsx             # Performance benchmarks
│   ├── bundle.test.ts                  # Bundle size tests
│   ├── components.test.tsx             # Component performance tests
│   └── hooks.test.ts                   # Hook performance tests
└── run-comprehensive-tests.ts          # Main test runner
```

## Quick Start

### Running Tests

```bash
# Run all tests
npm test

# Run responsive design tests only
npm test src/__tests__/responsive/

# Run accessibility tests only
npm test src/__tests__/accessibility/

# Run mobile interaction tests only
npm test src/__tests__/mobile/

# Run comprehensive test suite
npm test src/__tests__/run-comprehensive-tests.ts

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui
```

### Test Categories

#### 1. Responsive Design Tests

Tests that validate responsive behavior across different screen sizes and orientations:

- **Viewport Testing**: Components adapt correctly at different screen sizes
- **Breakpoint Validation**: Tailwind CSS breakpoints work as expected
- **Grid System**: Responsive grid layouts function properly
- **Navigation**: Navigation components adapt to different screen sizes
- **Typography**: Text scales appropriately across devices
- **Images**: Responsive image techniques work correctly

#### 2. Accessibility Tests

Tests that ensure WCAG 2.1 AA compliance and screen reader compatibility:

- **Keyboard Navigation**: All interactive elements are keyboard accessible
- **Screen Reader**: Proper ARIA attributes and semantic HTML
- **Focus Management**: Focus is managed correctly in modals and complex UI
- **Color Contrast**: Text meets WCAG contrast requirements
- **Form Accessibility**: Forms are properly labeled and validated
- **Error Handling**: Errors are announced and recoverable

#### 3. Mobile Interaction Tests

Tests specific to mobile devices and touch interactions:

- **Touch Gestures**: Swipe, pinch, and tap gestures work correctly
- **Touch Targets**: All interactive elements meet size requirements
- **Mobile Navigation**: Bottom navigation and mobile menus function properly
- **Performance**: Mobile-specific performance optimizations
- **Orientation**: Components adapt to orientation changes

### Using Test Utilities

#### Responsive Testing Utilities

```typescript
import { 
  mockWindowResize, 
  VIEWPORT_PRESETS,
  testBreakpointBehavior,
  simulateSwipe,
  testTouchTargets 
} from '../utils/responsive';

// Test at specific viewport
mockWindowResize(VIEWPORT_PRESETS.mobile.medium.width, VIEWPORT_PRESETS.mobile.medium.height);

// Test component at multiple breakpoints
await testBreakpointBehavior(
  () => <MyComponent />,
  [
    {
      viewport: VIEWPORT_PRESETS.mobile.medium,
      expectedBreakpoint: 'xs',
      assertions: () => {
        expect(screen.getByTestId('mobile-view')).toBeVisible();
      },
    },
    {
      viewport: VIEWPORT_PRESETS.desktop.medium,
      expectedBreakpoint: 'lg',
      assertions: () => {
        expect(screen.getByTestId('desktop-view')).toBeVisible();
      },
    },
  ]
);

// Test swipe gestures
await simulateSwipe(element, {
  direction: 'left',
  distance: 100,
  duration: 300,
});

// Test touch targets
testTouchTargets(container);
```

#### Accessibility Testing Utilities

```typescript
import { 
  testKeyboardNavigation,
  testTabOrder,
  testFocusManagement,
  testFormAccessibility,
  mockScreenReader 
} from '../utils/accessibility';

// Test keyboard navigation
await testKeyboardNavigation(element, {
  keys: ['Tab', 'Enter', 'Escape'],
  expectFocus: true,
});

// Test tab order
await testTabOrder(['button-1', 'input-1', 'button-2']);

// Test focus management in modals
await testFocusManagement({
  triggerSelector: 'open-modal-button',
  modalSelector: 'modal-dialog',
  firstFocusableSelector: 'modal-close-button',
  lastFocusableSelector: 'modal-submit-button',
});

// Test form accessibility
const formStats = testFormAccessibility(formElement);
expect(formStats.inputCount).toBeGreaterThan(0);
expect(formStats.labelCount).toBe(formStats.inputCount);

// Test screen reader announcements
const screenReader = mockScreenReader();
// ... perform actions that should trigger announcements
const announcements = screenReader.getAnnouncements();
expect(announcements.some(a => a.includes('Form submitted successfully'))).toBeTruthy();
```

#### Comprehensive Test Helpers

```typescript
import { createTestSuite, testA11y, testResponsive } from '../utils/test-helpers';

// Create comprehensive test suite for a component
createTestSuite(
  'MyComponent',
  () => <MyComponent />,
  {
    skipResponsive: false,
    skipAccessibility: false,
    a11yLevel: 'AA',
    viewports: [
      { name: 'Mobile', ...VIEWPORT_PRESETS.mobile.medium },
      { name: 'Desktop', ...VIEWPORT_PRESETS.desktop.medium },
    ],
  }
);

// Quick accessibility test
testA11y(<MyComponent />, {
  keyboard: true,
  screenReader: true,
  focus: true,
  contrast: true,
});

// Quick responsive test
testResponsive(<MyComponent />, {
  mobile: () => expect(screen.getByTestId('mobile-specific')).toBeVisible(),
  desktop: () => expect(screen.getByTestId('desktop-specific')).toBeVisible(),
});
```

## Testing Guidelines

### 1. Responsive Design Testing

#### Required Tests for All Components

- [ ] **Viewport Adaptation**: Component renders correctly at mobile (320px), tablet (768px), and desktop (1280px) breakpoints
- [ ] **Layout Shifts**: No unexpected layout shifts when viewport changes
- [ ] **Touch Targets**: Interactive elements are at least 44x44px on mobile
- [ ] **Text Scaling**: Text remains readable at all screen sizes
- [ ] **Image Responsiveness**: Images scale appropriately and use responsive techniques

#### Mobile-Specific Requirements

- [ ] **Touch Gestures**: Swipe, pinch, and tap gestures work where appropriate
- [ ] **Momentum Scrolling**: Smooth scrolling on iOS devices
- [ ] **Safe Areas**: Content respects device safe areas (notches, home indicators)
- [ ] **Orientation**: Component adapts to landscape/portrait changes
- [ ] **Performance**: 60fps animations and smooth interactions

### 2. Accessibility Testing

#### WCAG 2.1 AA Requirements

- [ ] **Keyboard Navigation**: All interactive elements accessible via keyboard
- [ ] **Focus Indicators**: Clear focus indicators on all focusable elements
- [ ] **Screen Reader**: Proper ARIA labels and semantic HTML structure
- [ ] **Color Contrast**: Text meets 4.5:1 contrast ratio (3:1 for large text)
- [ ] **Error Messages**: Clear, actionable error messages
- [ ] **Form Labels**: All form inputs have associated labels

#### Advanced Accessibility Features

- [ ] **Skip Navigation**: Skip links for keyboard users
- [ ] **Live Regions**: Dynamic content changes announced to screen readers
- [ ] **Focus Management**: Focus managed correctly in modals and SPAs
- [ ] **Reduced Motion**: Respects prefers-reduced-motion settings
- [ ] **High Contrast**: Works with high contrast mode
- [ ] **Zoom Support**: Functions correctly at 200% zoom

### 3. Performance Testing

#### Performance Budgets

- [ ] **Initial Render**: Components render in under 100ms
- [ ] **Bundle Size**: Component bundles under reasonable size limits
- [ ] **Memory Usage**: No memory leaks on mount/unmount
- [ ] **Animation Performance**: 60fps for all animations
- [ ] **Network Efficiency**: Minimal unnecessary re-renders

## Coverage Requirements

### Global Coverage Targets
- **Lines**: 80%
- **Functions**: 80%
- **Branches**: 80%
- **Statements**: 80%

### Component-Specific Targets
- **Navigation Components**: 85% (higher due to complexity)
- **Form Components**: 90% (critical for accessibility)
- **Responsive Hooks**: 95% (core functionality)

## CI/CD Integration

### GitHub Actions

The test suite integrates with GitHub Actions for automated testing:

```yaml
# .github/workflows/test.yml
name: Test Suite
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:coverage
      - run: npm run test -- src/__tests__/run-comprehensive-tests.ts
```

### Quality Gates

Pull requests must pass:
- [ ] All responsive design tests
- [ ] All accessibility tests  
- [ ] Performance budgets
- [ ] Coverage thresholds
- [ ] Visual regression tests (if configured)

## Browser Testing

### Supported Browsers
- **Desktop**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **Mobile**: iOS Safari 14+, Chrome Mobile 90+, Samsung Internet 13+

### Cross-Browser Testing
```bash
# Run tests in different browser environments
npm test -- --browser=chrome
npm test -- --browser=firefox
npm test -- --browser=safari
```

## Debugging Tests

### Debug Mode
```bash
# Run tests with debugging
npm test -- --debug

# Run specific test file with debugging
npm test src/__tests__/responsive/navigation.test.tsx -- --debug

# Run tests with UI for visual debugging
npm run test:ui
```

### Common Issues

#### Responsive Tests Failing
1. Check viewport mocking is correct
2. Verify CSS classes are applied
3. Check for async state updates
4. Validate media query matches

#### Accessibility Tests Failing
1. Verify ARIA attributes are present
2. Check focus management in modals
3. Validate semantic HTML structure
4. Test with actual screen reader

#### Mobile Tests Failing
1. Check touch event simulation
2. Verify viewport meta tag
3. Validate gesture implementations
4. Test on actual mobile devices

## Contributing

### Adding New Tests

1. **Identify Test Category**: Responsive, accessibility, mobile, or performance
2. **Use Existing Utilities**: Leverage helper functions for consistency
3. **Follow Naming Conventions**: Descriptive test names
4. **Add Documentation**: Update this README if adding new patterns
5. **Verify Coverage**: Ensure new tests improve coverage

### Test Naming Conventions

```typescript
// ✅ Good: Descriptive and specific
it('should adapt navigation layout from desktop sidebar to mobile bottom tabs at 768px breakpoint', () => {

// ❌ Bad: Vague and non-specific  
it('should be responsive', () => {
```

### Utility Functions

When creating new test utilities:
1. Add to appropriate utility file (`responsive.ts`, `accessibility.ts`, etc.)
2. Export from `test-helpers.ts`
3. Add TypeScript types
4. Include JSDoc documentation
5. Add examples to this README

## Resources

### Documentation
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Vitest Documentation](https://vitest.dev/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)

### Tools
- [axe-core](https://github.com/dequelabs/axe-core) - Accessibility testing engine
- [Lighthouse](https://developers.google.com/web/tools/lighthouse) - Performance and accessibility auditing
- [Pa11y](https://pa11y.org/) - Command line accessibility testing
- [Storybook](https://storybook.js.org/) - Component development and testing

### Browser Extensions
- [axe DevTools](https://www.deque.com/axe/devtools/) - Accessibility testing
- [Responsive Design Mode](https://developer.mozilla.org/en-US/docs/Tools/Responsive_Design_Mode) - Firefox responsive testing
- [Chrome DevTools](https://developers.google.com/web/tools/chrome-devtools) - General development and testing
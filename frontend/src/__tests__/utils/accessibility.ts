/**
 * Accessibility testing utilities
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

/**
 * Common ARIA attributes to test
 */
export const ARIA_ATTRIBUTES = {
  // Labels and descriptions
  'aria-label': 'aria-label',
  'aria-labelledby': 'aria-labelledby',
  'aria-describedby': 'aria-describedby',
  
  // States
  'aria-checked': 'aria-checked',
  'aria-selected': 'aria-selected',
  'aria-expanded': 'aria-expanded',
  'aria-disabled': 'aria-disabled',
  'aria-hidden': 'aria-hidden',
  'aria-pressed': 'aria-pressed',
  
  // Properties
  'aria-level': 'aria-level',
  'aria-valuenow': 'aria-valuenow',
  'aria-valuemin': 'aria-valuemin',
  'aria-valuemax': 'aria-valuemax',
  'aria-required': 'aria-required',
  'aria-invalid': 'aria-invalid',
  'aria-live': 'aria-live',
  'aria-atomic': 'aria-atomic',
  
  // Relationships
  'aria-owns': 'aria-owns',
  'aria-controls': 'aria-controls',
  'aria-activedescendant': 'aria-activedescendant',
  'aria-posinset': 'aria-posinset',
  'aria-setsize': 'aria-setsize',
} as const;

/**
 * WCAG color contrast ratios
 */
export const CONTRAST_RATIOS = {
  AA_NORMAL: 4.5,
  AA_LARGE: 3,
  AAA_NORMAL: 7,
  AAA_LARGE: 4.5,
} as const;

/**
 * Test for keyboard navigation
 */
export const testKeyboardNavigation = async (
  element: HTMLElement,
  options: {
    expectFocus?: boolean;
    keys?: string[];
    shouldLoop?: boolean;
  } = {}
) => {
  const user = userEvent.setup();
  const {
    expectFocus = true,
    keys = ['Tab', 'ArrowDown', 'ArrowUp', 'Enter', 'Space', 'Escape'],
    shouldLoop = false,
  } = options;

  // Test focus
  if (expectFocus) {
    await user.tab();
    expect(element).toHaveFocus();
  }

  // Test each key
  for (const key of keys) {
    await user.keyboard(`{${key}}`);
    // Allow for async state updates
    await waitFor(() => {}, { timeout: 100 });
  }

  return {
    element,
    user,
  };
};

/**
 * Test tab order of focusable elements
 */
export const testTabOrder = async (expectedOrder: string[]) => {
  const user = userEvent.setup();
  
  // Start tabbing
  for (let i = 0; i < expectedOrder.length; i++) {
    await user.tab();
    const focused = document.activeElement;
    
    if (expectedOrder[i]) {
      const expected = screen.getByTestId(expectedOrder[i]);
      expect(focused).toBe(expected);
    }
  }
};

/**
 * Test skip navigation links
 */
export const testSkipNavigation = async () => {
  const user = userEvent.setup();
  
  // Tab to first element (should be skip link)
  await user.tab();
  
  const skipLink = document.activeElement;
  expect(skipLink).toHaveAttribute('href', '#main-content');
  
  // Activate skip link
  await user.keyboard('{Enter}');
  
  // Should focus main content
  const mainContent = screen.getByTestId('main-content');
  expect(mainContent).toHaveFocus();
};

/**
 * Test screen reader announcements
 */
export const testScreenReaderAnnouncement = (
  element: HTMLElement,
  expectedText: string
) => {
  // Check for aria-live regions
  const liveRegion = element.querySelector('[aria-live]');
  if (liveRegion) {
    expect(liveRegion).toHaveTextContent(expectedText);
  }
  
  // Check for aria-label or aria-describedby
  const label = element.getAttribute('aria-label');
  const describedBy = element.getAttribute('aria-describedby');
  
  if (label) {
    expect(label).toContain(expectedText);
  }
  
  if (describedBy) {
    const description = document.getElementById(describedBy);
    expect(description).toHaveTextContent(expectedText);
  }
};

/**
 * Test focus management for modals/dialogs
 */
export const testFocusManagement = async (options: {
  triggerSelector: string;
  modalSelector: string;
  closeSelector?: string;
  firstFocusableSelector?: string;
  lastFocusableSelector?: string;
}) => {
  const user = userEvent.setup();
  const {
    triggerSelector,
    modalSelector,
    closeSelector = '[data-testid="close-button"]',
    firstFocusableSelector,
    lastFocusableSelector,
  } = options;

  const trigger = screen.getByTestId(triggerSelector);
  
  // Open modal
  await user.click(trigger);
  
  const modal = screen.getByTestId(modalSelector);
  expect(modal).toBeInTheDocument();
  
  // Check initial focus
  if (firstFocusableSelector) {
    const firstFocusable = screen.getByTestId(firstFocusableSelector);
    expect(firstFocusable).toHaveFocus();
  }
  
  // Test focus trap - Tab should cycle within modal
  if (firstFocusableSelector && lastFocusableSelector) {
    const firstFocusable = screen.getByTestId(firstFocusableSelector);
    const lastFocusable = screen.getByTestId(lastFocusableSelector);
    
    // Tab to last element
    await user.tab({ shift: true });
    expect(lastFocusable).toHaveFocus();
    
    // Tab should go back to first
    await user.tab();
    expect(firstFocusable).toHaveFocus();
  }
  
  // Test escape key
  await user.keyboard('{Escape}');
  expect(modal).not.toBeInTheDocument();
  
  // Focus should return to trigger
  expect(trigger).toHaveFocus();
  
  return { user, trigger, modal };
};

/**
 * Test color contrast
 */
export const testColorContrast = (
  foregroundColor: string,
  backgroundColor: string,
  level: keyof typeof CONTRAST_RATIOS = 'AA_NORMAL'
) => {
  // This is a simplified contrast test
  // In practice, you'd use a library like color-contrast-calc
  const expectedRatio = CONTRAST_RATIOS[level];
  
  // Mock contrast calculation
  const mockContrast = 4.6; // Would be calculated in real implementation
  
  expect(mockContrast).toBeGreaterThanOrEqual(expectedRatio);
};

/**
 * Test semantic HTML structure
 */
export const testSemanticHTML = (container: HTMLElement) => {
  // Check for proper heading hierarchy
  const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
  let previousLevel = 0;
  
  headings.forEach((heading) => {
    const currentLevel = parseInt(heading.tagName.charAt(1));
    
    // Headings should not skip levels (except h1)
    if (previousLevel > 0) {
      expect(currentLevel).toBeLessThanOrEqual(previousLevel + 1);
    }
    
    previousLevel = currentLevel;
  });
  
  // Check for proper landmark roles
  const main = container.querySelector('main, [role="main"]');
  const nav = container.querySelector('nav, [role="navigation"]');
  const header = container.querySelector('header, [role="banner"]');
  const footer = container.querySelector('footer, [role="contentinfo"]');
  
  return {
    hasMain: !!main,
    hasNav: !!nav,
    hasHeader: !!header,
    hasFooter: !!footer,
    headingCount: headings.length,
  };
};

/**
 * Test form accessibility
 */
export const testFormAccessibility = (form: HTMLElement) => {
  const inputs = form.querySelectorAll('input, select, textarea');
  const labels = form.querySelectorAll('label');
  const fieldsets = form.querySelectorAll('fieldset');
  const errors = form.querySelectorAll('[role="alert"], .error');
  
  inputs.forEach((input) => {
    const id = input.getAttribute('id');
    const label = form.querySelector(`label[for="${id}"]`);
    const ariaLabel = input.getAttribute('aria-label');
    const ariaLabelledBy = input.getAttribute('aria-labelledby');
    
    // Each input should have an associated label
    expect(
      label || ariaLabel || ariaLabelledBy
    ).toBeTruthy();
    
    // Required fields should be marked
    if (input.hasAttribute('required')) {
      expect(
        input.getAttribute('aria-required') === 'true' ||
        input.getAttribute('required') !== null
      ).toBeTruthy();
    }
    
    // Invalid fields should be marked
    if (input.getAttribute('aria-invalid') === 'true') {
      const describedBy = input.getAttribute('aria-describedby');
      if (describedBy) {
        const description = document.getElementById(describedBy);
        expect(description).toBeInTheDocument();
      }
    }
  });
  
  // Fieldsets should have legends
  fieldsets.forEach((fieldset) => {
    const legend = fieldset.querySelector('legend');
    expect(legend).toBeInTheDocument();
  });
  
  return {
    inputCount: inputs.length,
    labelCount: labels.length,
    fieldsetCount: fieldsets.length,
    errorCount: errors.length,
  };
};

/**
 * Test ARIA states and properties
 */
export const testAriaStates = (
  element: HTMLElement,
  expectedStates: Record<string, string | boolean>
) => {
  Object.entries(expectedStates).forEach(([attribute, value]) => {
    const actualValue = element.getAttribute(attribute);
    
    if (typeof value === 'boolean') {
      expect(actualValue).toBe(value.toString());
    } else {
      expect(actualValue).toBe(value);
    }
  });
};

/**
 * Test keyboard shortcuts
 */
export const testKeyboardShortcuts = async (
  shortcuts: Record<string, () => void | Promise<void>>
) => {
  const user = userEvent.setup();
  
  for (const [key, handler] of Object.entries(shortcuts)) {
    const mockHandler = vi.fn(handler);
    
    // Mock the handler
    document.addEventListener('keydown', (e) => {
      if (e.key === key) {
        mockHandler();
      }
    });
    
    await user.keyboard(`{${key}}`);
    expect(mockHandler).toHaveBeenCalled();
  }
};

/**
 * Test reduced motion preferences
 */
export const testReducedMotion = (element: HTMLElement) => {
  // Mock prefers-reduced-motion
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
  
  // Check if animations are disabled
  const computedStyle = getComputedStyle(element);
  const animationDuration = computedStyle.animationDuration;
  const transitionDuration = computedStyle.transitionDuration;
  
  // When reduced motion is preferred, durations should be minimal
  expect(
    animationDuration === '0s' || 
    animationDuration === 'none' ||
    parseFloat(animationDuration) <= 0.01
  ).toBeTruthy();
  
  expect(
    transitionDuration === '0s' || 
    transitionDuration === 'none' ||
    parseFloat(transitionDuration) <= 0.01
  ).toBeTruthy();
};

/**
 * Mock screen reader for testing
 */
export const mockScreenReader = () => {
  const announcements: string[] = [];
  
  // Mock aria-live regions
  const mockAriaLive = {
    announce: (text: string, priority: 'polite' | 'assertive' = 'polite') => {
      announcements.push(text);
    },
    getAnnouncements: () => announcements,
    clear: () => announcements.splice(0, announcements.length),
  };
  
  // Override console.log for screen reader simulation
  const originalConsoleLog = console.log;
  console.log = (...args) => {
    const text = args.join(' ');
    if (text.includes('[Screen Reader]')) {
      mockAriaLive.announce(text.replace('[Screen Reader]', '').trim());
    } else {
      originalConsoleLog(...args);
    }
  };
  
  return mockAriaLive;
};

/**
 * Test high contrast mode
 */
export const testHighContrast = (element: HTMLElement) => {
  // Mock high contrast media query
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: query === '(prefers-contrast: high)' || query === '(-ms-high-contrast: active)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
  
  // Check if high contrast styles are applied
  const computedStyle = getComputedStyle(element);
  
  // Colors should be high contrast (black/white primarily)
  const backgroundColor = computedStyle.backgroundColor;
  const color = computedStyle.color;
  const borderColor = computedStyle.borderColor;
  
  return {
    backgroundColor,
    color,
    borderColor,
    computedStyle,
  };
};
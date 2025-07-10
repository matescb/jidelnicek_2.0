import React from 'react';
import '@testing-library/jest-dom';

// Simple test to verify test setup
describe('RoleManagement Test Setup', () => {
  it('should run a basic test', () => {
    expect(true).toBe(true);
  });

  it('should verify test environment', () => {
    const element = document.createElement('div');
    element.textContent = 'Test';
    expect(element).toHaveTextContent('Test');
  });
});
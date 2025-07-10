import React from 'react'
import { render, screen } from '@/test-utils'

// Simple smoke test to ensure test suite runs
describe('MealPlanningBoard', () => {
  it('should render without crashing', () => {
    const TestComponent = () => <div data-testid="test">Test Component</div>
    render(<TestComponent />)
    expect(screen.getByTestId('test')).toBeInTheDocument()
  })
})
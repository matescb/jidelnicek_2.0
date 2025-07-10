import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CostCalculator } from '../CostCalculator'
import { Decimal } from 'decimal.js'
import { vi } from 'vitest'

// Mock the hooks
vi.mock('@/hooks/useWebSocket', () => ({
  useWebSocketEvent: vi.fn(),
}))

vi.mock('@/hooks/useI18nFormats', () => ({
  useI18nFormats: () => ({
    formatNumber: (value: number, format?: string) => {
      if (format === 'currency') {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
        }).format(value)
      }
      return value.toString()
    },
  }),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) => defaultValue || key,
  }),
}))

describe('CostCalculator', () => {
  const mockIngredients = [
    {
      ingredientId: '1',
      name: 'Tomatoes',
      quantity: new Decimal(2),
      unit: 'kg',
      category: 'produce',
    },
    {
      ingredientId: '2',
      name: 'Milk',
      quantity: new Decimal(3),
      unit: 'l',
      category: 'dairy',
    },
    {
      ingredientId: '3',
      name: 'Chicken',
      quantity: new Decimal(1.5),
      unit: 'kg',
      category: 'meat',
    },
  ]

  const mockParticipants = [
    {
      id: '1',
      name: 'John Doe',
      effectiveCoefficient: 1.0,
      attendanceDays: 7,
    },
    {
      id: '2',
      name: 'Jane Smith',
      effectiveCoefficient: 0.8,
      attendanceDays: 5,
    },
  ]

  const defaultProps = {
    tripId: 'test-trip',
    ingredients: mockIngredients,
    participants: mockParticipants,
    totalDays: 7,
    mealsPerDay: 3,
    budget: 200,
    currency: 'USD',
  }

  it('renders cost calculator with summary information', async () => {
    render(<CostCalculator {...defaultProps} />)

    // Check for main sections
    expect(screen.getByText('Cost Calculator')).toBeInTheDocument()
    expect(screen.getByText('Total Cost')).toBeInTheDocument()
    expect(screen.getByText('Per Participant')).toBeInTheDocument()
    expect(screen.getByText('Per Day')).toBeInTheDocument()
    expect(screen.getByText('Per Meal')).toBeInTheDocument()
  })

  it('displays budget status when budget is provided', () => {
    render(<CostCalculator {...defaultProps} />)

    expect(screen.getByText('Budget Status')).toBeInTheDocument()
    expect(screen.getByText(/Budget:/)).toBeInTheDocument()
  })

  it('does not display budget status when budget is not provided', () => {
    const propsWithoutBudget = { ...defaultProps, budget: undefined }
    render(<CostCalculator {...propsWithoutBudget} />)

    expect(screen.queryByText('Budget Status')).not.toBeInTheDocument()
  })

  it('switches between categories and participants tabs', async () => {
    const user = userEvent.setup()
    render(<CostCalculator {...defaultProps} />)

    // Categories tab should be active by default
    expect(screen.getByRole('tab', { name: /Categories/i })).toHaveAttribute(
      'aria-selected',
      'true'
    )

    // Click on participants tab
    await user.click(screen.getByRole('tab', { name: /Participants/i }))

    // Participants tab should now be active
    expect(screen.getByRole('tab', { name: /Participants/i })).toHaveAttribute(
      'aria-selected',
      'true'
    )

    // Should display participant information
    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
  })

  it('expands and collapses category details', async () => {
    const user = userEvent.setup()
    render(<CostCalculator {...defaultProps} />)

    // Find a category card (e.g., produce)
    const produceCard = screen.getByText('produce').closest('.cursor-pointer')
    expect(produceCard).toBeInTheDocument()

    // Click to expand
    await user.click(produceCard!)

    // Should show ingredient details
    await waitFor(() => {
      expect(screen.getByText('Tomatoes')).toBeInTheDocument()
    })

    // Click to collapse
    await user.click(produceCard!)

    // Should hide ingredient details
    await waitFor(() => {
      expect(screen.queryByText('Tomatoes')).not.toBeInTheDocument()
    })
  })

  it('opens settings dialog', async () => {
    const user = userEvent.setup()
    render(<CostCalculator {...defaultProps} />)

    // Find and click settings button
    const settingsButton = screen.getByRole('button', { name: '' })
    await user.click(settingsButton)

    // Settings dialog should open
    expect(screen.getByText('Settings')).toBeInTheDocument()
    expect(screen.getByText('Price Strategy')).toBeInTheDocument()
    expect(screen.getByText('Currency')).toBeInTheDocument()
    expect(screen.getByText('Live Updates')).toBeInTheDocument()
  })

  it('exports cost report', async () => {
    const user = userEvent.setup()
    
    // Mock URL.createObjectURL and document.createElement
    const mockCreateObjectURL = vi.fn(() => 'blob:test')
    const mockRevokeObjectURL = vi.fn()
    const mockClick = vi.fn()
    
    global.URL.createObjectURL = mockCreateObjectURL
    global.URL.revokeObjectURL = mockRevokeObjectURL
    
    const mockAnchor = {
      href: '',
      download: '',
      click: mockClick,
    }
    
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'a') {
        return mockAnchor as any
      }
      return document.createElement(tagName)
    })

    render(<CostCalculator {...defaultProps} />)

    // Find and click export button
    const exportButton = screen.getAllByRole('button').find(
      btn => btn.querySelector('svg')?.getAttribute('class')?.includes('h-4 w-4')
    )
    
    await user.click(exportButton!)

    // Verify export functionality
    expect(mockCreateObjectURL).toHaveBeenCalled()
    expect(mockClick).toHaveBeenCalled()
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:test')
    expect(mockAnchor.download).toContain('trip-test-trip-cost-report')
  })

  it('displays correct currency formatting', () => {
    render(<CostCalculator {...defaultProps} currency="EUR" />)

    // The component should render without errors
    expect(screen.getByText('Cost Calculator')).toBeInTheDocument()
  })

  it('shows over budget warning when applicable', () => {
    // Set a low budget to trigger over budget status
    render(<CostCalculator {...defaultProps} budget={50} />)

    // Should show over budget warning
    expect(screen.getByText(/Estimated costs exceed budget/)).toBeInTheDocument()
  })

  it('calculates costs for different numbers of meals per day', () => {
    const { rerender } = render(<CostCalculator {...defaultProps} mealsPerDay={3} />)

    expect(screen.getByText(/21 meals/)).toBeInTheDocument() // 7 days * 3 meals

    rerender(<CostCalculator {...defaultProps} mealsPerDay={4} />)

    expect(screen.getByText(/28 meals/)).toBeInTheDocument() // 7 days * 4 meals
  })

  it('handles empty ingredients list', () => {
    render(<CostCalculator {...defaultProps} ingredients={[]} />)

    // Should still render without errors
    expect(screen.getByText('Cost Calculator')).toBeInTheDocument()
    expect(screen.getByText('$0.00')).toBeInTheDocument()
  })

  it('handles empty participants list', () => {
    render(<CostCalculator {...defaultProps} participants={[]} />)

    // Should still render without errors
    expect(screen.getByText('Cost Calculator')).toBeInTheDocument()
  })

  it('displays participant coefficients correctly', async () => {
    const user = userEvent.setup()
    render(<CostCalculator {...defaultProps} />)

    // Switch to participants tab
    await user.click(screen.getByRole('tab', { name: /Participants/i }))

    // Check coefficient display
    expect(screen.getByText(/Coefficient: 1x/)).toBeInTheDocument()
    expect(screen.getByText(/Coefficient: 0.8x/)).toBeInTheDocument()
  })

  it('shows live update indicator when enabled', () => {
    render(<CostCalculator {...defaultProps} />)

    // Should show live indicator
    expect(screen.getByText('Live')).toBeInTheDocument()
  })
})
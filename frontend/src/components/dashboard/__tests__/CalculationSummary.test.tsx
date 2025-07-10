import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { CalculationSummary } from '../CalculationSummary'
import { websocketService } from '@/services/websocket'
import { useTripStore } from '@/store/slices/tripStore'
import { useWebSocketContext } from '@/context/WebSocketContext'
import type { 
  CostCalculationUpdateEvent,
  NutritionSummaryUpdateEvent,
  ShoppingListUpdateEvent 
} from '@/types/websocket'

// Mock dependencies
vi.mock('@/services/websocket')
vi.mock('@/store/slices/tripStore')
vi.mock('@/context/WebSocketContext')
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: any) => {
      if (params) {
        return `${key} ${JSON.stringify(params)}`
      }
      return key
    }
  })
}))

// Mock Lucide icons
vi.mock('lucide-react', () => ({
  TrendingUp: () => <div>TrendingUp</div>,
  TrendingDown: () => <div>TrendingDown</div>,
  DollarSign: () => <div>DollarSign</div>,
  Activity: () => <div>Activity</div>,
  ShoppingCart: () => <div>ShoppingCart</div>,
  Users: () => <div>Users</div>,
  Calendar: () => <div>Calendar</div>,
  AlertCircle: () => <div>AlertCircle</div>,
  RefreshCw: () => <div>RefreshCw</div>,
}))

describe('CalculationSummary', () => {
  const mockTrip = {
    id: '1',
    name: 'Test Trip',
    participantCount: 10,
    days: [
      { id: '1', dayNumber: 1 },
      { id: '2', dayNumber: 2 },
      { id: '3', dayNumber: 3 }
    ],
    status: 'active' as const
  }

  const mockWebSocketContext = {
    isConnected: true,
    connectionStatus: 'connected' as const
  }

  const mockTripStore = {
    currentTrip: mockTrip,
    loading: false,
    fetchTrip: vi.fn()
  }

  const mockOnMetricClick = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    ;(useWebSocketContext as any).mockReturnValue(mockWebSocketContext)
    ;(useTripStore as any).mockReturnValue(mockTripStore)
    ;(websocketService.subscribe as any).mockReturnValue(() => {})
    ;(websocketService.emit as any).mockResolvedValue(undefined)
  })

  it('renders without trip data', () => {
    (useTripStore as any).mockReturnValue({
      ...mockTripStore,
      currentTrip: null
    })

    render(<CalculationSummary />)
    
    expect(screen.getByText('dashboard.calculationSummary.title')).toBeInTheDocument()
    expect(screen.getByText('dashboard.calculationSummary.noTripSelected')).toBeInTheDocument()
  })

  it('renders with trip data', () => {
    render(<CalculationSummary tripId="1" />)
    
    expect(screen.getByText('Test Trip')).toBeInTheDocument()
    expect(screen.getByText('10 dashboard.calculationSummary.participants • 3 dashboard.calculationSummary.days')).toBeInTheDocument()
  })

  it('displays loading state', () => {
    (useTripStore as any).mockReturnValue({
      ...mockTripStore,
      loading: true
    })

    render(<CalculationSummary tripId="1" />)
    
    // Should show skeleton loaders
    expect(document.querySelectorAll('[class*="skeleton"]').length).toBeGreaterThan(0)
  })

  it('handles metric click events', () => {
    render(<CalculationSummary tripId="1" onMetricClick={mockOnMetricClick} />)
    
    // Click on cost metric
    const costCard = screen.getByText('dashboard.calculationSummary.totalCost').closest('.card')
    fireEvent.click(costCard!)
    
    expect(mockOnMetricClick).toHaveBeenCalledWith('cost')
  })

  it('displays offline warning when disconnected', () => {
    (useWebSocketContext as any).mockReturnValue({
      isConnected: false,
      connectionStatus: 'disconnected'
    })

    render(<CalculationSummary tripId="1" />)
    
    expect(screen.getByText('dashboard.calculationSummary.offline')).toBeInTheDocument()
  })

  it('subscribes to WebSocket events when connected', () => {
    const mockSubscribe = vi.fn().mockReturnValue(() => {})
    ;(websocketService.subscribe as any).mockImplementation(mockSubscribe)

    render(<CalculationSummary tripId="1" />)
    
    expect(mockSubscribe).toHaveBeenCalledWith('cost:calculation-update', expect.any(Function))
    expect(mockSubscribe).toHaveBeenCalledWith('nutrition:summary-update', expect.any(Function))
    expect(mockSubscribe).toHaveBeenCalledWith('shopping-list:update', expect.any(Function))
  })

  it('updates cost data on WebSocket event', async () => {
    let costUpdateHandler: any
    ;(websocketService.subscribe as any).mockImplementation((event: string, handler: any) => {
      if (event === 'cost:calculation-update') {
        costUpdateHandler = handler
      }
      return () => {}
    })

    render(<CalculationSummary tripId="1" />)
    
    // Simulate cost update event
    const costEvent: CostCalculationUpdateEvent = {
      tripId: '1',
      totalCost: 1500,
      costPerParticipant: 150,
      breakdown: {
        ingredients: 1200,
        overhead: 200,
        tax: 100
      },
      participantBreakdown: [],
      currency: 'USD',
      calculatedAt: new Date().toISOString()
    }

    await waitFor(() => {
      costUpdateHandler({ payload: costEvent })
    })

    expect(screen.getByText(/\$1,500\.00/)).toBeInTheDocument()
    expect(screen.getByText(/\$150\.00.*dashboard\.calculationSummary\.perPerson/)).toBeInTheDocument()
  })

  it('displays nutrition warnings', async () => {
    let nutritionUpdateHandler: any
    ;(websocketService.subscribe as any).mockImplementation((event: string, handler: any) => {
      if (event === 'nutrition:summary-update') {
        nutritionUpdateHandler = handler
      }
      return () => {}
    })

    render(<CalculationSummary tripId="1" />)
    
    // Simulate nutrition update event with warnings
    const nutritionEvent: NutritionSummaryUpdateEvent = {
      tripId: '1',
      dailyAverages: {
        calories: 2500,
        protein: 90,
        carbs: 300,
        fat: 80,
        fiber: 25,
        sodium: 2000
      },
      perMealAverages: {
        breakfast: { calories: 600, protein: 20, carbs: 80, fat: 20, fiber: 8, sodium: 500 },
        lunch: { calories: 900, protein: 35, carbs: 110, fat: 30, fiber: 9, sodium: 700 },
        dinner: { calories: 1000, protein: 35, carbs: 110, fat: 30, fiber: 8, sodium: 800 }
      },
      warnings: [
        'High sodium content detected',
        'Low fiber in breakfast meals',
        'Calorie distribution uneven'
      ],
      calculatedAt: new Date().toISOString()
    }

    await waitFor(() => {
      nutritionUpdateHandler({ payload: nutritionEvent })
    })

    expect(screen.getByText('dashboard.calculationSummary.nutritionWarnings')).toBeInTheDocument()
    expect(screen.getByText('• High sodium content detected')).toBeInTheDocument()
  })

  it('handles refresh button click', async () => {
    render(<CalculationSummary tripId="1" />)
    
    const refreshButton = screen.getByRole('button', { name: /RefreshCw/i }).parentElement
    fireEvent.click(refreshButton!)
    
    expect(mockTripStore.fetchTrip).toHaveBeenCalledWith('1')
    expect(websocketService.emit).toHaveBeenCalledWith('request:calculations', { tripId: '1' })
  })

  it('shows sparkline trends when data history exists', async () => {
    let costUpdateHandler: any
    ;(websocketService.subscribe as any).mockImplementation((event: string, handler: any) => {
      if (event === 'cost:calculation-update') {
        costUpdateHandler = handler
      }
      return () => {}
    })

    render(<CalculationSummary tripId="1" />)
    
    // Simulate multiple cost updates to build history
    for (let i = 0; i < 3; i++) {
      const costEvent: CostCalculationUpdateEvent = {
        tripId: '1',
        totalCost: 1000 + (i * 100),
        costPerParticipant: 100 + (i * 10),
        breakdown: { ingredients: 800, overhead: 150, tax: 50 },
        participantBreakdown: [],
        currency: 'USD',
        calculatedAt: new Date().toISOString()
      }
      
      await waitFor(() => {
        costUpdateHandler({ payload: costEvent })
      })
    }

    // Should show trend chart
    expect(screen.getByText('dashboard.calculationSummary.costTrend')).toBeInTheDocument()
    expect(document.querySelector('svg')).toBeInTheDocument()
  })

  it('fetches trip when tripId changes', () => {
    const { rerender } = render(<CalculationSummary />)
    
    expect(mockTripStore.fetchTrip).not.toHaveBeenCalled()
    
    rerender(<CalculationSummary tripId="2" />)
    
    expect(mockTripStore.fetchTrip).toHaveBeenCalledWith('2')
  })

  it('cleans up subscriptions on unmount', () => {
    const unsubscribeMock = vi.fn()
    ;(websocketService.subscribe as any).mockReturnValue(unsubscribeMock)

    const { unmount } = render(<CalculationSummary tripId="1" />)
    
    unmount()
    
    expect(unsubscribeMock).toHaveBeenCalledTimes(3) // Cost, nutrition, and shopping subscriptions
  })
})
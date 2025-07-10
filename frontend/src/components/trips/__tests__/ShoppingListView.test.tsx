import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ShoppingListView } from '../ShoppingListView'
import { useTripStore } from '@/store/slices/tripStore'
import type { Trip, ShoppingListItem } from '@/store/slices/tripStore'

// Mock the store
jest.mock('@/store/slices/tripStore')
jest.mock('@/hooks/useWebSocket', () => ({
  useWebSocketEvent: jest.fn(),
  useTripWebSocket: jest.fn(() => ({ onTripEvent: jest.fn() }))
}))

// Mock toast
jest.mock('@/components/ui/Toast', () => ({
  toast: jest.fn()
}))

const mockTrip: Trip = {
  id: 'test-trip-1',
  name: 'Test Trip',
  description: 'Test description',
  startDate: '2024-07-01',
  endDate: '2024-07-07',
  participantCount: 4,
  status: 'planning',
  mealSlotConfiguration: [],
  participants: [],
  days: [],
  userId: 'test-user',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
}

const mockShoppingList: ShoppingListItem[] = [
  {
    ingredientId: '1',
    name: 'Tomatoes',
    quantity: 2,
    unit: 'kg',
    category: 'produce',
    recipes: ['Salad', 'Pasta']
  },
  {
    ingredientId: '2',
    name: 'Milk',
    quantity: 1,
    unit: 'l',
    category: 'dairy',
    recipes: ['Cereal']
  },
  {
    ingredientId: '3',
    name: 'Bread',
    quantity: 2,
    unit: 'piece',
    category: 'bakery',
    recipes: ['Sandwiches']
  }
]

describe('ShoppingListView', () => {
  const mockGenerateShoppingList = jest.fn()
  
  beforeEach(() => {
    (useTripStore as unknown as jest.Mock).mockReturnValue({
      shoppingList: mockShoppingList,
      shoppingListLoading: false,
      generateShoppingList: mockGenerateShoppingList
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('renders shopping list with categories', () => {
    render(<ShoppingListView trip={mockTrip} />)
    
    expect(screen.getByText('Shopping List')).toBeInTheDocument()
    expect(screen.getByText('3 items')).toBeInTheDocument()
    expect(screen.getByText('Fruits & Vegetables')).toBeInTheDocument()
    expect(screen.getByText('Dairy & Eggs')).toBeInTheDocument()
    expect(screen.getByText('Bakery')).toBeInTheDocument()
  })

  it('displays items within categories', () => {
    render(<ShoppingListView trip={mockTrip} />)
    
    expect(screen.getByText('Tomatoes')).toBeInTheDocument()
    expect(screen.getByText('2 kg')).toBeInTheDocument()
    expect(screen.getByText('Salad, Pasta')).toBeInTheDocument()
    
    expect(screen.getByText('Milk')).toBeInTheDocument()
    expect(screen.getByText('1 l')).toBeInTheDocument()
    
    expect(screen.getByText('Bread')).toBeInTheDocument()
    expect(screen.getByText('2 piece')).toBeInTheDocument()
  })

  it('shows loading state', () => {
    (useTripStore as unknown as jest.Mock).mockReturnValue({
      shoppingList: [],
      shoppingListLoading: true,
      generateShoppingList: mockGenerateShoppingList
    })
    
    render(<ShoppingListView trip={mockTrip} />)
    
    expect(screen.getByText('Loading shopping list...')).toBeInTheDocument()
  })

  it('shows empty state when no items', () => {
    (useTripStore as unknown as jest.Mock).mockReturnValue({
      shoppingList: [],
      shoppingListLoading: false,
      generateShoppingList: mockGenerateShoppingList
    })
    
    render(<ShoppingListView trip={mockTrip} />)
    
    expect(screen.getByText('No shopping list generated yet')).toBeInTheDocument()
    expect(screen.getByText('Generate Shopping List')).toBeInTheDocument()
  })

  it('can collapse and expand categories', () => {
    render(<ShoppingListView trip={mockTrip} />)
    
    const produceHeader = screen.getByText('Fruits & Vegetables').closest('div')
    expect(produceHeader).toBeInTheDocument()
    
    // Items should be visible initially
    expect(screen.getByText('Tomatoes')).toBeVisible()
    
    // Click to collapse
    fireEvent.click(produceHeader!)
    
    // Items should be hidden
    expect(screen.queryByText('Tomatoes')).not.toBeInTheDocument()
    
    // Click to expand
    fireEvent.click(produceHeader!)
    
    // Items should be visible again
    expect(screen.getByText('Tomatoes')).toBeVisible()
  })

  it('displays summary statistics', () => {
    render(<ShoppingListView trip={mockTrip} />)
    
    expect(screen.getByText('Total Items')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    
    expect(screen.getByText('Categories')).toBeInTheDocument()
    // 3 categories in our mock data
    expect(screen.getAllByText('3').length).toBeGreaterThan(0)
  })

  it('calls refresh when refresh button clicked', () => {
    render(<ShoppingListView trip={mockTrip} />)
    
    const refreshButton = screen.getByText('Refresh').closest('button')
    fireEvent.click(refreshButton!)
    
    expect(mockGenerateShoppingList).toHaveBeenCalledWith(mockTrip.id)
  })

  it('exports to CSV when export button clicked', () => {
    // Mock URL.createObjectURL
    global.URL.createObjectURL = jest.fn(() => 'blob:test')
    global.URL.revokeObjectURL = jest.fn()
    
    // Mock document.createElement
    const mockAnchor = document.createElement('a')
    const clickSpy = jest.spyOn(mockAnchor, 'click')
    jest.spyOn(document, 'createElement').mockReturnValueOnce(mockAnchor)
    
    render(<ShoppingListView trip={mockTrip} />)
    
    const csvButton = screen.getByText('CSV').closest('button')
    fireEvent.click(csvButton!)
    
    expect(mockAnchor.download).toBe('Test Trip-shopping-list.csv')
    expect(clickSpy).toHaveBeenCalled()
  })

  it('triggers print when print button clicked', () => {
    const printSpy = jest.spyOn(window, 'print').mockImplementation()
    
    render(<ShoppingListView trip={mockTrip} />)
    
    const printButton = screen.getByText('Print').closest('button')
    fireEvent.click(printButton!)
    
    expect(printSpy).toHaveBeenCalled()
    
    printSpy.mockRestore()
  })

  it('applies custom className', () => {
    const { container } = render(
      <ShoppingListView trip={mockTrip} className="custom-class" />
    )
    
    expect(container.querySelector('.custom-class')).toBeInTheDocument()
  })

  it('calculates category totals correctly', () => {
    render(<ShoppingListView trip={mockTrip} />)
    
    // Check that category headers show item counts
    const produceCategory = screen.getByText('Fruits & Vegetables').parentElement
    expect(produceCategory).toHaveTextContent('1') // 1 item in produce
    
    const dairyCategory = screen.getByText('Dairy & Eggs').parentElement
    expect(dairyCategory).toHaveTextContent('1') // 1 item in dairy
  })
})
import React from 'react'
import { ShoppingListView } from './ShoppingListView'
import type { Trip } from '@/store/slices/tripStore'

/**
 * Example usage of ShoppingListView component
 * 
 * This component provides a read-only view of the shopping list
 * with the following features:
 * - Category grouping with collapsible sections
 * - Visual hierarchy with category headers
 * - Total counts and weights per category
 * - Export to CSV and PDF
 * - Mobile-optimized layout
 * - Real-time updates via WebSocket
 */

interface ShoppingListViewExampleProps {
  trip: Trip
}

export const ShoppingListViewExample: React.FC<ShoppingListViewExampleProps> = ({ trip }) => {
  return (
    <div className="container mx-auto p-4">
      {/* Basic usage */}
      <ShoppingListView trip={trip} />

      {/* With custom styling */}
      <ShoppingListView 
        trip={trip} 
        className="mt-8 bg-gray-50 dark:bg-gray-900 rounded-lg p-6"
      />

      {/* As part of a larger trip detail view */}
      <div className="mt-8 space-y-8">
        <section>
          <h2 className="text-2xl font-bold mb-4">Trip Details</h2>
          {/* Other trip information */}
        </section>

        <section>
          <ShoppingListView trip={trip} />
        </section>
      </div>

      {/* In a modal or drawer */}
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 hidden">
        <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto p-6">
          <ShoppingListView trip={trip} />
        </div>
      </div>
    </div>
  )
}

// Example of how to use in a parent component
export const ParentComponentExample: React.FC = () => {
  // Fetch trip data from store or API
  const trip = useTripStore(state => state.currentTrip)

  if (!trip) {
    return <div>Loading trip...</div>
  }

  return (
    <div>
      {/* Shopping list as a tab */}
      <div className="tabs">
        <button className="tab">Overview</button>
        <button className="tab">Participants</button>
        <button className="tab active">Shopping List</button>
      </div>

      <div className="tab-content">
        <ShoppingListView trip={trip} />
      </div>
    </div>
  )
}

// Integration with print functionality
export const PrintableShoppingList: React.FC<{ trip: Trip }> = ({ trip }) => {
  const handlePrint = () => {
    // The component already has print styles
    window.print()
  }

  return (
    <div>
      <div className="mb-4 print:hidden">
        <button 
          onClick={handlePrint}
          className="btn btn-primary"
        >
          Print Shopping List
        </button>
      </div>

      <ShoppingListView trip={trip} />
    </div>
  )
}
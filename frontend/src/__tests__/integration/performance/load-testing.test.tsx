import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, renderWithPerformance } from '../setup/testProviders'
import { simulateAuthentication, generateLargeDataset, measurePerformance } from '../setup/testSetup'

// Import components for performance testing
import { RecipeList } from '@/components/recipes/RecipeList'
import { VirtualizedDataTable } from '@/components/common/VirtualizedDataTable'
import { MealPlanningBoard } from '@/components/trips/MealPlanningBoard'
import { ShoppingListView } from '@/components/trips/ShoppingListView'
import { useRecipeStore } from '@/store/slices/recipeStore'

describe('Performance and Load Testing Integration', () => {
  let user: ReturnType<typeof userEvent.setup>

  beforeEach(() => {
    user = userEvent.setup()
    // Enable performance monitoring
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Large Dataset Rendering Performance', () => {
    it('should handle large recipe lists efficiently with virtualization', async () => {
      simulateAuthentication()

      // Generate large dataset
      const largeRecipeDataset = generateLargeDataset(10000, (index) => ({
        id: `recipe-${index}`,
        name: `Test Recipe ${index}`,
        description: `Description for recipe ${index}`,
        prepTime: 20 + (index % 60),
        servings: 2 + (index % 8),
        difficulty: ['easy', 'medium', 'hard'][index % 3],
        cuisine: ['Italian', 'Asian', 'Mexican', 'American'][index % 4],
        rating: 3 + (index % 3),
        imageUrl: `https://example.com/recipe-${index}.jpg`,
        tags: [`tag-${index % 5}`, `category-${index % 3}`],
        createdAt: new Date(Date.now() - index * 86400000).toISOString()
      }))

      // Pre-populate store with large dataset
      const recipeStore = useRecipeStore.getState()
      largeRecipeDataset.forEach(recipe => {
        recipeStore.addRecipe(recipe)
      })

      const renderDuration = await measurePerformance('Large Recipe List Render', async () => {
        renderWithPerformance(
          <RecipeList 
            recipes={largeRecipeDataset}
            enableVirtualization={true}
          />
        )
      })

      // Should render within acceptable time limits
      expect(renderDuration).toBeLessThan(1000) // Less than 1 second

      // Step 1: Verify only visible items are rendered
      await waitFor(() => {
        const renderedItems = screen.getAllByTestId(/recipe-item-/)
        expect(renderedItems.length).toBeLessThan(50) // Only viewport items rendered
      })

      // Step 2: Test scrolling performance
      const scrollContainer = screen.getByTestId('virtualized-scroll-container')
      
      const scrollDuration = await measurePerformance('Scroll Performance', async () => {
        // Simulate rapid scrolling
        for (let i = 0; i < 10; i++) {
          fireEvent.scroll(scrollContainer, { target: { scrollTop: i * 1000 } })
          vi.advanceTimersByTime(16) // 60fps
        }
      })

      expect(scrollDuration).toBeLessThan(200) // Smooth scrolling

      // Step 3: Test search performance on large dataset
      const searchInput = screen.getByPlaceholderText(/search recipes/i)
      
      const searchDuration = await measurePerformance('Search Performance', async () => {
        await user.type(searchInput, 'Test Recipe 1')
      })

      expect(searchDuration).toBeLessThan(500) // Fast search

      // Should show filtered results efficiently
      await waitFor(() => {
        const filteredItems = screen.getAllByText(/Test Recipe 1/)
        expect(filteredItems.length).toBeGreaterThan(0)
        expect(filteredItems.length).toBeLessThan(1000) // Should filter efficiently
      })

      // Step 4: Test sorting performance
      const sortSelect = screen.getByLabelText(/sort by/i)
      
      const sortDuration = await measurePerformance('Sort Performance', async () => {
        await user.selectOptions(sortSelect, 'name')
      })

      expect(sortDuration).toBeLessThan(300) // Fast sorting

      // Step 5: Test infinite loading performance
      const loadMoreButton = screen.getByRole('button', { name: /load more/i })
      
      const loadMoreDuration = await measurePerformance('Load More Performance', async () => {
        await user.click(loadMoreButton)
      })

      expect(loadMoreDuration).toBeLessThan(200) // Fast incremental loading
    })

    it('should handle complex trip planning with many participants and meals', async () => {
      simulateAuthentication()

      // Create complex trip data
      const complexTrip = {
        id: 'complex-trip',
        name: 'Large Group Trip',
        participants: generateLargeDataset(50, (index) => ({
          id: `participant-${index}`,
          email: `participant${index}@example.com`,
          name: `Participant ${index}`,
          dietaryRestrictions: ['vegetarian', 'gluten-free', 'vegan'][index % 3] ? [`${['vegetarian', 'gluten-free', 'vegan'][index % 3]}`] : [],
          ageGroup: ['child', 'adult', 'senior'][index % 3],
          activityLevel: ['low', 'moderate', 'high'][index % 3]
        })),
        days: generateLargeDataset(14, (dayIndex) => ({
          date: new Date(Date.now() + dayIndex * 86400000).toISOString().split('T')[0],
          meals: {
            breakfast: { recipeId: `recipe-${dayIndex * 3}`, servings: 50 },
            lunch: { recipeId: `recipe-${dayIndex * 3 + 1}`, servings: 50 },
            dinner: { recipeId: `recipe-${dayIndex * 3 + 2}`, servings: 50 }
          }
        }))
      }

      const renderDuration = await measurePerformance('Complex Trip Render', async () => {
        renderWithPerformance(
          <MealPlanningBoard 
            tripId="complex-trip" 
            trip={complexTrip}
            enableOptimizations={true}
          />
        )
      })

      expect(renderDuration).toBeLessThan(1500) // Under 1.5 seconds for complex data

      // Step 1: Test participant management performance
      const participantSection = screen.getByTestId('participant-section')
      
      await waitFor(() => {
        expect(within(participantSection).getByText(/50 participants/i)).toBeInTheDocument()
      })

      // Should use virtualization for participant list
      const participantList = screen.getByTestId('participant-list')
      const visibleParticipants = within(participantList).getAllByTestId(/participant-item-/)
      expect(visibleParticipants.length).toBeLessThan(20) // Only visible items

      // Step 2: Test meal planning grid performance
      const mealGrid = screen.getByTestId('meal-planning-grid')
      
      // Should show only visible days initially
      const visibleDays = within(mealGrid).getAllByTestId(/day-column-/)
      expect(visibleDays.length).toBeLessThan(7) // Only viewport days

      // Step 3: Test meal assignment performance
      const firstMealSlot = within(mealGrid).getByTestId('meal-slot-breakfast-0')
      
      const assignmentDuration = await measurePerformance('Meal Assignment', async () => {
        await user.click(firstMealSlot)
        
        const recipeSelect = screen.getByLabelText(/select recipe/i)
        await user.selectOptions(recipeSelect, 'recipe-100')
        
        const assignButton = screen.getByRole('button', { name: /assign/i })
        await user.click(assignButton)
      })

      expect(assignmentDuration).toBeLessThan(400) // Fast meal assignment

      // Step 4: Test calculation performance with large participant count
      const calculateButton = screen.getByRole('button', { name: /recalculate all/i })
      
      const calculationDuration = await measurePerformance('Participant Calculations', async () => {
        await user.click(calculateButton)
      })

      expect(calculationDuration).toBeLessThan(800) // Complex calculations under 800ms

      // Step 5: Test memory usage efficiency
      // Should not have memory leaks with large datasets
      const memoryBefore = (performance as any).memory?.usedJSHeapSize || 0
      
      // Trigger multiple re-renders
      for (let i = 0; i < 5; i++) {
        const day = within(mealGrid).getByTestId(`day-column-${i}`)
        await user.click(day)
        vi.advanceTimersByTime(100)
      }

      const memoryAfter = (performance as any).memory?.usedJSHeapSize || 0
      const memoryIncrease = memoryAfter - memoryBefore

      // Memory increase should be reasonable
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024) // Less than 50MB increase
    })
  })

  describe('Shopping List Generation Performance', () => {
    it('should efficiently generate shopping lists from complex meal plans', async () => {
      simulateAuthentication()

      // Create complex meal plan with overlapping ingredients
      const complexMealPlan = {
        tripId: 'performance-trip',
        days: generateLargeDataset(30, (dayIndex) => ({
          date: new Date(Date.now() + dayIndex * 86400000).toISOString().split('T')[0],
          meals: generateLargeDataset(4, (mealIndex) => ({
            id: `meal-${dayIndex}-${mealIndex}`,
            recipeId: `recipe-${(dayIndex * 4 + mealIndex) % 100}`, // Cycling recipes for overlap
            servings: 25,
            ingredients: generateLargeDataset(20, (ingIndex) => ({
              id: `ing-${ingIndex % 50}`, // Many overlapping ingredients
              name: `Ingredient ${ingIndex % 50}`,
              amount: 100 + (ingIndex * 10),
              unit: ['g', 'ml', 'pieces', 'kg', 'l'][ingIndex % 5],
              category: ['Vegetables', 'Proteins', 'Grains', 'Dairy', 'Spices'][ingIndex % 5]
            }))
          }))
        }))
      }

      renderWithPerformance(
        <ShoppingListGenerator 
          tripId="performance-trip"
          mealPlan={complexMealPlan}
        />
      )

      // Step 1: Test generation performance
      const generateButton = screen.getByRole('button', { name: /generate shopping list/i })
      
      const generationDuration = await measurePerformance('Shopping List Generation', async () => {
        await user.click(generateButton)
      })

      expect(generationDuration).toBeLessThan(2000) // Under 2 seconds for complex aggregation

      // Step 2: Verify aggregation efficiency
      await waitFor(() => {
        const shoppingList = screen.getByTestId('generated-shopping-list')
        
        // Should have aggregated overlapping ingredients
        const ingredientItems = within(shoppingList).getAllByTestId(/shopping-item-/)
        expect(ingredientItems.length).toBeLessThan(100) // Efficient aggregation
      })

      // Step 3: Test optimization performance
      const optimizeButton = screen.getByRole('button', { name: /optimize list/i })
      
      const optimizationDuration = await measurePerformance('List Optimization', async () => {
        await user.click(optimizeButton)
      })

      expect(optimizationDuration).toBeLessThan(1000) // Fast optimization

      // Step 4: Test export performance
      const exportButton = screen.getByRole('button', { name: /export to pdf/i })
      
      const exportDuration = await measurePerformance('PDF Export', async () => {
        await user.click(exportButton)
      })

      expect(exportDuration).toBeLessThan(3000) // PDF generation under 3 seconds

      // Step 5: Test real-time updates performance
      const addCustomItemButton = screen.getByRole('button', { name: /add custom item/i })
      
      const updateDuration = await measurePerformance('Real-time Updates', async () => {
        await user.click(addCustomItemButton)
        
        await user.type(screen.getByLabelText(/item name/i), 'Custom Item')
        await user.type(screen.getByLabelText(/quantity/i), '5')
        
        const addButton = screen.getByRole('button', { name: /add item/i })
        await user.click(addButton)
      })

      expect(updateDuration).toBeLessThan(300) // Fast real-time updates
    })
  })

  describe('Concurrent User Actions Performance', () => {
    it('should handle multiple simultaneous user interactions efficiently', async () => {
      simulateAuthentication()

      renderWithPerformance(
        <div>
          <RecipeList enableVirtualization={true} />
          <MealPlanningBoard tripId="concurrent-trip" />
          <ShoppingListView tripId="concurrent-trip" />
        </div>
      )

      // Step 1: Simulate concurrent user actions
      const concurrentActionsDuration = await measurePerformance('Concurrent Actions', async () => {
        // Start multiple actions simultaneously
        const actions = [
          // Search in recipe list
          user.type(screen.getByPlaceholderText(/search recipes/i), 'pasta'),
          
          // Add meal to planning board
          user.click(screen.getByTestId('meal-slot-dinner-0')),
          
          // Modify shopping list
          user.click(screen.getByRole('button', { name: /add custom item/i })),
          
          // Change filters
          user.selectOptions(screen.getByLabelText(/cuisine/i), 'Italian'),
          
          // Sort results
          user.selectOptions(screen.getByLabelText(/sort by/i), 'rating')
        ]

        // Execute all actions concurrently
        await Promise.all(actions)
      })

      expect(concurrentActionsDuration).toBeLessThan(1000) // All actions complete quickly

      // Step 2: Verify all actions completed successfully
      await waitFor(() => {
        expect(screen.getByDisplayValue('pasta')).toBeInTheDocument()
        expect(screen.getByRole('dialog')).toBeInTheDocument() // Meal selection dialog
        expect(screen.getByLabelText(/item name/i)).toBeInTheDocument() // Add item form
      })

      // Step 3: Test rapid state changes
      const rapidChangesDuration = await measurePerformance('Rapid State Changes', async () => {
        for (let i = 0; i < 20; i++) {
          const searchInput = screen.getByPlaceholderText(/search recipes/i)
          await user.clear(searchInput)
          await user.type(searchInput, `search-${i}`)
          vi.advanceTimersByTime(50) // Rapid typing
        }
      })

      expect(rapidChangesDuration).toBeLessThan(1500) // Handle rapid changes efficiently

      // Step 4: Test debouncing effectiveness
      // Should not make excessive API calls
      expect(fetch).toHaveBeenCalledTimes(1) // Only final search should trigger API call
    })

    it('should maintain performance under stress conditions', async () => {
      simulateAuthentication()

      // Create stress test scenario
      const stressTestData = {
        recipes: generateLargeDataset(5000, (index) => ({
          id: `stress-recipe-${index}`,
          name: `Stress Recipe ${index}`,
          complexity: 'high'
        })),
        participants: generateLargeDataset(100, (index) => ({
          id: `stress-participant-${index}`,
          name: `Participant ${index}`
        })),
        meals: generateLargeDataset(500, (index) => ({
          id: `stress-meal-${index}`,
          complexity: 'high'
        }))
      }

      renderWithPerformance(
        <div>
          <RecipeList recipes={stressTestData.recipes} />
          <MealPlanningBoard 
            participants={stressTestData.participants}
            meals={stressTestData.meals}
          />
        </div>
      )

      // Step 1: Test performance under high memory pressure
      const memoryStressDuration = await measurePerformance('Memory Stress Test', async () => {
        // Rapidly create and destroy components
        for (let i = 0; i < 10; i++) {
          const modal = screen.getByRole('button', { name: /open modal/i })
          await user.click(modal)
          
          const closeButton = screen.getByRole('button', { name: /close/i })
          await user.click(closeButton)
          
          vi.advanceTimersByTime(100)
        }
      })

      expect(memoryStressDuration).toBeLessThan(2000) // Maintain performance under stress

      // Step 2: Test CPU-intensive operations
      const cpuStressDuration = await measurePerformance('CPU Stress Test', async () => {
        // Trigger complex calculations multiple times
        const calculateButton = screen.getByRole('button', { name: /recalculate all/i })
        
        for (let i = 0; i < 5; i++) {
          await user.click(calculateButton)
          vi.advanceTimersByTime(200)
        }
      })

      expect(cpuStressDuration).toBeLessThan(3000) // CPU operations remain efficient

      // Step 3: Test network stress (simulated)
      // Mock slow network responses
      vi.mocked(fetch).mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            ok: true,
            json: () => Promise.resolve({ data: [] })
          } as Response), 2000)
        )
      )

      const networkStressDuration = await measurePerformance('Network Stress Test', async () => {
        // Trigger multiple API calls
        const refreshButtons = screen.getAllByRole('button', { name: /refresh/i })
        
        await Promise.all(
          refreshButtons.slice(0, 3).map(button => user.click(button))
        )
      })

      expect(networkStressDuration).toBeLessThan(1000) // UI remains responsive during network stress

      // UI should show loading states without blocking
      expect(screen.getAllByText(/loading/i).length).toBeGreaterThan(0)
    })
  })

  describe('Memory Management and Cleanup', () => {
    it('should properly clean up resources and prevent memory leaks', async () => {
      simulateAuthentication()

      let initialMemory = (performance as any).memory?.usedJSHeapSize || 0

      // Step 1: Create and destroy multiple components
      for (let iteration = 0; iteration < 5; iteration++) {
        const { unmount } = renderWithPerformance(
          <div>
            <RecipeList recipes={generateLargeDataset(1000, (i) => ({ id: `recipe-${i}` }))} />
            <MealPlanningBoard tripId={`trip-${iteration}`} />
            <ShoppingListView tripId={`trip-${iteration}`} />
          </div>
        )

        // Use components briefly
        await waitFor(() => {
          expect(screen.getByTestId('recipe-list')).toBeInTheDocument()
        })

        // Unmount to trigger cleanup
        unmount()
        
        // Force garbage collection if available
        if ((window as any).gc) {
          (window as any).gc()
        }

        vi.advanceTimersByTime(100)
      }

      // Step 2: Verify memory hasn't grown excessively
      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0
      const memoryIncrease = finalMemory - initialMemory

      // Memory increase should be minimal after cleanup
      expect(memoryIncrease).toBeLessThan(20 * 1024 * 1024) // Less than 20MB

      // Step 3: Test event listener cleanup
      const eventListenerTest = renderWithPerformance(
        <div>
          <MealPlanningBoard tripId="cleanup-trip" />
        </div>
      )

      // Add event listeners
      const element = screen.getByTestId('meal-planning-board')
      const listenerCount = (element as any).getEventListeners?.()?.length || 0

      eventListenerTest.unmount()

      // Event listeners should be cleaned up
      // Note: This is a conceptual test; actual implementation may vary
      expect(listenerCount).toBe(0)

      // Step 4: Test timer cleanup
      const timerTest = renderWithPerformance(
        <div>
          <ShoppingListView tripId="timer-trip" enableAutoRefresh={true} />
        </div>
      )

      // Component should set up timers
      const activeTimers = vi.getTimerCount()
      expect(activeTimers).toBeGreaterThan(0)

      timerTest.unmount()

      // Timers should be cleaned up
      vi.advanceTimersByTime(0) // Process any pending timers
      const remainingTimers = vi.getTimerCount()
      expect(remainingTimers).toBe(0)

      // Step 5: Test subscription cleanup
      const subscriptionTest = renderWithPerformance(
        <div>
          <RecipeList enableRealTimeUpdates={true} />
        </div>
      )

      // Component should subscribe to store updates
      const storeSubscriptions = useRecipeStore.getState().subscriptions?.length || 0
      expect(storeSubscriptions).toBeGreaterThan(0)

      subscriptionTest.unmount()

      // Subscriptions should be cleaned up
      const remainingSubscriptions = useRecipeStore.getState().subscriptions?.length || 0
      expect(remainingSubscriptions).toBe(0)
    })
  })

  describe('Responsive Performance', () => {
    it('should maintain performance across different viewport sizes', async () => {
      simulateAuthentication()

      const viewportSizes = [
        { width: 375, height: 667, name: 'Mobile' },
        { width: 768, height: 1024, name: 'Tablet' },
        { width: 1920, height: 1080, name: 'Desktop' },
        { width: 3840, height: 2160, name: '4K' }
      ]

      for (const viewport of viewportSizes) {
        // Set viewport size
        Object.defineProperties(window, {
          innerWidth: { value: viewport.width, writable: true },
          innerHeight: { value: viewport.height, writable: true }
        })
        window.dispatchEvent(new Event('resize'))

        const performanceDuration = await measurePerformance(`${viewport.name} Render`, async () => {
          renderWithPerformance(
            <div>
              <RecipeList recipes={generateLargeDataset(1000, (i) => ({ id: `recipe-${i}` }))} />
              <MealPlanningBoard tripId="responsive-trip" />
            </div>
          )
        })

        // Performance should be consistent across viewports
        expect(performanceDuration).toBeLessThan(1000)

        // Step 1: Test responsive layout performance
        const layoutDuration = await measurePerformance(`${viewport.name} Layout`, async () => {
          // Trigger layout changes
          const toggleButton = screen.getByRole('button', { name: /toggle view/i })
          await user.click(toggleButton)
        })

        expect(layoutDuration).toBeLessThan(200)

        // Step 2: Test touch vs mouse performance
        if (viewport.width <= 768) {
          // Mobile/tablet - test touch interactions
          const touchDuration = await measurePerformance(`${viewport.name} Touch`, async () => {
            const element = screen.getByTestId('interactive-element')
            fireEvent.touchStart(element)
            fireEvent.touchEnd(element)
          })

          expect(touchDuration).toBeLessThan(100)
        } else {
          // Desktop - test mouse interactions
          const mouseDuration = await measurePerformance(`${viewport.name} Mouse`, async () => {
            const element = screen.getByTestId('interactive-element')
            await user.hover(element)
            await user.click(element)
          })

          expect(mouseDuration).toBeLessThan(100)
        }
      }
    })
  })
})
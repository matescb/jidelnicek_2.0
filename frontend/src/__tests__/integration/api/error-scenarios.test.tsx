import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { server } from '../__mocks__/server'
import { http, HttpResponse, delay } from 'msw'
import { renderWithProviders } from '../setup/testProviders'
import { simulateAuthentication } from '../setup/testSetup'

// Import components that make API calls
import { RecipeForm } from '@/components/recipes/RecipeForm'
import { TripForm } from '@/components/trips/TripForm'
import { ParticipantManager } from '@/components/trips/ParticipantManager'
import { ShoppingListGenerator } from '@/components/trips/ShoppingListGenerator'
import { AuthProvider } from '@/context/AuthContext'

describe('API Integration - Error Scenarios', () => {
  let user: ReturnType<typeof userEvent.setup>

  beforeEach(() => {
    user = userEvent.setup()
  })

  describe('Network Error Handling', () => {
    it('should handle network timeouts gracefully', async () => {
      // Override default handler with timeout scenario
      server.use(
        http.post('/api/v1/recipes', async () => {
          await delay(10000) // Simulate timeout
          return HttpResponse.json({ message: 'Success' })
        })
      )

      simulateAuthentication()

      renderWithProviders(
        <RecipeForm onSuccess={() => {}} onCancel={() => {}} />
      )

      // Fill and submit form
      await user.type(screen.getByLabelText(/recipe name/i), 'Timeout Test Recipe')
      await user.type(screen.getByLabelText(/description/i), 'Testing timeout handling')

      const saveButton = screen.getByRole('button', { name: /save recipe/i })
      await user.click(saveButton)

      // Should show loading state
      expect(screen.getByText(/saving/i)).toBeInTheDocument()
      expect(saveButton).toBeDisabled()

      // Should eventually show timeout error
      await waitFor(() => {
        expect(screen.getByText(/request timed out/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
      }, { timeout: 12000 })

      // Verify form is still filled after timeout
      expect(screen.getByDisplayValue('Timeout Test Recipe')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Testing timeout handling')).toBeInTheDocument()

      // Test retry functionality
      server.use(
        http.post('/api/v1/recipes', async () => {
          return HttpResponse.json({
            recipe: {
              id: 'retry-success',
              name: 'Timeout Test Recipe',
              description: 'Testing timeout handling'
            }
          }, { status: 201 })
        })
      )

      const retryButton = screen.getByRole('button', { name: /retry/i })
      await user.click(retryButton)

      await waitFor(() => {
        expect(screen.getByText(/recipe created successfully/i)).toBeInTheDocument()
      })
    })

    it('should handle complete network failure', async () => {
      // Simulate network failure
      server.use(
        http.post('/api/v1/trips', () => {
          throw new Error('Network error')
        })
      )

      simulateAuthentication()

      renderWithProviders(
        <TripForm onSuccess={() => {}} onCancel={() => {}} />
      )

      // Fill and submit form
      await user.type(screen.getByLabelText(/trip name/i), 'Network Fail Trip')
      await user.type(screen.getByLabelText(/location/i), 'Test Location')

      const saveButton = screen.getByRole('button', { name: /save trip/i })
      await user.click(saveButton)

      // Should show network error
      await waitFor(() => {
        expect(screen.getByText(/network error occurred/i)).toBeInTheDocument()
        expect(screen.getByText(/check your internet connection/i)).toBeInTheDocument()
      })

      // Should offer offline mode
      expect(screen.getByRole('button', { name: /save for later/i })).toBeInTheDocument()

      // Test offline save functionality
      const saveOfflineButton = screen.getByRole('button', { name: /save for later/i })
      await user.click(saveOfflineButton)

      await waitFor(() => {
        expect(screen.getByText(/saved locally/i)).toBeInTheDocument()
        expect(screen.getByText(/will sync when connection restored/i)).toBeInTheDocument()
      })
    })

    it('should handle intermittent connectivity', async () => {
      let callCount = 0
      
      server.use(
        http.post('/api/v1/trips/:tripId/participants', () => {
          callCount++
          if (callCount <= 2) {
            throw new Error('Network error')
          }
          return HttpResponse.json({
            participant: {
              id: 'intermittent-success',
              email: 'participant@example.com',
              status: 'pending'
            }
          }, { status: 201 })
        })
      )

      simulateAuthentication()

      renderWithProviders(
        <ParticipantManager tripId="test-trip" />
      )

      // Attempt to add participant
      const addButton = screen.getByRole('button', { name: /add participant/i })
      await user.click(addButton)

      await user.type(screen.getByLabelText(/email/i), 'participant@example.com')

      const inviteButton = screen.getByRole('button', { name: /send invite/i })
      await user.click(inviteButton)

      // First attempt should fail
      await waitFor(() => {
        expect(screen.getByText(/failed to send invitation/i)).toBeInTheDocument()
      })

      // Should auto-retry with exponential backoff
      await waitFor(() => {
        expect(screen.getByText(/retrying/i)).toBeInTheDocument()
      })

      // Should eventually succeed
      await waitFor(() => {
        expect(screen.getByText(/invitation sent successfully/i)).toBeInTheDocument()
        expect(screen.getByText('participant@example.com')).toBeInTheDocument()
      }, { timeout: 10000 })
    })
  })

  describe('HTTP Error Status Handling', () => {
    it('should handle 401 Unauthorized errors', async () => {
      server.use(
        http.get('/api/v1/recipes', () => {
          return HttpResponse.json(
            { message: 'Unauthorized' },
            { status: 401 }
          )
        })
      )

      simulateAuthentication()

      renderWithProviders(
        <div>
          <RecipeList />
        </div>
      )

      // Should automatically attempt token refresh
      await waitFor(() => {
        expect(screen.getByText(/session expired/i)).toBeInTheDocument()
      })

      // Should redirect to login
      expect(window.location.pathname).toBe('/auth/login')
      expect(window.location.search).toContain('redirect=')
    })

    it('should handle 403 Forbidden errors', async () => {
      server.use(
        http.delete('/api/v1/trips/:tripId', () => {
          return HttpResponse.json(
            { message: 'Forbidden: Insufficient permissions' },
            { status: 403 }
          )
        })
      )

      simulateAuthentication({ role: 'user' })

      renderWithProviders(
        <TripActions tripId="test-trip" />
      )

      const deleteButton = screen.getByRole('button', { name: /delete trip/i })
      await user.click(deleteButton)

      const confirmButton = screen.getByRole('button', { name: /confirm delete/i })
      await user.click(confirmButton)

      await waitFor(() => {
        expect(screen.getByText(/insufficient permissions/i)).toBeInTheDocument()
        expect(screen.getByText(/contact trip organizer/i)).toBeInTheDocument()
      })

      // Trip should still be visible (not deleted)
      expect(screen.getByTestId('trip-test-trip')).toBeInTheDocument()
    })

    it('should handle 404 Not Found errors', async () => {
      server.use(
        http.get('/api/v1/recipes/:id', ({ params }) => {
          if (params.id === 'non-existent') {
            return HttpResponse.json(
              { message: 'Recipe not found' },
              { status: 404 }
            )
          }
        })
      )

      simulateAuthentication()

      renderWithProviders(
        <RecipeDetail recipeId="non-existent" />,
        {
          providerOptions: {
            initialEntries: ['/recipes/non-existent']
          }
        }
      )

      await waitFor(() => {
        expect(screen.getByText(/recipe not found/i)).toBeInTheDocument()
        expect(screen.getByText(/might have been deleted/i)).toBeInTheDocument()
      })

      // Should offer navigation options
      expect(screen.getByRole('link', { name: /browse recipes/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument()
    })

    it('should handle 409 Conflict errors', async () => {
      server.use(
        http.post('/api/v1/auth/register', async ({ request }) => {
          const body = await request.json() as any
          if (body.email === 'existing@example.com') {
            return HttpResponse.json(
              { 
                message: 'Email already exists',
                field: 'email',
                code: 'EMAIL_EXISTS'
              },
              { status: 409 }
            )
          }
        })
      )

      renderWithProviders(
        <AuthProvider>
          <RegisterForm />
        </AuthProvider>
      )

      await user.type(screen.getByLabelText(/email/i), 'existing@example.com')
      await user.type(screen.getByLabelText(/password/i), 'password123')
      await user.type(screen.getByLabelText(/first name/i), 'Test')
      await user.type(screen.getByLabelText(/last name/i), 'User')

      const submitButton = screen.getByRole('button', { name: /register/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/email already exists/i)).toBeInTheDocument()
      })

      // Error should be associated with the email field
      const emailField = screen.getByLabelText(/email/i)
      expect(emailField).toHaveClass('error')
      expect(emailField.closest('div')).toHaveTextContent(/email already exists/i)

      // Should offer recovery options
      expect(screen.getByRole('link', { name: /login instead/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /forgot password/i })).toBeInTheDocument()
    })

    it('should handle 422 Validation errors', async () => {
      server.use(
        http.post('/api/v1/recipes', async ({ request }) => {
          return HttpResponse.json(
            {
              message: 'Validation failed',
              errors: [
                { field: 'name', message: 'Recipe name is required' },
                { field: 'ingredients', message: 'At least one ingredient is required' },
                { field: 'prepTime', message: 'Prep time must be positive' }
              ]
            },
            { status: 422 }
          )
        })
      )

      simulateAuthentication()

      renderWithProviders(
        <RecipeForm onSuccess={() => {}} onCancel={() => {}} />
      )

      const saveButton = screen.getByRole('button', { name: /save recipe/i })
      await user.click(saveButton)

      await waitFor(() => {
        expect(screen.getByText(/validation failed/i)).toBeInTheDocument()
      })

      // Each field should show its specific error
      expect(screen.getByText(/recipe name is required/i)).toBeInTheDocument()
      expect(screen.getByText(/at least one ingredient is required/i)).toBeInTheDocument()
      expect(screen.getByText(/prep time must be positive/i)).toBeInTheDocument()

      // Fields should be highlighted
      expect(screen.getByLabelText(/recipe name/i)).toHaveClass('error')
      expect(screen.getByTestId('ingredients-section')).toHaveClass('error')
      expect(screen.getByLabelText(/prep time/i)).toHaveClass('error')
    })

    it('should handle 429 Rate Limiting errors', async () => {
      server.use(
        http.post('/api/v1/trips/:tripId/shopping-list', () => {
          return HttpResponse.json(
            { 
              message: 'Rate limit exceeded',
              retryAfter: 60
            },
            { 
              status: 429,
              headers: { 'Retry-After': '60' }
            }
          )
        })
      )

      simulateAuthentication()

      renderWithProviders(
        <ShoppingListGenerator tripId="test-trip" />
      )

      const generateButton = screen.getByRole('button', { name: /generate shopping list/i })
      await user.click(generateButton)

      await waitFor(() => {
        expect(screen.getByText(/rate limit exceeded/i)).toBeInTheDocument()
        expect(screen.getByText(/try again in 60 seconds/i)).toBeInTheDocument()
      })

      // Button should be disabled with countdown
      expect(generateButton).toBeDisabled()
      expect(screen.getByText(/retry in 60s/i)).toBeInTheDocument()

      // Should automatically retry after timeout (we'll test this with reduced time)
      server.use(
        http.post('/api/v1/trips/:tripId/shopping-list', () => {
          return HttpResponse.json({
            shoppingList: {
              items: [],
              totalCost: 0
            }
          })
        })
      )

      // Mock shorter retry timeout for testing
      vi.useFakeTimers()
      vi.advanceTimersByTime(61000)

      await waitFor(() => {
        expect(generateButton).toBeEnabled()
        expect(screen.queryByText(/retry in/i)).not.toBeInTheDocument()
      })

      vi.useRealTimers()
    })

    it('should handle 500 Internal Server errors', async () => {
      server.use(
        http.post('/api/v1/trips', () => {
          return HttpResponse.json(
            { message: 'Internal server error' },
            { status: 500 }
          )
        })
      )

      simulateAuthentication()

      renderWithProviders(
        <TripForm onSuccess={() => {}} onCancel={() => {}} />
      )

      await user.type(screen.getByLabelText(/trip name/i), 'Server Error Trip')
      await user.type(screen.getByLabelText(/location/i), 'Test Location')

      const saveButton = screen.getByRole('button', { name: /save trip/i })
      await user.click(saveButton)

      await waitFor(() => {
        expect(screen.getByText(/server error occurred/i)).toBeInTheDocument()
        expect(screen.getByText(/our team has been notified/i)).toBeInTheDocument()
      })

      // Should offer helpful actions
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /save draft/i })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /report issue/i })).toBeInTheDocument()

      // Form data should be preserved
      expect(screen.getByDisplayValue('Server Error Trip')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Test Location')).toBeInTheDocument()
    })
  })

  describe('Concurrent Operation Errors', () => {
    it('should handle optimistic update failures', async () => {
      let updateCount = 0
      
      server.use(
        http.put('/api/v1/trips/:tripId/meals/:mealId', ({ params }) => {
          updateCount++
          if (updateCount === 1) {
            return HttpResponse.json(
              { message: 'Conflict: Meal was updated by another user' },
              { status: 409 }
            )
          }
          return HttpResponse.json({
            meal: {
              id: params.mealId,
              recipeId: 'updated-recipe',
              servings: 6
            }
          })
        })
      )

      simulateAuthentication()

      renderWithProviders(
        <MealPlanningBoard tripId="test-trip" />
      )

      // Make optimistic update
      const editMealButton = screen.getByRole('button', { name: /edit meal/i })
      await user.click(editMealButton)

      const servingsInput = screen.getByLabelText(/servings/i)
      await user.clear(servingsInput)
      await user.type(servingsInput, '8')

      const saveButton = screen.getByRole('button', { name: /save/i })
      await user.click(saveButton)

      // Should show optimistic update first
      expect(screen.getByText('8 servings')).toBeInTheDocument()

      // Then show conflict resolution
      await waitFor(() => {
        expect(screen.getByText(/conflict detected/i)).toBeInTheDocument()
        expect(screen.getByText(/updated by another user/i)).toBeInTheDocument()
      })

      // Should offer resolution options
      expect(screen.getByRole('button', { name: /keep your changes/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /use their changes/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /merge changes/i })).toBeInTheDocument()

      // Test resolution
      const keepChangesButton = screen.getByRole('button', { name: /keep your changes/i })
      await user.click(keepChangesButton)

      await waitFor(() => {
        expect(screen.getByText(/changes saved/i)).toBeInTheDocument()
        expect(screen.getByText('8 servings')).toBeInTheDocument()
      })
    })

    it('should handle batch operation partial failures', async () => {
      server.use(
        http.post('/api/v1/trips/:tripId/participants/batch', async ({ request }) => {
          const body = await request.json() as any
          const participants = body.participants

          // Simulate partial failure
          return HttpResponse.json({
            successful: participants.slice(0, 2).map((p: any, index: number) => ({
              ...p,
              id: `success-${index}`,
              status: 'pending'
            })),
            failed: participants.slice(2).map((p: any) => ({
              email: p.email,
              error: 'Invalid email format'
            }))
          }, { status: 207 }) // Multi-status
        })
      )

      simulateAuthentication()

      renderWithProviders(
        <ParticipantManager tripId="test-trip" />
      )

      // Batch add participants
      const batchAddButton = screen.getByRole('button', { name: /batch add/i })
      await user.click(batchAddButton)

      const emailsTextarea = screen.getByLabelText(/participant emails/i)
      await user.type(emailsTextarea, 
        'valid1@example.com\nvalid2@example.com\ninvalid-email\nanother-invalid'
      )

      const addAllButton = screen.getByRole('button', { name: /add all/i })
      await user.click(addAllButton)

      await waitFor(() => {
        expect(screen.getByText(/2 participants added successfully/i)).toBeInTheDocument()
        expect(screen.getByText(/2 participants failed to add/i)).toBeInTheDocument()
      })

      // Should show successful additions
      expect(screen.getByText('valid1@example.com')).toBeInTheDocument()
      expect(screen.getByText('valid2@example.com')).toBeInTheDocument()

      // Should show failed additions with reasons
      expect(screen.getByText(/invalid-email.*invalid email format/i)).toBeInTheDocument()
      expect(screen.getByText(/another-invalid.*invalid email format/i)).toBeInTheDocument()

      // Should offer retry for failed items
      const retryFailedButton = screen.getByRole('button', { name: /retry failed/i })
      expect(retryFailedButton).toBeInTheDocument()
    })
  })

  describe('Data Consistency Errors', () => {
    it('should handle stale data conflicts', async () => {
      server.use(
        http.put('/api/v1/recipes/:id', ({ request }) => {
          return HttpResponse.json(
            { 
              message: 'Conflict: Recipe was modified',
              currentVersion: {
                id: 'recipe-1',
                name: 'Updated by Someone Else',
                version: 2,
                lastModified: '2024-07-15T14:30:00Z'
              }
            },
            { status: 409 }
          )
        })
      )

      simulateAuthentication()

      renderWithProviders(
        <RecipeForm 
          recipeId="recipe-1" 
          onSuccess={() => {}} 
          onCancel={() => {}} 
        />
      )

      // User has been editing for a while with stale data
      const nameInput = screen.getByDisplayValue('Original Recipe Name')
      await user.clear(nameInput)
      await user.type(nameInput, 'My Updated Recipe Name')

      const saveButton = screen.getByRole('button', { name: /save recipe/i })
      await user.click(saveButton)

      await waitFor(() => {
        expect(screen.getByText(/recipe was modified by someone else/i)).toBeInTheDocument()
      })

      // Should show conflict resolution UI
      expect(screen.getByText(/their version.*updated by someone else/i)).toBeInTheDocument()
      expect(screen.getByText(/your version.*my updated recipe name/i)).toBeInTheDocument()

      // Should offer merge options
      expect(screen.getByRole('button', { name: /use their version/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /keep your changes/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /merge manually/i })).toBeInTheDocument()

      // Test manual merge
      const mergeButton = screen.getByRole('button', { name: /merge manually/i })
      await user.click(mergeButton)

      // Should show side-by-side comparison
      expect(screen.getByTestId('conflict-resolution-panel')).toBeInTheDocument()
      expect(screen.getByText('Updated by Someone Else')).toBeInTheDocument()
      expect(screen.getByText('My Updated Recipe Name')).toBeInTheDocument()
    })

    it('should handle cascading dependency errors', async () => {
      server.use(
        http.delete('/api/v1/recipes/:id', ({ params }) => {
          if (params.id === 'recipe-with-dependencies') {
            return HttpResponse.json(
              {
                message: 'Cannot delete recipe: it is used in active trips',
                dependencies: [
                  { type: 'trip', id: 'trip-1', name: 'Mountain Retreat' },
                  { type: 'trip', id: 'trip-2', name: 'Beach Vacation' }
                ]
              },
              { status: 409 }
            )
          }
          return HttpResponse.json({ message: 'Recipe deleted' })
        })
      )

      simulateAuthentication()

      renderWithProviders(
        <RecipeActions recipeId="recipe-with-dependencies" />
      )

      const deleteButton = screen.getByRole('button', { name: /delete recipe/i })
      await user.click(deleteButton)

      const confirmButton = screen.getByRole('button', { name: /confirm delete/i })
      await user.click(confirmButton)

      await waitFor(() => {
        expect(screen.getByText(/cannot delete recipe/i)).toBeInTheDocument()
        expect(screen.getByText(/used in active trips/i)).toBeInTheDocument()
      })

      // Should show dependencies
      expect(screen.getByText('Mountain Retreat')).toBeInTheDocument()
      expect(screen.getByText('Beach Vacation')).toBeInTheDocument()

      // Should offer resolution options
      expect(screen.getByRole('button', { name: /remove from trips first/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /force delete/i })).toBeInTheDocument()

      // Test force delete warning
      const forceDeleteButton = screen.getByRole('button', { name: /force delete/i })
      await user.click(forceDeleteButton)

      expect(screen.getByText(/this will break meal plans/i)).toBeInTheDocument()
      expect(screen.getByText(/are you sure/i)).toBeInTheDocument()
    })
  })

  describe('Error Recovery and Resilience', () => {
    it('should implement circuit breaker pattern', async () => {
      let failureCount = 0
      
      server.use(
        http.get('/api/v1/recipes', () => {
          failureCount++
          if (failureCount <= 5) {
            return HttpResponse.json(
              { message: 'Service unavailable' },
              { status: 503 }
            )
          }
          return HttpResponse.json({ recipes: [] })
        })
      )

      simulateAuthentication()

      renderWithProviders(
        <RecipeList />
      )

      // Should show multiple retry attempts
      await waitFor(() => {
        expect(screen.getByText(/service unavailable/i)).toBeInTheDocument()
      })

      // After several failures, should show circuit breaker
      await waitFor(() => {
        expect(screen.getByText(/service temporarily unavailable/i)).toBeInTheDocument()
        expect(screen.getByText(/please try again later/i)).toBeInTheDocument()
      }, { timeout: 10000 })

      // Should disable automatic retries
      expect(screen.queryByText(/retrying/i)).not.toBeInTheDocument()

      // Should offer manual retry after cooldown
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
    })

    it('should gracefully degrade functionality during partial failures', async () => {
      server.use(
        http.get('/api/v1/recipes/:id/nutrition', () => {
          return HttpResponse.json(
            { message: 'Nutrition service unavailable' },
            { status: 503 }
          )
        }),
        http.get('/api/v1/recipes/:id', () => {
          return HttpResponse.json({
            recipe: {
              id: 'recipe-1',
              name: 'Test Recipe',
              ingredients: [{ name: 'Pasta', amount: 400, unit: 'g' }]
            }
          })
        })
      )

      simulateAuthentication()

      renderWithProviders(
        <RecipeDetail recipeId="recipe-1" />
      )

      await waitFor(() => {
        expect(screen.getByText('Test Recipe')).toBeInTheDocument()
        expect(screen.getByText('Pasta: 400 g')).toBeInTheDocument()
      })

      // Should show degraded nutrition section
      expect(screen.getByText(/nutrition information unavailable/i)).toBeInTheDocument()
      expect(screen.getByText(/other features remain available/i)).toBeInTheDocument()

      // Core functionality should still work
      const addToTripButton = screen.getByRole('button', { name: /add to trip/i })
      expect(addToTripButton).toBeEnabled()

      const editButton = screen.getByRole('button', { name: /edit recipe/i })
      expect(editButton).toBeEnabled()
    })

    it('should handle progressive web app offline scenarios', async () => {
      simulateAuthentication()

      renderWithProviders(
        <div>
          <RecipeForm onSuccess={() => {}} onCancel={() => {}} />
          <OfflineIndicator />
        </div>
      )

      // Simulate going offline
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true
      })

      window.dispatchEvent(new Event('offline'))

      await waitFor(() => {
        expect(screen.getByText(/you are offline/i)).toBeInTheDocument()
      })

      // Fill form while offline
      await user.type(screen.getByLabelText(/recipe name/i), 'Offline Recipe')
      await user.type(screen.getByLabelText(/description/i), 'Created while offline')

      const saveButton = screen.getByRole('button', { name: /save recipe/i })
      await user.click(saveButton)

      // Should save to local storage
      await waitFor(() => {
        expect(screen.getByText(/saved locally/i)).toBeInTheDocument()
        expect(screen.getByText(/will sync when online/i)).toBeInTheDocument()
      })

      // Simulate coming back online
      Object.defineProperty(navigator, 'onLine', {
        value: true,
        writable: true
      })

      window.dispatchEvent(new Event('online'))

      // Should automatically sync
      await waitFor(() => {
        expect(screen.getByText(/syncing/i)).toBeInTheDocument()
      })

      await waitFor(() => {
        expect(screen.getByText(/sync completed/i)).toBeInTheDocument()
      })
    })
  })
})
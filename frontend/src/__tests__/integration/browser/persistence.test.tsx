import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../setup/testProviders'
import { simulateAuthentication, simulateLogout } from '../setup/testSetup'

// Import components for testing
import App from '@/App'
import { RecipeForm } from '@/components/recipes/RecipeForm'
import { TripWizard } from '@/components/trips/TripWizard'
import { useAuthStore } from '@/store/slices/authStore'
import { useRecipeStore } from '@/store/slices/recipeStore'
import { useTripStore } from '@/store/slices/tripStore'

describe('Browser Environment and Persistence Integration', () => {
  let user: ReturnType<typeof userEvent.setup>
  let originalLocalStorage: Storage
  let originalSessionStorage: Storage

  beforeEach(() => {
    user = userEvent.setup()
    
    // Store original storage implementations
    originalLocalStorage = window.localStorage
    originalSessionStorage = window.sessionStorage
    
    // Create mock storage with actual implementation
    const createMockStorage = (): Storage => {
      const store: Record<string, string> = {}
      return {
        getItem: vi.fn((key: string) => store[key] || null),
        setItem: vi.fn((key: string, value: string) => {
          store[key] = value
        }),
        removeItem: vi.fn((key: string) => {
          delete store[key]
        }),
        clear: vi.fn(() => {
          Object.keys(store).forEach(key => delete store[key])
        }),
        key: vi.fn((index: number) => Object.keys(store)[index] || null),
        get length() { return Object.keys(store).length }
      }
    }

    Object.defineProperty(window, 'localStorage', {
      value: createMockStorage(),
      writable: true
    })

    Object.defineProperty(window, 'sessionStorage', {
      value: createMockStorage(),
      writable: true
    })
  })

  afterEach(() => {
    // Restore original implementations
    Object.defineProperty(window, 'localStorage', {
      value: originalLocalStorage,
      writable: true
    })
    
    Object.defineProperty(window, 'sessionStorage', {
      value: originalSessionStorage,
      writable: true
    })
  })

  describe('Authentication Persistence', () => {
    it('should persist authentication state across page reloads', async () => {
      renderWithProviders(<App />)

      // Step 1: Login user
      const loginLink = screen.getByRole('link', { name: /login/i })
      await user.click(loginLink)

      await user.type(screen.getByLabelText(/email/i), 'test@example.com')
      await user.type(screen.getByLabelText(/password/i), 'password123')

      const loginButton = screen.getByRole('button', { name: /login/i })
      await user.click(loginButton)

      // Wait for successful login
      await waitFor(() => {
        expect(screen.getByText(/dashboard/i)).toBeInTheDocument()
      })

      // Step 2: Verify auth data is stored
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'auth-storage',
        expect.stringContaining('mock-access-token')
      )

      // Step 3: Simulate page reload
      // Clear component state but keep localStorage
      simulateLogout() // Clear memory state
      
      // Re-render app (simulating page reload)
      renderWithProviders(<App />)

      // Step 4: Should automatically restore authentication
      await waitFor(() => {
        expect(screen.getByText(/dashboard/i)).toBeInTheDocument()
      })

      // Verify user is still authenticated
      const userMenu = screen.getByRole('button', { name: /test user/i })
      expect(userMenu).toBeInTheDocument()
    })

    it('should handle token expiration and refresh', async () => {
      simulateAuthentication({
        tokens: {
          accessToken: 'expired-token',
          refreshToken: 'valid-refresh-token'
        }
      })

      renderWithProviders(<App />)

      // Mock expired token scenario
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: 'Token expired' })
      } as Response)

      // Mock successful refresh
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          tokens: {
            accessToken: 'new-access-token',
            refreshToken: 'new-refresh-token'
          }
        })
      } as Response)

      // Mock successful retry with new token
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          user: {
            id: 'user-1',
            email: 'test@example.com',
            firstName: 'Test',
            lastName: 'User'
          }
        })
      } as Response)

      // Navigate to protected route that triggers API call
      const recipesLink = screen.getByRole('link', { name: /recipes/i })
      await user.click(recipesLink)

      // Should automatically refresh token and continue
      await waitFor(() => {
        expect(screen.getByText(/recipes/i)).toBeInTheDocument()
      })

      // Verify new token is stored
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'auth-storage',
        expect.stringContaining('new-access-token')
      )
    })

    it('should handle authentication across multiple tabs', async () => {
      // Simulate first tab
      renderWithProviders(<App />)

      // Login in first tab
      simulateAuthentication()

      await waitFor(() => {
        expect(screen.getByText(/dashboard/i)).toBeInTheDocument()
      })

      // Simulate storage event from another tab (logout)
      const storageEvent = new StorageEvent('storage', {
        key: 'auth-storage',
        oldValue: JSON.stringify({ state: { tokens: { accessToken: 'token' } } }),
        newValue: null,
        storageArea: localStorage
      })

      act(() => {
        window.dispatchEvent(storageEvent)
      })

      // Should automatically logout in current tab
      await waitFor(() => {
        expect(screen.getByText(/welcome to jídelníček/i)).toBeInTheDocument()
      })

      // Simulate login in another tab
      const loginStorageEvent = new StorageEvent('storage', {
        key: 'auth-storage',
        oldValue: null,
        newValue: JSON.stringify({
          state: {
            tokens: {
              accessToken: 'new-tab-token',
              refreshToken: 'new-tab-refresh'
            }
          }
        }),
        storageArea: localStorage
      })

      act(() => {
        window.dispatchEvent(loginStorageEvent)
      })

      // Should automatically login in current tab
      await waitFor(() => {
        expect(screen.getByText(/dashboard/i)).toBeInTheDocument()
      })
    })
  })

  describe('Form Data Persistence', () => {
    it('should save and restore form drafts', async () => {
      simulateAuthentication()

      renderWithProviders(
        <RecipeForm onSuccess={() => {}} onCancel={() => {}} />
      )

      // Step 1: Fill form partially
      await user.type(screen.getByLabelText(/recipe name/i), 'Draft Recipe')
      await user.type(screen.getByLabelText(/description/i), 'This is a draft recipe')
      await user.type(screen.getByLabelText(/prep time/i), '30')

      // Add ingredient
      const addIngredientButton = screen.getByRole('button', { name: /add ingredient/i })
      await user.click(addIngredientButton)
      
      await user.type(screen.getByLabelText(/ingredient name/i), 'Test Ingredient')
      await user.type(screen.getByLabelText(/amount/i), '200')

      // Step 2: Trigger auto-save (simulate typing pause)
      await act(async () => {
        vi.advanceTimersByTime(2000) // Auto-save delay
      })

      // Verify draft is saved
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'recipe-draft-new',
        expect.stringContaining('Draft Recipe')
      )

      // Step 3: Simulate navigation away and back
      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await user.click(cancelButton)

      // Navigate back to form
      renderWithProviders(
        <RecipeForm onSuccess={() => {}} onCancel={() => {}} />
      )

      // Step 4: Should show draft restoration option
      await waitFor(() => {
        expect(screen.getByText(/restore draft/i)).toBeInTheDocument()
      })

      const restoreButton = screen.getByRole('button', { name: /restore draft/i })
      await user.click(restoreButton)

      // Step 5: Verify form data is restored
      expect(screen.getByDisplayValue('Draft Recipe')).toBeInTheDocument()
      expect(screen.getByDisplayValue('This is a draft recipe')).toBeInTheDocument()
      expect(screen.getByDisplayValue('30')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Test Ingredient')).toBeInTheDocument()
      expect(screen.getByDisplayValue('200')).toBeInTheDocument()

      // Step 6: Complete and save form
      const saveButton = screen.getByRole('button', { name: /save recipe/i })
      await user.click(saveButton)

      // Step 7: Verify draft is cleared after successful save
      await waitFor(() => {
        expect(localStorage.removeItem).toHaveBeenCalledWith('recipe-draft-new')
      })
    })

    it('should handle form persistence with validation errors', async () => {
      simulateAuthentication()

      renderWithProviders(
        <RecipeForm onSuccess={() => {}} onCancel={() => {}} />
      )

      // Fill form with invalid data
      await user.type(screen.getByLabelText(/recipe name/i), '') // Empty name
      await user.type(screen.getByLabelText(/prep time/i), '-10') // Invalid time

      // Try to save
      const saveButton = screen.getByRole('button', { name: /save recipe/i })
      await user.click(saveButton)

      // Should show validation errors
      await waitFor(() => {
        expect(screen.getByText(/recipe name is required/i)).toBeInTheDocument()
        expect(screen.getByText(/prep time must be positive/i)).toBeInTheDocument()
      })

      // Form should still auto-save despite validation errors
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'recipe-draft-new',
        expect.any(String)
      )

      // Fix validation errors
      await user.type(screen.getByLabelText(/recipe name/i), 'Fixed Recipe')
      await user.clear(screen.getByLabelText(/prep time/i))
      await user.type(screen.getByLabelText(/prep time/i), '20')

      // Save should now work
      await user.click(saveButton)

      await waitFor(() => {
        expect(screen.getByText(/recipe created successfully/i)).toBeInTheDocument()
      })
    })

    it('should handle complex form wizard persistence', async () => {
      simulateAuthentication()

      renderWithProviders(
        <TripWizard onComplete={() => {}} onCancel={() => {}} />
      )

      // Step 1: Fill basic information
      await user.type(screen.getByLabelText(/trip name/i), 'Persistence Test Trip')
      await user.type(screen.getByLabelText(/location/i), 'Test Location')
      await user.type(screen.getByLabelText(/start date/i), '2024-08-15')
      await user.type(screen.getByLabelText(/end date/i), '2024-08-17')

      const nextButton = screen.getByRole('button', { name: /next/i })
      await user.click(nextButton)

      // Step 2: Add participants
      await user.type(screen.getByLabelText(/participant email/i), 'participant1@example.com')
      const addParticipantButton = screen.getByRole('button', { name: /add participant/i })
      await user.click(addParticipantButton)

      await user.type(screen.getByLabelText(/participant email/i), 'participant2@example.com')
      await user.click(addParticipantButton)

      await user.click(nextButton)

      // Step 3: Configure meal slots
      const breakfastCheckbox = screen.getByLabelText(/breakfast/i)
      await user.click(breakfastCheckbox)

      // Simulate browser crash/refresh during wizard
      renderWithProviders(
        <TripWizard onComplete={() => {}} onCancel={() => {}} />
      )

      // Should offer to restore wizard progress
      await waitFor(() => {
        expect(screen.getByText(/restore previous session/i)).toBeInTheDocument()
      })

      const restoreButton = screen.getByRole('button', { name: /restore session/i })
      await user.click(restoreButton)

      // Should restore to the correct step with all data
      expect(screen.getByDisplayValue('Persistence Test Trip')).toBeInTheDocument()
      expect(screen.getByText('participant1@example.com')).toBeInTheDocument()
      expect(screen.getByText('participant2@example.com')).toBeInTheDocument()
      
      // Should be on the meal slots step
      expect(screen.getByText(/configure meal slots/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/breakfast/i)).toBeChecked()
    })
  })

  describe('Application State Persistence', () => {
    it('should persist and restore application preferences', async () => {
      simulateAuthentication()

      renderWithProviders(<App />)

      // Step 1: Change theme
      const themeToggle = screen.getByRole('button', { name: /toggle theme/i })
      await user.click(themeToggle)

      // Verify dark mode is applied
      expect(document.documentElement).toHaveClass('dark')

      // Step 2: Change language
      const languageSelector = screen.getByRole('button', { name: /language/i })
      await user.click(languageSelector)

      const czechOption = screen.getByRole('option', { name: /čeština/i })
      await user.click(czechOption)

      // Step 3: Adjust list view preferences
      const recipesLink = screen.getByRole('link', { name: /recipes/i })
      await user.click(recipesLink)

      const viewToggle = screen.getByRole('button', { name: /grid view/i })
      await user.click(viewToggle)

      const sortSelect = screen.getByLabelText(/sort by/i)
      await user.selectOptions(sortSelect, 'name')

      // Step 4: Simulate app restart
      renderWithProviders(<App />)

      // Step 5: Verify preferences are restored
      expect(document.documentElement).toHaveClass('dark')
      
      // Navigate to recipes to check view preferences
      const recipesLinkRestored = screen.getByRole('link', { name: /recepty/i }) // Czech
      await user.click(recipesLinkRestored)

      await waitFor(() => {
        expect(screen.getByTestId('recipe-grid-view')).toBeInTheDocument()
        expect(screen.getByDisplayValue('name')).toBeInTheDocument()
      })
    })

    it('should handle offline data persistence and sync', async () => {
      simulateAuthentication()

      renderWithProviders(<App />)

      // Step 1: Create data while online
      const recipesLink = screen.getByRole('link', { name: /recipes/i })
      await user.click(recipesLink)

      const createButton = screen.getByRole('button', { name: /create recipe/i })
      await user.click(createButton)

      await user.type(screen.getByLabelText(/recipe name/i), 'Online Recipe')
      
      const saveButton = screen.getByRole('button', { name: /save/i })
      await user.click(saveButton)

      // Step 2: Go offline
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true
      })

      window.dispatchEvent(new Event('offline'))

      await waitFor(() => {
        expect(screen.getByText(/offline mode/i)).toBeInTheDocument()
      })

      // Step 3: Create data while offline
      await user.click(createButton)
      await user.type(screen.getByLabelText(/recipe name/i), 'Offline Recipe')
      await user.click(saveButton)

      // Should save locally
      await waitFor(() => {
        expect(screen.getByText(/saved locally/i)).toBeInTheDocument()
      })

      // Verify offline data is stored
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'offline-queue',
        expect.stringContaining('Offline Recipe')
      )

      // Step 4: Go back online
      Object.defineProperty(navigator, 'onLine', {
        value: true,
        writable: true
      })

      window.dispatchEvent(new Event('online'))

      // Step 5: Should automatically sync
      await waitFor(() => {
        expect(screen.getByText(/syncing/i)).toBeInTheDocument()
      })

      await waitFor(() => {
        expect(screen.getByText(/sync completed/i)).toBeInTheDocument()
      })

      // Verify offline queue is cleared
      expect(localStorage.removeItem).toHaveBeenCalledWith('offline-queue')
    })

    it('should preserve navigation state and history', async () => {
      simulateAuthentication()

      renderWithProviders(<App />, {
        providerOptions: {
          initialEntries: ['/dashboard']
        }
      })

      // Step 1: Navigate through the app
      const recipesLink = screen.getByRole('link', { name: /recipes/i })
      await user.click(recipesLink)

      const recipeCard = screen.getByTestId('recipe-card-1')
      await user.click(recipeCard)

      const editButton = screen.getByRole('button', { name: /edit/i })
      await user.click(editButton)

      // Step 2: Modify something to create form state
      await user.type(screen.getByLabelText(/description/i), ' - Modified')

      // Step 3: Store navigation state
      expect(sessionStorage.setItem).toHaveBeenCalledWith(
        'navigation-state',
        expect.stringContaining('/recipes/')
      )

      // Step 4: Simulate page refresh with form changes
      const beforeUnloadEvent = new Event('beforeunload')
      window.dispatchEvent(beforeUnloadEvent)

      // Should warn about unsaved changes
      expect(window.confirm).toHaveBeenCalledWith(
        expect.stringContaining('unsaved changes')
      )

      // Step 5: Navigate back
      const backButton = screen.getByRole('button', { name: /back/i })
      await user.click(backButton)

      // Should navigate to previous page
      expect(window.location.pathname).toMatch(/\/recipes\/\d+$/)

      // Step 6: Test deep linking restoration
      renderWithProviders(<App />, {
        providerOptions: {
          initialEntries: ['/recipes/123/edit?tab=ingredients']
        }
      })

      await waitFor(() => {
        expect(screen.getByText(/edit recipe/i)).toBeInTheDocument()
        expect(screen.getByRole('tab', { name: /ingredients/i })).toHaveAttribute('aria-selected', 'true')
      })
    })
  })

  describe('Data Migration and Versioning', () => {
    it('should handle localStorage schema migrations', async () => {
      // Step 1: Set up old version data
      localStorage.setItem('preferences', JSON.stringify({
        version: 1,
        theme: 'dark',
        oldProperty: 'should be removed'
      }))

      simulateAuthentication()

      renderWithProviders(<App />)

      // Step 2: Should automatically migrate data
      await waitFor(() => {
        const migratedData = JSON.parse(localStorage.getItem('preferences') || '{}')
        expect(migratedData.version).toBe(2)
        expect(migratedData.theme).toBe('dark')
        expect(migratedData.oldProperty).toBeUndefined()
        expect(migratedData.newProperty).toBeDefined()
      })

      // Step 3: Should show migration notice
      expect(screen.getByText(/data updated/i)).toBeInTheDocument()
    })

    it('should handle data corruption gracefully', async () => {
      // Step 1: Set up corrupted data
      localStorage.setItem('auth-storage', 'invalid-json{')
      localStorage.setItem('preferences', '{"incomplete":')

      renderWithProviders(<App />)

      // Step 2: Should handle corruption and reset to defaults
      await waitFor(() => {
        expect(screen.getByText(/data recovered/i)).toBeInTheDocument()
      })

      // Should start with default state
      expect(screen.getByText(/welcome to jídelníček/i)).toBeInTheDocument()

      // Corrupted data should be cleared
      expect(localStorage.removeItem).toHaveBeenCalledWith('auth-storage')
      expect(localStorage.removeItem).toHaveBeenCalledWith('preferences')
    })

    it('should backup and restore critical data', async () => {
      simulateAuthentication()

      renderWithProviders(<App />)

      // Step 1: Create some data
      const recipesStore = useRecipeStore.getState()
      recipesStore.addRecipe({
        id: 'backup-test',
        name: 'Backup Test Recipe',
        ingredients: []
      })

      // Step 2: Trigger manual backup
      const settingsLink = screen.getByRole('link', { name: /settings/i })
      await user.click(settingsLink)

      const dataTab = screen.getByRole('tab', { name: /data/i })
      await user.click(dataTab)

      const backupButton = screen.getByRole('button', { name: /create backup/i })
      await user.click(backupButton)

      // Step 3: Verify backup is created
      await waitFor(() => {
        expect(localStorage.setItem).toHaveBeenCalledWith(
          'data-backup',
          expect.stringContaining('Backup Test Recipe')
        )
      })

      // Step 4: Simulate data loss
      recipesStore.clearRecipes()

      // Step 5: Restore from backup
      const restoreButton = screen.getByRole('button', { name: /restore backup/i })
      await user.click(restoreButton)

      const confirmRestoreButton = screen.getByRole('button', { name: /confirm restore/i })
      await user.click(confirmRestoreButton)

      // Step 6: Verify data is restored
      await waitFor(() => {
        const restoredRecipes = useRecipeStore.getState().recipes
        expect(restoredRecipes).toContainEqual(
          expect.objectContaining({
            name: 'Backup Test Recipe'
          })
        )
      })
    })
  })

  describe('Cross-Browser Compatibility', () => {
    it('should handle different storage implementations', async () => {
      // Test with limited storage quota
      const limitedStorage = {
        ...localStorage,
        setItem: vi.fn((key: string, value: string) => {
          if (value.length > 1000) {
            throw new Error('QuotaExceededError')
          }
          localStorage.setItem(key, value)
        })
      }

      Object.defineProperty(window, 'localStorage', {
        value: limitedStorage,
        writable: true
      })

      simulateAuthentication()

      renderWithProviders(<App />)

      // Try to store large data
      const largeData = 'x'.repeat(2000)
      
      act(() => {
        useRecipeStore.getState().addRecipe({
          id: 'large-recipe',
          name: 'Large Recipe',
          description: largeData,
          ingredients: []
        })
      })

      // Should handle quota exceeded error
      await waitFor(() => {
        expect(screen.getByText(/storage quota exceeded/i)).toBeInTheDocument()
        expect(screen.getByText(/consider clearing old data/i)).toBeInTheDocument()
      })

      // Should offer cleanup options
      expect(screen.getByRole('button', { name: /clear old data/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /use session storage/i })).toBeInTheDocument()
    })

    it('should work without storage support', async () => {
      // Disable storage
      Object.defineProperty(window, 'localStorage', {
        value: null,
        writable: true
      })

      Object.defineProperty(window, 'sessionStorage', {
        value: null,
        writable: true
      })

      renderWithProviders(<App />)

      // Should show graceful degradation message
      await waitFor(() => {
        expect(screen.getByText(/storage not available/i)).toBeInTheDocument()
        expect(screen.getByText(/some features limited/i)).toBeInTheDocument()
      })

      // Core functionality should still work
      const loginLink = screen.getByRole('link', { name: /login/i })
      expect(loginLink).toBeInTheDocument()

      // Should use memory-only storage
      await user.click(loginLink)
      
      // Login form should work
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    })
  })
})
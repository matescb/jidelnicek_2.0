import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '@/App'
import { renderWithProviders } from '../setup/testProviders'
import { simulateAuthentication, simulateLogout, mockFetch } from '../setup/testSetup'
import { server } from '../__mocks__/server'

describe('Complete User Journeys', () => {
  let user: ReturnType<typeof userEvent.setup>

  beforeEach(() => {
    user = userEvent.setup()
    simulateLogout() // Start each test logged out
  })

  describe('Journey 1: New User Registration → First Recipe Creation → Trip Planning', () => {
    it('should complete the full new user flow', async () => {
      // Render the app
      renderWithProviders(<App />, {
        providerOptions: {
          initialEntries: ['/'],
          useMemoryRouter: true,
        }
      })

      // Step 1: Navigate to registration from home page
      expect(screen.getByText(/welcome to jídelníček/i)).toBeInTheDocument()
      
      const registerLink = screen.getByRole('link', { name: /register/i })
      await user.click(registerLink)
      
      expect(window.location.pathname).toBe('/auth/register')

      // Step 2: Fill registration form
      await user.type(screen.getByLabelText(/email/i), 'newuser@example.com')
      await user.type(screen.getByLabelText(/first name/i), 'John')
      await user.type(screen.getByLabelText(/last name/i), 'Doe')
      await user.type(screen.getByLabelText(/password/i), 'SecurePass123!')
      await user.type(screen.getByLabelText(/confirm password/i), 'SecurePass123!')

      const registerButton = screen.getByRole('button', { name: /register/i })
      await user.click(registerButton)

      // Step 3: Verify successful registration and redirect to dashboard
      await waitFor(() => {
        expect(screen.getByText(/dashboard/i)).toBeInTheDocument()
      })
      expect(window.location.pathname).toBe('/dashboard')

      // Step 4: Navigate to recipes and create first recipe
      const recipesNavLink = screen.getByRole('link', { name: /recipes/i })
      await user.click(recipesNavLink)
      
      expect(window.location.pathname).toBe('/dashboard/recipes')
      
      const createRecipeButton = screen.getByRole('button', { name: /create new recipe/i })
      await user.click(createRecipeButton)
      
      expect(window.location.pathname).toBe('/dashboard/recipes/new')

      // Step 5: Fill recipe creation form
      await user.type(screen.getByLabelText(/recipe name/i), 'My First Recipe')
      await user.type(screen.getByLabelText(/description/i), 'A delicious first recipe')
      await user.type(screen.getByLabelText(/prep time/i), '30')
      await user.type(screen.getByLabelText(/servings/i), '4')
      
      // Select difficulty
      const difficultySelect = screen.getByLabelText(/difficulty/i)
      await user.selectOptions(difficultySelect, 'medium')
      
      // Add ingredients
      const addIngredientButton = screen.getByRole('button', { name: /add ingredient/i })
      await user.click(addIngredientButton)
      
      const ingredientNameInput = screen.getByLabelText(/ingredient name/i)
      await user.type(ingredientNameInput, 'Pasta')
      
      const ingredientAmountInput = screen.getByLabelText(/amount/i)
      await user.type(ingredientAmountInput, '500')
      
      const ingredientUnitSelect = screen.getByLabelText(/unit/i)
      await user.selectOptions(ingredientUnitSelect, 'g')

      // Add instructions
      const addInstructionButton = screen.getByRole('button', { name: /add instruction/i })
      await user.click(addInstructionButton)
      
      const instructionInput = screen.getByLabelText(/instruction/i)
      await user.type(instructionInput, 'Cook pasta according to package instructions')

      // Save recipe
      const saveRecipeButton = screen.getByRole('button', { name: /save recipe/i })
      await user.click(saveRecipeButton)

      // Step 6: Verify recipe creation success
      await waitFor(() => {
        expect(screen.getByText(/recipe created successfully/i)).toBeInTheDocument()
      })

      // Navigate back to recipes list
      await waitFor(() => {
        expect(screen.getByText('My First Recipe')).toBeInTheDocument()
      })

      // Step 7: Navigate to trips and create first trip
      const tripsNavLink = screen.getByRole('link', { name: /trips/i })
      await user.click(tripsNavLink)
      
      expect(window.location.pathname).toBe('/dashboard/trips')
      
      const createTripButton = screen.getByRole('button', { name: /create new trip/i })
      await user.click(createTripButton)
      
      expect(window.location.pathname).toBe('/dashboard/trips/new')

      // Step 8: Fill trip creation form
      await user.type(screen.getByLabelText(/trip name/i), 'Weekend Getaway')
      await user.type(screen.getByLabelText(/description/i), 'A relaxing weekend trip')
      await user.type(screen.getByLabelText(/location/i), 'Mountain Cabin')
      
      // Set dates
      const startDateInput = screen.getByLabelText(/start date/i)
      await user.type(startDateInput, '2024-08-15')
      
      const endDateInput = screen.getByLabelText(/end date/i)
      await user.type(endDateInput, '2024-08-17')
      
      // Set budget
      await user.type(screen.getByLabelText(/budget/i), '500')

      // Save trip
      const saveTripButton = screen.getByRole('button', { name: /save trip/i })
      await user.click(saveTripButton)

      // Step 9: Verify trip creation success and navigate to trip planner
      await waitFor(() => {
        expect(screen.getByText(/trip created successfully/i)).toBeInTheDocument()
      })

      // Go to trip planner
      const plannerButton = screen.getByRole('button', { name: /plan meals/i })
      await user.click(plannerButton)

      expect(window.location.pathname).toMatch(/\/dashboard\/trips\/.*\/planner/)

      // Step 10: Add recipe to meal plan
      const breakfastSlot = screen.getByTestId('meal-slot-breakfast-2024-08-15')
      await user.click(breakfastSlot)
      
      // Select the recipe we created
      const addRecipeButton = screen.getByRole('button', { name: /add recipe/i })
      await user.click(addRecipeButton)
      
      const recipeOption = screen.getByText('My First Recipe')
      await user.click(recipeOption)
      
      const confirmButton = screen.getByRole('button', { name: /confirm/i })
      await user.click(confirmButton)

      // Step 11: Verify meal assignment
      await waitFor(() => {
        expect(screen.getByText('My First Recipe')).toBeInTheDocument()
      })

      // Step 12: Generate shopping list
      const generateShoppingListButton = screen.getByRole('button', { name: /generate shopping list/i })
      await user.click(generateShoppingListButton)

      await waitFor(() => {
        expect(screen.getByText(/shopping list/i)).toBeInTheDocument()
        expect(screen.getByText('Pasta')).toBeInTheDocument()
        expect(screen.getByText('500 g')).toBeInTheDocument()
      })

      // Step 13: Complete user journey validation
      expect(screen.getByText(/total estimated cost/i)).toBeInTheDocument()
      
      // Verify we can navigate back to dashboard
      const dashboardLink = screen.getByRole('link', { name: /dashboard/i })
      await user.click(dashboardLink)
      
      expect(window.location.pathname).toBe('/dashboard')
      
      // Verify user data persistence
      expect(screen.getByText(/john doe/i)).toBeInTheDocument() // User name in header
      expect(screen.getByText(/1.*recipe/i)).toBeInTheDocument() // Recipe count
      expect(screen.getByText(/1.*trip/i)).toBeInTheDocument() // Trip count
    }, 60000) // 60 second timeout for complex flow
  })

  describe('Journey 2: Existing User → Recipe Search → Meal Planning → Shopping List', () => {
    it('should complete the recipe discovery and meal planning flow', async () => {
      // Start as authenticated user
      simulateAuthentication({
        id: 'existing-user-1',
        email: 'existing@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        role: 'user',
      })

      renderWithProviders(<App />, {
        providerOptions: {
          initialEntries: ['/dashboard'],
          useMemoryRouter: true,
        }
      })

      // Step 1: Navigate to recipes and search
      const recipesLink = screen.getByRole('link', { name: /recipes/i })
      await user.click(recipesLink)

      expect(window.location.pathname).toBe('/dashboard/recipes')

      // Step 2: Search for specific recipes
      const searchInput = screen.getByPlaceholderText(/search recipes/i)
      await user.type(searchInput, 'pasta')

      // Wait for search results
      await waitFor(() => {
        expect(screen.getByText('Pasta Carbonara')).toBeInTheDocument()
      })

      // Step 3: Filter by category
      const categoryFilter = screen.getByLabelText(/category/i)
      await user.selectOptions(categoryFilter, 'Main Course')

      await waitFor(() => {
        expect(screen.getByText('Pasta Carbonara')).toBeInTheDocument()
      })

      // Step 4: View recipe details
      const recipeCard = screen.getByText('Pasta Carbonara')
      await user.click(recipeCard)

      expect(window.location.pathname).toMatch(/\/dashboard\/recipes\/.*/)

      // Verify recipe details are displayed
      expect(screen.getByText(/classic italian pasta dish/i)).toBeInTheDocument()
      expect(screen.getByText(/prep time.*15.*min/i)).toBeInTheDocument()
      expect(screen.getByText(/servings.*4/i)).toBeInTheDocument()

      // Step 5: Add to trip from recipe details
      const addToTripButton = screen.getByRole('button', { name: /add to trip/i })
      await user.click(addToTripButton)

      // Select or create trip
      const createNewTripOption = screen.getByText(/create new trip/i)
      await user.click(createNewTripOption)

      // Quick trip creation modal
      await user.type(screen.getByLabelText(/trip name/i), 'Pasta Night')
      await user.type(screen.getByLabelText(/start date/i), '2024-08-20')
      await user.type(screen.getByLabelText(/end date/i), '2024-08-20')

      const createTripButton = screen.getByRole('button', { name: /create trip/i })
      await user.click(createTripButton)

      // Step 6: Assign to meal slot
      const dinnerSlot = screen.getByTestId('meal-slot-dinner')
      await user.click(dinnerSlot)

      const confirmAssignmentButton = screen.getByRole('button', { name: /assign to dinner/i })
      await user.click(confirmAssignmentButton)

      // Step 7: Add more recipes to complete the meal plan
      const addMoreRecipesButton = screen.getByRole('button', { name: /add more recipes/i })
      await user.click(addMoreRecipesButton)

      // Search for side dish
      const recipeSearchInput = screen.getByPlaceholderText(/search recipes to add/i)
      await user.type(recipeSearchInput, 'salad')

      await waitFor(() => {
        expect(screen.getByText(/caesar salad/i)).toBeInTheDocument()
      })

      const caesarSaladOption = screen.getByText(/caesar salad/i)
      await user.click(caesarSaladOption)

      const lunchSlot = screen.getByTestId('meal-slot-lunch')
      await user.click(lunchSlot)

      // Step 8: Generate and customize shopping list
      const generateListButton = screen.getByRole('button', { name: /generate shopping list/i })
      await user.click(generateListButton)

      await waitFor(() => {
        expect(screen.getByText(/shopping list generated/i)).toBeInTheDocument()
      })

      // Verify shopping list contains expected ingredients
      expect(screen.getByText('Spaghetti')).toBeInTheDocument()
      expect(screen.getByText('Eggs')).toBeInTheDocument()
      expect(screen.getByText('Parmesan')).toBeInTheDocument()

      // Step 9: Customize shopping list
      const customizeButton = screen.getByRole('button', { name: /customize list/i })
      await user.click(customizeButton)

      // Add custom item
      const addCustomItemButton = screen.getByRole('button', { name: /add custom item/i })
      await user.click(addCustomItemButton)

      await user.type(screen.getByLabelText(/item name/i), 'Wine')
      await user.type(screen.getByLabelText(/quantity/i), '1')
      await user.selectOptions(screen.getByLabelText(/unit/i), 'bottle')

      const addItemButton = screen.getByRole('button', { name: /add item/i })
      await user.click(addItemButton)

      // Step 10: Export shopping list
      const exportButton = screen.getByRole('button', { name: /export list/i })
      await user.click(exportButton)

      const exportToPdfButton = screen.getByRole('button', { name: /export to pdf/i })
      await user.click(exportToPdfButton)

      await waitFor(() => {
        expect(screen.getByText(/export completed/i)).toBeInTheDocument()
      })

      // Step 11: Share meal plan
      const shareButton = screen.getByRole('button', { name: /share meal plan/i })
      await user.click(shareButton)

      const shareLinkButton = screen.getByRole('button', { name: /copy share link/i })
      await user.click(shareLinkButton)

      await waitFor(() => {
        expect(screen.getByText(/link copied/i)).toBeInTheDocument()
      })

      // Step 12: Verify complete meal plan
      expect(screen.getByText('Pasta Night')).toBeInTheDocument()
      expect(screen.getByText('Pasta Carbonara')).toBeInTheDocument()
      expect(screen.getByText(/total cost.*\$\d+/i)).toBeInTheDocument()
      expect(screen.getByText(/wine.*1 bottle/i)).toBeInTheDocument()
    }, 45000)
  })

  describe('Journey 3: Trip Collaboration → Participant Management → Meal Coordination', () => {
    it('should complete the collaborative trip planning flow', async () => {
      // Start as trip organizer
      simulateAuthentication({
        id: 'organizer-1',
        email: 'organizer@example.com',
        firstName: 'Trip',
        lastName: 'Organizer',
        role: 'user',
      })

      renderWithProviders(<App />, {
        providerOptions: {
          initialEntries: ['/dashboard/trips/trip-1'],
          useMemoryRouter: true,
        }
      })

      // Step 1: View existing trip details
      await waitFor(() => {
        expect(screen.getByText('Mountain Retreat')).toBeInTheDocument()
      })

      // Step 2: Navigate to participant management
      const participantsTab = screen.getByRole('tab', { name: /participants/i })
      await user.click(participantsTab)

      expect(screen.getByText(/6 participants/i)).toBeInTheDocument()

      // Step 3: Invite new participants
      const inviteParticipantButton = screen.getByRole('button', { name: /invite participant/i })
      await user.click(inviteParticipantButton)

      await user.type(screen.getByLabelText(/email address/i), 'newparticipant@example.com')
      
      // Set dietary restrictions
      const dietaryRestrictionsSelect = screen.getByLabelText(/dietary restrictions/i)
      await user.selectOptions(dietaryRestrictionsSelect, ['vegetarian', 'gluten-free'])

      const sendInviteButton = screen.getByRole('button', { name: /send invitation/i })
      await user.click(sendInviteButton)

      await waitFor(() => {
        expect(screen.getByText(/invitation sent/i)).toBeInTheDocument()
      })

      // Step 4: Manage participant roles
      const participantRow = screen.getByTestId('participant-friend@example.com')
      const roleSelect = within(participantRow).getByLabelText(/role/i)
      await user.selectOptions(roleSelect, 'co-organizer')

      await waitFor(() => {
        expect(screen.getByText(/role updated/i)).toBeInTheDocument()
      })

      // Step 5: Configure meal preferences
      const mealPlanningTab = screen.getByRole('tab', { name: /meal planning/i })
      await user.click(mealPlanningTab)

      // View dietary restrictions summary
      expect(screen.getByText(/dietary restrictions summary/i)).toBeInTheDocument()
      expect(screen.getByText(/1 vegetarian/i)).toBeInTheDocument()
      expect(screen.getByText(/1 gluten-free/i)).toBeInTheDocument()

      // Step 6: Assign recipes considering dietary restrictions
      const day1 = screen.getByTestId('day-2024-07-15')
      const dinnerSlot = within(day1).getByTestId('meal-slot-dinner')
      await user.click(dinnerSlot)

      // Recipe suggestions should consider dietary restrictions
      expect(screen.getByText(/recipes suitable for all participants/i)).toBeInTheDocument()
      
      const vegetarianRecipe = screen.getByText(/vegetarian pasta primavera/i)
      await user.click(vegetarianRecipe)

      const assignRecipeButton = screen.getByRole('button', { name: /assign recipe/i })
      await user.click(assignRecipeButton)

      // Step 7: Real-time collaboration simulation
      // Simulate another participant making changes
      await waitFor(() => {
        expect(screen.getByText(/meal plan updated by.*friend@example\.com/i)).toBeInTheDocument()
      })

      // Step 8: Conflict resolution
      const conflictNotification = screen.getByText(/conflict detected/i)
      expect(conflictNotification).toBeInTheDocument()

      const resolveConflictButton = screen.getByRole('button', { name: /resolve conflict/i })
      await user.click(resolveConflictButton)

      // Choose resolution strategy
      const keepBothOption = screen.getByText(/keep both recipes/i)
      await user.click(keepBothOption)

      const resolveButton = screen.getByRole('button', { name: /resolve/i })
      await user.click(resolveButton)

      // Step 9: Generate collaborative shopping list
      const generateShoppingListButton = screen.getByRole('button', { name: /generate shopping list/i })
      await user.click(generateShoppingListButton)

      await waitFor(() => {
        expect(screen.getByText(/shopping list for 7 participants/i)).toBeInTheDocument()
      })

      // Verify dietary accommodations
      expect(screen.getByText(/gluten-free pasta/i)).toBeInTheDocument()
      expect(screen.getByText(/vegetarian options marked/i)).toBeInTheDocument()

      // Step 10: Assign shopping responsibilities
      const assignShoppingButton = screen.getByRole('button', { name: /assign shopping tasks/i })
      await user.click(assignShoppingButton)

      const participantSelect = screen.getByLabelText(/assign to participant/i)
      await user.selectOptions(participantSelect, 'friend@example.com')

      const groceryStoreSelect = screen.getByLabelText(/grocery store/i)
      await user.selectOptions(groceryStoreSelect, 'Whole Foods')

      const assignButton = screen.getByRole('button', { name: /assign tasks/i })
      await user.click(assignButton)

      // Step 11: Communication features
      const chatTab = screen.getByRole('tab', { name: /group chat/i })
      await user.click(chatTab)

      const messageInput = screen.getByPlaceholderText(/type a message/i)
      await user.type(messageInput, 'Shopping list is ready! Who can pick up the groceries?')

      const sendMessageButton = screen.getByRole('button', { name: /send/i })
      await user.click(sendMessageButton)

      expect(screen.getByText(/shopping list is ready/i)).toBeInTheDocument()

      // Step 12: Final trip summary
      const summaryTab = screen.getByRole('tab', { name: /summary/i })
      await user.click(summaryTab)

      expect(screen.getByText(/7 participants/i)).toBeInTheDocument()
      expect(screen.getByText(/3 days/i)).toBeInTheDocument()
      expect(screen.getByText(/9 meals planned/i)).toBeInTheDocument()
      expect(screen.getByText(/dietary requirements accommodated/i)).toBeInTheDocument()
      expect(screen.getByText(/total estimated cost.*\$\d+/i)).toBeInTheDocument()
    }, 50000)
  })

  describe('Journey 4: Profile Management → Preferences → Data Export', () => {
    it('should complete the user profile and data management flow', async () => {
      // Start as authenticated user
      simulateAuthentication({
        id: 'profile-user-1',
        email: 'profile@example.com',
        firstName: 'Profile',
        lastName: 'User',
        role: 'user',
      })

      renderWithProviders(<App />, {
        providerOptions: {
          initialEntries: ['/dashboard'],
          useMemoryRouter: true,
        }
      })

      // Step 1: Navigate to profile
      const userMenuButton = screen.getByRole('button', { name: /profile user/i })
      await user.click(userMenuButton)

      const profileLink = screen.getByRole('menuitem', { name: /profile/i })
      await user.click(profileLink)

      expect(window.location.pathname).toBe('/dashboard/profile')

      // Step 2: Update profile information
      const editProfileButton = screen.getByRole('button', { name: /edit profile/i })
      await user.click(editProfileButton)

      // Update basic information
      const firstNameInput = screen.getByLabelText(/first name/i)
      await user.clear(firstNameInput)
      await user.type(firstNameInput, 'Updated')

      const bioTextarea = screen.getByLabelText(/bio/i)
      await user.type(bioTextarea, 'I love cooking and planning trips with friends!')

      // Update dietary preferences
      const dietaryPreferences = screen.getByLabelText(/dietary preferences/i)
      await user.selectOptions(dietaryPreferences, ['vegetarian', 'low-sodium'])

      // Update cooking skill level
      const skillLevelSlider = screen.getByLabelText(/cooking skill level/i)
      await user.clear(skillLevelSlider)
      await user.type(skillLevelSlider, '7')

      // Save changes
      const saveProfileButton = screen.getByRole('button', { name: /save changes/i })
      await user.click(saveProfileButton)

      await waitFor(() => {
        expect(screen.getByText(/profile updated successfully/i)).toBeInTheDocument()
      })

      // Step 3: Configure preferences
      const preferencesTab = screen.getByRole('tab', { name: /preferences/i })
      await user.click(preferencesTab)

      // Notification preferences
      const emailNotifications = screen.getByLabelText(/email notifications/i)
      await user.click(emailNotifications)

      const tripInvitations = screen.getByLabelText(/trip invitation notifications/i)
      await user.click(tripInvitations)

      // Recipe preferences
      const defaultServings = screen.getByLabelText(/default servings/i)
      await user.clear(defaultServings)
      await user.type(defaultServings, '6')

      const measurementSystem = screen.getByLabelText(/measurement system/i)
      await user.selectOptions(measurementSystem, 'metric')

      // Privacy preferences
      const profileVisibility = screen.getByLabelText(/profile visibility/i)
      await user.selectOptions(profileVisibility, 'friends-only')

      const savePreferencesButton = screen.getByRole('button', { name: /save preferences/i })
      await user.click(savePreferencesButton)

      await waitFor(() => {
        expect(screen.getByText(/preferences saved/i)).toBeInTheDocument()
      })

      // Step 4: Security settings
      const securityTab = screen.getByRole('tab', { name: /security/i })
      await user.click(securityTab)

      // Change password
      const changePasswordButton = screen.getByRole('button', { name: /change password/i })
      await user.click(changePasswordButton)

      await user.type(screen.getByLabelText(/current password/i), 'currentpass123')
      await user.type(screen.getByLabelText(/new password/i), 'newpass123!')
      await user.type(screen.getByLabelText(/confirm new password/i), 'newpass123!')

      const updatePasswordButton = screen.getByRole('button', { name: /update password/i })
      await user.click(updatePasswordButton)

      await waitFor(() => {
        expect(screen.getByText(/password updated successfully/i)).toBeInTheDocument()
      })

      // Enable two-factor authentication
      const enable2FAButton = screen.getByRole('button', { name: /enable two-factor authentication/i })
      await user.click(enable2FAButton)

      // Simulate QR code scanning
      const verificationCode = screen.getByLabelText(/verification code/i)
      await user.type(verificationCode, '123456')

      const verify2FAButton = screen.getByRole('button', { name: /verify and enable/i })
      await user.click(verify2FAButton)

      await waitFor(() => {
        expect(screen.getByText(/two-factor authentication enabled/i)).toBeInTheDocument()
      })

      // Step 5: Data management
      const dataTab = screen.getByRole('tab', { name: /data/i })
      await user.click(dataTab)

      // Export user data
      const exportDataButton = screen.getByRole('button', { name: /export my data/i })
      await user.click(exportDataButton)

      // Select export format
      const exportFormatSelect = screen.getByLabelText(/export format/i)
      await user.selectOptions(exportFormatSelect, 'json')

      // Select data types
      const includeRecipes = screen.getByLabelText(/include recipes/i)
      await user.click(includeRecipes)

      const includeTrips = screen.getByLabelText(/include trips/i)
      await user.click(includeTrips)

      const includeProfile = screen.getByLabelText(/include profile data/i)
      await user.click(includeProfile)

      const startExportButton = screen.getByRole('button', { name: /start export/i })
      await user.click(startExportButton)

      // Wait for export completion
      await waitFor(() => {
        expect(screen.getByText(/export completed/i)).toBeInTheDocument()
      }, { timeout: 10000 })

      const downloadButton = screen.getByRole('button', { name: /download export/i })
      await user.click(downloadButton)

      // Step 6: Account statistics
      const statisticsTab = screen.getByRole('tab', { name: /statistics/i })
      await user.click(statisticsTab)

      // Verify account statistics
      expect(screen.getByText(/recipes created/i)).toBeInTheDocument()
      expect(screen.getByText(/trips organized/i)).toBeInTheDocument()
      expect(screen.getByText(/meals planned/i)).toBeInTheDocument()
      expect(screen.getByText(/account created/i)).toBeInTheDocument()

      // Activity timeline
      expect(screen.getByText(/recent activity/i)).toBeInTheDocument()
      expect(screen.getByText(/profile updated/i)).toBeInTheDocument()
      expect(screen.getByText(/preferences changed/i)).toBeInTheDocument()

      // Step 7: Account deletion (test flow but don't execute)
      const dangerZoneSection = screen.getByTestId('danger-zone')
      expect(dangerZoneSection).toBeInTheDocument()

      const deleteAccountButton = within(dangerZoneSection).getByRole('button', { name: /delete account/i })
      await user.click(deleteAccountButton)

      // Verify confirmation dialog
      expect(screen.getByText(/permanently delete your account/i)).toBeInTheDocument()
      expect(screen.getByText(/this action cannot be undone/i)).toBeInTheDocument()

      // Cancel deletion
      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await user.click(cancelButton)

      // Verify we're back to normal view
      expect(screen.queryByText(/permanently delete/i)).not.toBeInTheDocument()

      // Step 8: Verify all changes persisted
      // Refresh page to ensure data persistence
      const refreshButton = screen.getByRole('button', { name: /refresh/i })
      await user.click(refreshButton)

      await waitFor(() => {
        expect(screen.getByDisplayValue('Updated')).toBeInTheDocument()
        expect(screen.getByText(/vegetarian, low-sodium/i)).toBeInTheDocument()
        expect(screen.getByText(/two-factor authentication.*enabled/i)).toBeInTheDocument()
      })
    }, 60000)
  })

  describe('Journey 5: Mobile App Workflows and Responsive Behavior', () => {
    beforeEach(() => {
      // Simulate mobile viewport
      Object.defineProperties(window, {
        innerWidth: { value: 375, writable: true },
        innerHeight: { value: 667, writable: true },
      })
      window.dispatchEvent(new Event('resize'))
    })

    it('should complete mobile-optimized user workflows', async () => {
      simulateAuthentication({
        id: 'mobile-user-1',
        email: 'mobile@example.com',
        firstName: 'Mobile',
        lastName: 'User',
        role: 'user',
      })

      renderWithProviders(<App />, {
        providerOptions: {
          initialEntries: ['/dashboard'],
          useMemoryRouter: true,
        }
      })

      // Step 1: Mobile navigation
      const mobileMenuButton = screen.getByLabelText(/menu/i)
      await user.click(mobileMenuButton)

      // Verify mobile menu is open
      expect(screen.getByRole('navigation', { name: /mobile menu/i })).toBeInTheDocument()

      // Navigate to recipes
      const recipesLink = screen.getByRole('link', { name: /recipes/i })
      await user.click(recipesLink)

      // Menu should close after navigation
      expect(screen.queryByRole('navigation', { name: /mobile menu/i })).not.toBeInTheDocument()

      // Step 2: Mobile recipe creation with touch interactions
      const addRecipeButton = screen.getByRole('button', { name: /add recipe/i })
      await user.click(addRecipeButton)

      // Mobile-optimized form should be displayed
      expect(screen.getByTestId('mobile-recipe-form')).toBeInTheDocument()

      // Fill form using mobile patterns
      await user.type(screen.getByLabelText(/recipe name/i), 'Mobile Recipe')

      // Mobile photo upload
      const photoUploadButton = screen.getByRole('button', { name: /add photo/i })
      await user.click(photoUploadButton)

      // Simulate camera access
      const cameraOption = screen.getByText(/take photo/i)
      await user.click(cameraOption)

      await waitFor(() => {
        expect(screen.getByText(/photo added/i)).toBeInTheDocument()
      })

      // Step 3: Mobile ingredient input with autocomplete
      const ingredientInput = screen.getByLabelText(/add ingredient/i)
      await user.type(ingredientInput, 'tom')

      // Wait for autocomplete suggestions
      await waitFor(() => {
        expect(screen.getByText('Tomatoes')).toBeInTheDocument()
      })

      // Tap suggestion
      const tomatoSuggestion = screen.getByText('Tomatoes')
      await user.click(tomatoSuggestion)

      // Mobile quantity picker
      const quantityPicker = screen.getByLabelText(/quantity/i)
      await user.type(quantityPicker, '2')

      const unitPicker = screen.getByLabelText(/unit/i)
      await user.selectOptions(unitPicker, 'pieces')

      // Step 4: Save recipe and verify mobile feedback
      const saveButton = screen.getByRole('button', { name: /save/i })
      await user.click(saveButton)

      // Mobile success toast
      await waitFor(() => {
        expect(screen.getByText(/recipe saved/i)).toBeInTheDocument()
      })

      // Step 5: Mobile trip planning with swipe gestures
      const tripsTab = screen.getByRole('tab', { name: /trips/i })
      await user.click(tripsTab)

      const createTripButton = screen.getByRole('button', { name: /create trip/i })
      await user.click(createTripButton)

      // Mobile trip wizard
      expect(screen.getByTestId('mobile-trip-wizard')).toBeInTheDocument()

      // Step 1: Basic info
      await user.type(screen.getByLabelText(/trip name/i), 'Mobile Trip')

      const nextButton = screen.getByRole('button', { name: /next/i })
      await user.click(nextButton)

      // Step 2: Dates with mobile date picker
      const startDateButton = screen.getByRole('button', { name: /select start date/i })
      await user.click(startDateButton)

      // Mobile calendar should appear
      expect(screen.getByRole('dialog', { name: /date picker/i })).toBeInTheDocument()

      const dateOption = screen.getByText('15')
      await user.click(dateOption)

      const confirmDateButton = screen.getByRole('button', { name: /confirm/i })
      await user.click(confirmDateButton)

      await user.click(nextButton)

      // Step 3: Participants with mobile contact picker
      const addParticipantButton = screen.getByRole('button', { name: /add participant/i })
      await user.click(addParticipantButton)

      const contactsButton = screen.getByRole('button', { name: /from contacts/i })
      await user.click(contactsButton)

      // Simulate contact selection
      const contactOption = screen.getByText('John Doe')
      await user.click(contactOption)

      await user.click(nextButton)

      // Step 4: Finish trip creation
      const createButton = screen.getByRole('button', { name: /create trip/i })
      await user.click(createButton)

      // Step 6: Mobile meal planning with drag and drop
      const planMealsButton = screen.getByRole('button', { name: /plan meals/i })
      await user.click(planMealsButton)

      // Mobile meal planning interface
      expect(screen.getByTestId('mobile-meal-planner')).toBeInTheDocument()

      // Simulate swipe to navigate days
      const dayContainer = screen.getByTestId('day-container')
      
      // Touch events simulation for swipe
      const touchStart = { touches: [{ clientX: 300, clientY: 100 }] }
      const touchMove = { touches: [{ clientX: 100, clientY: 100 }] }
      const touchEnd = { touches: [] }

      fireEvent.touchStart(dayContainer, touchStart)
      fireEvent.touchMove(dayContainer, touchMove)
      fireEvent.touchEnd(dayContainer, touchEnd)

      // Should navigate to next day
      expect(screen.getByText(/day 2/i)).toBeInTheDocument()

      // Step 7: Mobile shopping list with checkoff
      const shoppingListTab = screen.getByRole('tab', { name: /shopping/i })
      await user.click(shoppingListTab)

      // Mobile shopping list interface
      expect(screen.getByTestId('mobile-shopping-list')).toBeInTheDocument()

      // Check off items
      const shoppingItem = screen.getByTestId('shopping-item-tomatoes')
      const checkbox = within(shoppingItem).getByRole('checkbox')
      await user.click(checkbox)

      // Item should be marked as checked with mobile feedback
      expect(checkbox).toBeChecked()
      expect(shoppingItem).toHaveClass('checked')

      // Step 8: Mobile sharing and offline functionality
      const shareButton = screen.getByRole('button', { name: /share/i })
      await user.click(shareButton)

      // Mobile share sheet
      expect(screen.getByRole('dialog', { name: /share options/i })).toBeInTheDocument()

      const shareViaMessageButton = screen.getByRole('button', { name: /share via message/i })
      await user.click(shareViaMessageButton)

      // Simulate offline mode
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
      })

      window.dispatchEvent(new Event('offline'))

      // Offline indicator should appear
      await waitFor(() => {
        expect(screen.getByText(/offline mode/i)).toBeInTheDocument()
      })

      // Test offline functionality
      const offlineChangesButton = screen.getByRole('button', { name: /make changes/i })
      await user.click(offlineChangesButton)

      // Changes should be queued for sync
      expect(screen.getByText(/changes saved locally/i)).toBeInTheDocument()

      // Step 9: Return online and sync
      Object.defineProperty(navigator, 'onLine', {
        value: true,
        writable: true,
      })

      window.dispatchEvent(new Event('online'))

      // Sync should occur automatically
      await waitFor(() => {
        expect(screen.getByText(/syncing changes/i)).toBeInTheDocument()
      })

      await waitFor(() => {
        expect(screen.getByText(/sync completed/i)).toBeInTheDocument()
      })

      // Step 10: Mobile performance validation
      // Verify smooth scrolling and responsive interactions
      const scrollContainer = screen.getByTestId('scroll-container')
      fireEvent.scroll(scrollContainer, { target: { scrollY: 100 } })

      // Verify virtual scrolling for large lists
      expect(screen.getByTestId('virtual-list')).toBeInTheDocument()

      // Verify touch feedback and haptics
      const actionButton = screen.getByRole('button', { name: /primary action/i })
      fireEvent.touchStart(actionButton)
      
      await waitFor(() => {
        expect(actionButton).toHaveClass('touch-feedback')
      })

      fireEvent.touchEnd(actionButton)
    }, 45000)
  })
})
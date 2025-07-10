import React, { useEffect } from 'react'
import { useAuthStore, useRecipeStore, useUIStore } from '@store'
import { useIsAuthenticated, useCurrentUser } from '@store/hooks'

/**
 * Example component demonstrating Zustand store usage
 */
export const StoreExample: React.FC = () => {
  // Direct store usage
  const authStore = useAuthStore()
  const { recipes, loading, fetchRecipes } = useRecipeStore()
  const { showToast, theme, setTheme } = useUIStore()
  
  // Using custom hooks/selectors
  const isAuthenticated = useIsAuthenticated()
  const currentUser = useCurrentUser()
  
  // Fetch recipes on mount
  useEffect(() => {
    if (isAuthenticated) {
      fetchRecipes()
    }
  }, [isAuthenticated, fetchRecipes])
  
  const handleLogin = async () => {
    try {
      await authStore.login({ 
        email: 'test@example.com', 
        password: 'password123' 
      })
      // Success is handled by the store and shows a toast
    } catch (error) {
      // Error is also handled by the store
      console.error('Login failed', error)
    }
  }
  
  const handleThemeToggle = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    showToast({
      type: 'info',
      title: 'Theme Changed',
      message: `Switched to ${newTheme} mode`
    })
  }
  
  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Zustand Store Example</h2>
      
      {/* Auth Section */}
      <section className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Authentication</h3>
        {isAuthenticated ? (
          <div>
            <p>Logged in as: {currentUser?.email}</p>
            <button 
              onClick={authStore.logout}
              className="btn btn-secondary mt-2"
            >
              Logout
            </button>
          </div>
        ) : (
          <button 
            onClick={handleLogin}
            className="btn btn-primary"
            disabled={authStore.loading}
          >
            {authStore.loading ? 'Logging in...' : 'Login'}
          </button>
        )}
      </section>
      
      {/* Recipe Section */}
      <section className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Recipes</h3>
        {loading ? (
          <p>Loading recipes...</p>
        ) : (
          <div>
            <p>Total recipes: {recipes.length}</p>
            <button 
              onClick={() => fetchRecipes()}
              className="btn btn-secondary mt-2"
            >
              Refresh Recipes
            </button>
          </div>
        )}
      </section>
      
      {/* UI Section */}
      <section>
        <h3 className="text-lg font-semibold mb-2">UI Controls</h3>
        <div className="space-y-2">
          <button 
            onClick={handleThemeToggle}
            className="btn btn-secondary"
          >
            Toggle Theme (Current: {theme})
          </button>
          <button 
            onClick={() => showToast({
              type: 'success',
              title: 'Test Toast',
              message: 'This is a test notification'
            })}
            className="btn btn-secondary ml-2"
          >
            Show Toast
          </button>
        </div>
      </section>
    </div>
  )
}
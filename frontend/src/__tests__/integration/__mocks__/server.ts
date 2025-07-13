import { setupServer } from 'msw/node'
import { http, HttpResponse, delay } from 'msw'

// Mock data
const mockUsers = [
  {
    id: 'user-1',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    role: 'user',
    emailVerified: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'admin-1',
    email: 'admin@example.com',
    firstName: 'Admin',
    lastName: 'User',
    role: 'admin',
    emailVerified: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  }
]

const mockRecipes = [
  {
    id: 'recipe-1',
    name: 'Pasta Carbonara',
    description: 'Classic Italian pasta dish',
    prepTime: 15,
    cookTime: 20,
    servings: 4,
    difficulty: 'medium',
    cuisine: 'Italian',
    category: 'Main Course',
    ingredients: [
      { id: 'ing-1', name: 'Spaghetti', amount: 400, unit: 'g' },
      { id: 'ing-2', name: 'Eggs', amount: 4, unit: 'pieces' },
      { id: 'ing-3', name: 'Parmesan', amount: 100, unit: 'g' },
      { id: 'ing-4', name: 'Pancetta', amount: 150, unit: 'g' },
    ],
    instructions: [
      { step: 1, description: 'Cook pasta according to package instructions' },
      { step: 2, description: 'Fry pancetta until crispy' },
      { step: 3, description: 'Beat eggs with parmesan' },
      { step: 4, description: 'Combine everything while pasta is hot' },
    ],
    nutrition: {
      calories: 520,
      protein: 24,
      carbs: 58,
      fat: 18,
    },
    tags: ['quick', 'traditional'],
    imageUrl: 'https://example.com/carbonara.jpg',
    rating: 4.7,
    ratingCount: 156,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    userId: 'user-1',
  },
  {
    id: 'recipe-2',
    name: 'Chicken Tikka Masala',
    description: 'Creamy Indian curry',
    prepTime: 30,
    cookTime: 40,
    servings: 6,
    difficulty: 'medium',
    cuisine: 'Indian',
    category: 'Main Course',
    ingredients: [
      { id: 'ing-5', name: 'Chicken breast', amount: 800, unit: 'g' },
      { id: 'ing-6', name: 'Coconut milk', amount: 400, unit: 'ml' },
      { id: 'ing-7', name: 'Tomatoes', amount: 400, unit: 'g' },
    ],
    instructions: [
      { step: 1, description: 'Marinate chicken in spices' },
      { step: 2, description: 'Cook chicken until golden' },
      { step: 3, description: 'Make the curry sauce' },
      { step: 4, description: 'Combine and simmer' },
    ],
    nutrition: {
      calories: 380,
      protein: 35,
      carbs: 12,
      fat: 22,
    },
    tags: ['spicy', 'indian'],
    imageUrl: 'https://example.com/tikka-masala.jpg',
    rating: 4.5,
    ratingCount: 89,
    createdAt: '2024-01-02T00:00:00.000Z',
    updatedAt: '2024-01-02T00:00:00.000Z',
    userId: 'user-1',
  }
]

const mockTrips = [
  {
    id: 'trip-1',
    name: 'Mountain Retreat',
    description: 'A relaxing weekend in the mountains',
    location: 'Rocky Mountains, CO',
    startDate: '2024-07-15',
    endDate: '2024-07-17',
    participantCount: 6,
    status: 'planning',
    budget: 800,
    currency: 'USD',
    participants: [
      {
        id: 'participant-1',
        email: 'test@example.com',
        role: 'organizer',
        status: 'accepted',
        dietaryRestrictions: [],
      },
      {
        id: 'participant-2',
        email: 'friend@example.com',
        role: 'participant',
        status: 'pending',
        dietaryRestrictions: ['vegetarian'],
      }
    ],
    mealSlots: [
      { id: 'breakfast', name: 'Breakfast', order: 1, isActive: true },
      { id: 'lunch', name: 'Lunch', order: 2, isActive: true },
      { id: 'dinner', name: 'Dinner', order: 3, isActive: true },
    ],
    days: [
      {
        date: '2024-07-15',
        meals: {
          breakfast: null,
          lunch: { recipeId: 'recipe-1', servings: 6 },
          dinner: { recipeId: 'recipe-2', servings: 6 },
        }
      },
      {
        date: '2024-07-16',
        meals: {
          breakfast: null,
          lunch: null,
          dinner: { recipeId: 'recipe-1', servings: 6 },
        }
      }
    ],
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    userId: 'user-1',
  }
]

const mockIngredients = [
  {
    id: 'ing-1',
    name: 'Spaghetti',
    category: 'Grains',
    defaultUnit: 'g',
    nutrition: { calories: 131, protein: 5, carbs: 25, fat: 1.1 },
    price: 1.50,
    priceUnit: 'per 500g',
    allergens: ['gluten'],
    dietaryTags: ['vegetarian'],
  },
  {
    id: 'ing-2',
    name: 'Eggs',
    category: 'Protein',
    defaultUnit: 'pieces',
    nutrition: { calories: 68, protein: 6, carbs: 0.4, fat: 4.8 },
    price: 3.00,
    priceUnit: 'per dozen',
    allergens: ['eggs'],
    dietaryTags: ['vegetarian'],
  }
]

// API Handlers
export const handlers = [
  // Auth endpoints
  http.post('/api/v1/auth/login', async ({ request }) => {
    await delay(100)
    const body = await request.json() as any
    
    if (body.email === 'error@example.com') {
      return HttpResponse.json(
        { message: 'Invalid credentials' },
        { status: 401 }
      )
    }
    
    const user = mockUsers.find(u => u.email === body.email) || mockUsers[0]
    return HttpResponse.json({
      user,
      tokens: {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
      }
    })
  }),

  http.post('/api/v1/auth/register', async ({ request }) => {
    await delay(150)
    const body = await request.json() as any
    
    if (body.email === 'existing@example.com') {
      return HttpResponse.json(
        { message: 'Email already exists' },
        { status: 409 }
      )
    }
    
    const newUser = {
      id: `user-${Date.now()}`,
      email: body.email,
      firstName: body.firstName || '',
      lastName: body.lastName || '',
      role: 'user',
      emailVerified: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    
    return HttpResponse.json({
      user: newUser,
      tokens: {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
      }
    })
  }),

  http.post('/api/v1/auth/logout', async () => {
    await delay(50)
    return HttpResponse.json({ message: 'Logged out successfully' })
  }),

  http.post('/api/v1/auth/refresh', async ({ request }) => {
    await delay(75)
    return HttpResponse.json({
      tokens: {
        accessToken: 'new-mock-access-token',
        refreshToken: 'new-mock-refresh-token',
      }
    })
  }),

  http.get('/api/v1/auth/me', async () => {
    await delay(50)
    return HttpResponse.json({ user: mockUsers[0] })
  }),

  http.post('/api/v1/auth/verify-email', async () => {
    await delay(100)
    return HttpResponse.json({ message: 'Email verified successfully' })
  }),

  http.post('/api/v1/auth/forgot-password', async () => {
    await delay(200)
    return HttpResponse.json({ message: 'Reset email sent' })
  }),

  http.post('/api/v1/auth/reset-password', async () => {
    await delay(150)
    return HttpResponse.json({ message: 'Password reset successfully' })
  }),

  // Recipe endpoints
  http.get('/api/v1/recipes', async ({ request }) => {
    await delay(100)
    const url = new URL(request.url)
    const search = url.searchParams.get('search') || ''
    const category = url.searchParams.get('category') || ''
    const limit = parseInt(url.searchParams.get('limit') || '20')
    const offset = parseInt(url.searchParams.get('offset') || '0')
    
    let filteredRecipes = [...mockRecipes]
    
    if (search) {
      filteredRecipes = filteredRecipes.filter(recipe =>
        recipe.name.toLowerCase().includes(search.toLowerCase()) ||
        recipe.description.toLowerCase().includes(search.toLowerCase())
      )
    }
    
    if (category) {
      filteredRecipes = filteredRecipes.filter(recipe =>
        recipe.category.toLowerCase() === category.toLowerCase()
      )
    }
    
    const paginatedRecipes = filteredRecipes.slice(offset, offset + limit)
    
    return HttpResponse.json({
      recipes: paginatedRecipes,
      total: filteredRecipes.length,
      limit,
      offset,
    })
  }),

  http.get('/api/v1/recipes/:id', async ({ params }) => {
    await delay(75)
    const recipe = mockRecipes.find(r => r.id === params.id)
    
    if (!recipe) {
      return HttpResponse.json(
        { message: 'Recipe not found' },
        { status: 404 }
      )
    }
    
    return HttpResponse.json({ recipe })
  }),

  http.post('/api/v1/recipes', async ({ request }) => {
    await delay(200)
    const body = await request.json() as any
    
    const newRecipe = {
      id: `recipe-${Date.now()}`,
      ...body,
      rating: 0,
      ratingCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userId: 'user-1',
    }
    
    mockRecipes.push(newRecipe)
    return HttpResponse.json({ recipe: newRecipe }, { status: 201 })
  }),

  http.put('/api/v1/recipes/:id', async ({ params, request }) => {
    await delay(150)
    const body = await request.json() as any
    const recipeIndex = mockRecipes.findIndex(r => r.id === params.id)
    
    if (recipeIndex === -1) {
      return HttpResponse.json(
        { message: 'Recipe not found' },
        { status: 404 }
      )
    }
    
    mockRecipes[recipeIndex] = {
      ...mockRecipes[recipeIndex],
      ...body,
      updatedAt: new Date().toISOString(),
    }
    
    return HttpResponse.json({ recipe: mockRecipes[recipeIndex] })
  }),

  http.delete('/api/v1/recipes/:id', async ({ params }) => {
    await delay(100)
    const recipeIndex = mockRecipes.findIndex(r => r.id === params.id)
    
    if (recipeIndex === -1) {
      return HttpResponse.json(
        { message: 'Recipe not found' },
        { status: 404 }
      )
    }
    
    mockRecipes.splice(recipeIndex, 1)
    return HttpResponse.json({ message: 'Recipe deleted successfully' })
  }),

  // Trip endpoints
  http.get('/api/v1/trips', async ({ request }) => {
    await delay(120)
    const url = new URL(request.url)
    const status = url.searchParams.get('status') || ''
    const limit = parseInt(url.searchParams.get('limit') || '20')
    const offset = parseInt(url.searchParams.get('offset') || '0')
    
    let filteredTrips = [...mockTrips]
    
    if (status) {
      filteredTrips = filteredTrips.filter(trip => trip.status === status)
    }
    
    const paginatedTrips = filteredTrips.slice(offset, offset + limit)
    
    return HttpResponse.json({
      trips: paginatedTrips,
      total: filteredTrips.length,
      limit,
      offset,
    })
  }),

  http.get('/api/v1/trips/:id', async ({ params }) => {
    await delay(100)
    const trip = mockTrips.find(t => t.id === params.id)
    
    if (!trip) {
      return HttpResponse.json(
        { message: 'Trip not found' },
        { status: 404 }
      )
    }
    
    return HttpResponse.json({ trip })
  }),

  http.post('/api/v1/trips', async ({ request }) => {
    await delay(250)
    const body = await request.json() as any
    
    const newTrip = {
      id: `trip-${Date.now()}`,
      ...body,
      participantCount: 1,
      status: 'planning',
      participants: [
        {
          id: 'participant-1',
          email: 'test@example.com',
          role: 'organizer',
          status: 'accepted',
          dietaryRestrictions: [],
        }
      ],
      days: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userId: 'user-1',
    }
    
    mockTrips.push(newTrip)
    return HttpResponse.json({ trip: newTrip }, { status: 201 })
  }),

  http.put('/api/v1/trips/:id', async ({ params, request }) => {
    await delay(180)
    const body = await request.json() as any
    const tripIndex = mockTrips.findIndex(t => t.id === params.id)
    
    if (tripIndex === -1) {
      return HttpResponse.json(
        { message: 'Trip not found' },
        { status: 404 }
      )
    }
    
    mockTrips[tripIndex] = {
      ...mockTrips[tripIndex],
      ...body,
      updatedAt: new Date().toISOString(),
    }
    
    return HttpResponse.json({ trip: mockTrips[tripIndex] })
  }),

  // Participants endpoints
  http.post('/api/v1/trips/:tripId/participants', async ({ params, request }) => {
    await delay(150)
    const body = await request.json() as any
    const trip = mockTrips.find(t => t.id === params.tripId)
    
    if (!trip) {
      return HttpResponse.json(
        { message: 'Trip not found' },
        { status: 404 }
      )
    }
    
    const newParticipant = {
      id: `participant-${Date.now()}`,
      email: body.email,
      role: 'participant',
      status: 'pending',
      dietaryRestrictions: body.dietaryRestrictions || [],
    }
    
    trip.participants.push(newParticipant)
    trip.participantCount = trip.participants.length
    
    return HttpResponse.json({ participant: newParticipant }, { status: 201 })
  }),

  // Shopping list endpoints
  http.get('/api/v1/trips/:tripId/shopping-list', async ({ params }) => {
    await delay(200)
    const trip = mockTrips.find(t => t.id === params.tripId)
    
    if (!trip) {
      return HttpResponse.json(
        { message: 'Trip not found' },
        { status: 404 }
      )
    }
    
    const shoppingList = {
      items: [
        {
          id: 'item-1',
          name: 'Spaghetti',
          amount: 800,
          unit: 'g',
          category: 'Grains',
          checked: false,
          estimatedPrice: 2.40,
        },
        {
          id: 'item-2',
          name: 'Eggs',
          amount: 8,
          unit: 'pieces',
          category: 'Protein',
          checked: false,
          estimatedPrice: 2.00,
        }
      ],
      totalEstimatedCost: 15.50,
      currency: 'USD',
      generatedAt: new Date().toISOString(),
    }
    
    return HttpResponse.json({ shoppingList })
  }),

  // Ingredients endpoints
  http.get('/api/v1/ingredients', async ({ request }) => {
    await delay(80)
    const url = new URL(request.url)
    const search = url.searchParams.get('search') || ''
    const category = url.searchParams.get('category') || ''
    
    let filteredIngredients = [...mockIngredients]
    
    if (search) {
      filteredIngredients = filteredIngredients.filter(ingredient =>
        ingredient.name.toLowerCase().includes(search.toLowerCase())
      )
    }
    
    if (category) {
      filteredIngredients = filteredIngredients.filter(ingredient =>
        ingredient.category.toLowerCase() === category.toLowerCase()
      )
    }
    
    return HttpResponse.json({ ingredients: filteredIngredients })
  }),

  // Error simulation endpoints
  http.get('/api/v1/error/500', async () => {
    return HttpResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }),

  http.get('/api/v1/error/timeout', async () => {
    await delay(30000) // Simulate timeout
    return HttpResponse.json({ message: 'Success' })
  }),

  http.get('/api/v1/error/network', async () => {
    throw new Error('Network error')
  }),

  // File upload endpoints
  http.post('/api/v1/upload', async ({ request }) => {
    await delay(500)
    return HttpResponse.json({
      url: 'https://example.com/uploaded-image.jpg',
      filename: 'image.jpg',
      size: 1024000,
    })
  }),

  // Analytics endpoints (for testing)
  http.post('/api/v1/analytics/event', async () => {
    await delay(25)
    return HttpResponse.json({ success: true })
  }),
]

export const server = setupServer(...handlers)
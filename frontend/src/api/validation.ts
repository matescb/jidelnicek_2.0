/**
 * Mock API services for validation
 * 
 * Provides mock endpoints for validation checks with realistic
 * network delays and responses.
 */

// Mock database of existing data
const mockData = {
  emails: new Set([
    'john@example.com',
    'jane@example.com',
    'admin@example.com',
    'test@example.com',
    'user@example.com',
  ]),
  usernames: new Set([
    'john_doe',
    'jane_doe',
    'admin',
    'testuser',
    'demo_user',
  ]),
  recipes: new Map<string, Set<string>>([
    ['user1', new Set(['Spaghetti Carbonara', 'Pizza Margherita', 'Tiramisu'])],
    ['user2', new Set(['Beef Stew', 'Apple Pie', 'Caesar Salad'])],
  ]),
  trips: new Map<string, Set<string>>([
    ['user1', new Set(['Summer Vacation 2024', 'Christmas Trip', 'Weekend Getaway'])],
    ['user2', new Set(['Europe Tour', 'Beach Holiday', 'Mountain Adventure'])],
  ]),
};

/**
 * Simulates network delay
 */
const simulateDelay = (min: number = 200, max: number = 800): Promise<void> => {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
};

/**
 * Check if email is available
 */
export async function checkEmailAvailability(email: string): Promise<boolean> {
  await simulateDelay();
  
  // Simulate occasional network errors
  if (Math.random() < 0.05) {
    throw new Error('Network error checking email availability');
  }
  
  return !mockData.emails.has(email.toLowerCase());
}

/**
 * Check if username is available
 */
export async function checkUsernameAvailability(username: string): Promise<boolean> {
  await simulateDelay();
  
  // Simulate occasional network errors
  if (Math.random() < 0.05) {
    throw new Error('Network error checking username availability');
  }
  
  return !mockData.usernames.has(username.toLowerCase());
}

/**
 * Check if recipe name is unique for user
 */
export async function checkRecipeNameUniqueness(
  recipeName: string,
  userId: string
): Promise<boolean> {
  await simulateDelay(300, 600);
  
  const userRecipes = mockData.recipes.get(userId) || new Set();
  return !userRecipes.has(recipeName);
}

/**
 * Check if trip name is unique for user
 */
export async function checkTripNameUniqueness(
  tripName: string,
  userId: string
): Promise<boolean> {
  await simulateDelay(300, 600);
  
  const userTrips = mockData.trips.get(userId) || new Set();
  return !userTrips.has(tripName);
}

/**
 * Dynamic validation based on custom rules
 */
export async function validateCustomRule(
  value: any,
  rule: {
    type: 'minLength' | 'maxLength' | 'pattern' | 'custom';
    params?: any;
  }
): Promise<{ valid: boolean; error?: string }> {
  await simulateDelay(100, 400);
  
  switch (rule.type) {
    case 'minLength':
      return {
        valid: String(value).length >= rule.params.min,
        error: `Must be at least ${rule.params.min} characters`,
      };
      
    case 'maxLength':
      return {
        valid: String(value).length <= rule.params.max,
        error: `Must be at most ${rule.params.max} characters`,
      };
      
    case 'pattern':
      const regex = new RegExp(rule.params.pattern);
      return {
        valid: regex.test(String(value)),
        error: rule.params.message || 'Invalid format',
      };
      
    case 'custom':
      // Custom validation logic
      const isValid = rule.params.validator(value);
      return {
        valid: isValid,
        error: isValid ? undefined : rule.params.message || 'Validation failed',
      };
      
    default:
      return { valid: true };
  }
}

/**
 * Batch validation for multiple fields
 */
export async function batchValidate(
  validations: Array<{
    field: string;
    value: any;
    validator: (value: any) => Promise<boolean>;
  }>
): Promise<Record<string, { valid: boolean; error?: string }>> {
  await simulateDelay(500, 1000);
  
  const results: Record<string, { valid: boolean; error?: string }> = {};
  
  for (const { field, value, validator } of validations) {
    try {
      const isValid = await validator(value);
      results[field] = { valid: isValid };
    } catch (error) {
      results[field] = {
        valid: false,
        error: error instanceof Error ? error.message : 'Validation failed',
      };
    }
  }
  
  return results;
}

/**
 * Mock API client for validation endpoints
 */
export class ValidationAPI {
  private baseDelay: number;
  private errorRate: number;

  constructor(options?: { baseDelay?: number; errorRate?: number }) {
    this.baseDelay = options?.baseDelay || 300;
    this.errorRate = options?.errorRate || 0.05;
  }

  /**
   * Check email uniqueness with configurable behavior
   */
  async checkEmail(email: string, options?: { skipDelay?: boolean }): Promise<boolean> {
    if (!options?.skipDelay) {
      await simulateDelay(this.baseDelay, this.baseDelay * 2);
    }
    
    if (Math.random() < this.errorRate) {
      throw new Error('Service temporarily unavailable');
    }
    
    return checkEmailAvailability(email);
  }

  /**
   * Check username availability with rate limiting simulation
   */
  async checkUsername(
    username: string,
    options?: { rateLimited?: boolean }
  ): Promise<boolean> {
    await simulateDelay(this.baseDelay, this.baseDelay * 2);
    
    if (options?.rateLimited && Math.random() < 0.2) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }
    
    return checkUsernameAvailability(username);
  }

  /**
   * Add mock data for testing
   */
  addMockEmail(email: string): void {
    mockData.emails.add(email.toLowerCase());
  }

  addMockUsername(username: string): void {
    mockData.usernames.add(username.toLowerCase());
  }

  addMockRecipe(userId: string, recipeName: string): void {
    if (!mockData.recipes.has(userId)) {
      mockData.recipes.set(userId, new Set());
    }
    mockData.recipes.get(userId)!.add(recipeName);
  }

  addMockTrip(userId: string, tripName: string): void {
    if (!mockData.trips.has(userId)) {
      mockData.trips.set(userId, new Set());
    }
    mockData.trips.get(userId)!.add(tripName);
  }

  /**
   * Clear all mock data
   */
  clearMockData(): void {
    mockData.emails.clear();
    mockData.usernames.clear();
    mockData.recipes.clear();
    mockData.trips.clear();
  }
}

// Default API instance
export const validationAPI = new ValidationAPI();
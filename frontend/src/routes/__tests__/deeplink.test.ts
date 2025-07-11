import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  parseDeepLink, 
  generateShareLink, 
  handleDeepLink,
  DeepLinkHandler,
  validateDeepLink,
  extractDeepLinkParams,
  buildDeepLink,
  registerDeepLinkHandler,
  unregisterDeepLinkHandler,
  DeepLinkConfig
} from '../utils/deeplink';

// Mock window.location
const mockLocation = {
  href: 'http://localhost:3000',
  origin: 'http://localhost:3000',
  pathname: '/',
  search: '',
  hash: '',
};

Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
});

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

describe('parseDeepLink', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should parse simple deep link', () => {
    const result = parseDeepLink('app://recipes/123');
    
    expect(result).toEqual({
      scheme: 'app',
      host: 'recipes',
      path: '/123',
      params: {},
      originalUrl: 'app://recipes/123',
    });
  });

  it('should parse deep link with query parameters', () => {
    const result = parseDeepLink('app://recipes/123?category=italian&featured=true');
    
    expect(result).toEqual({
      scheme: 'app',
      host: 'recipes',
      path: '/123',
      params: {
        category: 'italian',
        featured: 'true',
      },
      originalUrl: 'app://recipes/123?category=italian&featured=true',
    });
  });

  it('should parse web URL as deep link', () => {
    const result = parseDeepLink('https://example.com/recipes/123?ref=share');
    
    expect(result).toEqual({
      scheme: 'https',
      host: 'example.com',
      path: '/recipes/123',
      params: {
        ref: 'share',
      },
      originalUrl: 'https://example.com/recipes/123?ref=share',
    });
  });

  it('should handle malformed URLs', () => {
    expect(() => parseDeepLink('invalid-url')).toThrow();
    expect(() => parseDeepLink('')).toThrow();
  });

  it('should decode URL components', () => {
    const result = parseDeepLink('app://search?q=pasta%20recipe&tag=easy%20dinner');
    
    expect(result.params).toEqual({
      q: 'pasta recipe',
      tag: 'easy dinner',
    });
  });
});

describe('generateShareLink', () => {
  beforeEach(() => {
    mockLocation.origin = 'https://app.example.com';
  });

  it('should generate share link for recipe', () => {
    const link = generateShareLink('recipe', { id: '123' });
    
    expect(link).toBe('https://app.example.com/share/recipe/123');
  });

  it('should include query parameters', () => {
    const link = generateShareLink('recipe', { 
      id: '123',
      ref: 'social',
      campaign: 'summer',
    });
    
    expect(link).toBe('https://app.example.com/share/recipe/123?ref=social&campaign=summer');
  });

  it('should handle custom base URL', () => {
    const link = generateShareLink('recipe', { id: '123' }, {
      baseUrl: 'https://custom.example.com',
    });
    
    expect(link).toBe('https://custom.example.com/share/recipe/123');
  });

  it('should encode special characters', () => {
    const link = generateShareLink('search', { 
      q: 'pasta & sauce',
      category: 'quick/easy',
    });
    
    expect(link).toContain('q=pasta%20%26%20sauce');
    expect(link).toContain('category=quick%2Feasy');
  });

  it('should support custom share path', () => {
    const link = generateShareLink('recipe', { id: '123' }, {
      sharePath: '/s',
    });
    
    expect(link).toBe('https://app.example.com/s/recipe/123');
  });
});

describe('handleDeepLink', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should route to correct handler', async () => {
    const recipeHandler = vi.fn().mockResolvedValue(true);
    const searchHandler = vi.fn().mockResolvedValue(true);

    const config: DeepLinkConfig = {
      handlers: {
        recipe: recipeHandler,
        search: searchHandler,
      },
    };

    await handleDeepLink('app://recipe/123', config);
    
    expect(recipeHandler).toHaveBeenCalledWith({
      scheme: 'app',
      host: 'recipe',
      path: '/123',
      params: {},
      originalUrl: 'app://recipe/123',
    });
    expect(searchHandler).not.toHaveBeenCalled();
  });

  it('should handle authentication requirement', async () => {
    const handler = vi.fn().mockResolvedValue(true);
    const authCheck = vi.fn().mockResolvedValue(false);

    const config: DeepLinkConfig = {
      handlers: {
        protected: handler,
      },
      authRequired: ['protected'],
      onAuthRequired: authCheck,
    };

    const result = await handleDeepLink('app://protected/resource', config);
    
    expect(authCheck).toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
    expect(result).toBe(false);
  });

  it('should save deep link for later when auth required', async () => {
    const handler = vi.fn();
    const onAuthRequired = vi.fn();

    const config: DeepLinkConfig = {
      handlers: {
        protected: handler,
      },
      authRequired: ['protected'],
      onAuthRequired,
      saveForLater: true,
    };

    await handleDeepLink('app://protected/resource', config);
    
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'pendingDeepLink',
      'app://protected/resource'
    );
  });

  it('should validate deep links', async () => {
    const handler = vi.fn();
    const validator = vi.fn().mockReturnValue(false);

    const config: DeepLinkConfig = {
      handlers: {
        recipe: handler,
      },
      validator,
    };

    const result = await handleDeepLink('app://recipe/invalid', config);
    
    expect(validator).toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
    expect(result).toBe(false);
  });

  it('should handle errors gracefully', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('Handler error'));
    const onError = vi.fn();

    const config: DeepLinkConfig = {
      handlers: {
        recipe: handler,
      },
      onError,
    };

    const result = await handleDeepLink('app://recipe/123', config);
    
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    expect(result).toBe(false);
  });
});

describe('validateDeepLink', () => {
  it('should validate allowed schemes', () => {
    const validator = validateDeepLink({
      allowedSchemes: ['app', 'https'],
    });

    expect(validator({ scheme: 'app' } as any)).toBe(true);
    expect(validator({ scheme: 'https' } as any)).toBe(true);
    expect(validator({ scheme: 'http' } as any)).toBe(false);
  });

  it('should validate allowed hosts', () => {
    const validator = validateDeepLink({
      allowedHosts: ['recipes', 'search'],
    });

    expect(validator({ host: 'recipes' } as any)).toBe(true);
    expect(validator({ host: 'search' } as any)).toBe(true);
    expect(validator({ host: 'unknown' } as any)).toBe(false);
  });

  it('should validate path patterns', () => {
    const validator = validateDeepLink({
      pathPatterns: {
        recipe: /^\/\d+$/,
        search: /^\/$/,
      },
    });

    expect(validator({ host: 'recipe', path: '/123' } as any)).toBe(true);
    expect(validator({ host: 'recipe', path: '/abc' } as any)).toBe(false);
    expect(validator({ host: 'search', path: '/' } as any)).toBe(true);
  });

  it('should validate required params', () => {
    const validator = validateDeepLink({
      requiredParams: {
        search: ['q'],
        recipe: ['id'],
      },
    });

    expect(validator({ 
      host: 'search', 
      params: { q: 'pasta' } 
    } as any)).toBe(true);

    expect(validator({ 
      host: 'search', 
      params: {} 
    } as any)).toBe(false);
  });
});

describe('extractDeepLinkParams', () => {
  it('should extract path parameters', () => {
    const params = extractDeepLinkParams('/recipes/123/edit', '/recipes/:id/:action');
    
    expect(params).toEqual({
      id: '123',
      action: 'edit',
    });
  });

  it('should handle optional parameters', () => {
    const params = extractDeepLinkParams('/recipes/123', '/recipes/:id/:action?');
    
    expect(params).toEqual({
      id: '123',
    });
  });

  it('should return null for non-matching paths', () => {
    const params = extractDeepLinkParams('/search', '/recipes/:id');
    
    expect(params).toBeNull();
  });

  it('should handle complex patterns', () => {
    const params = extractDeepLinkParams(
      '/users/john/posts/123/comments/456',
      '/users/:username/posts/:postId/comments/:commentId'
    );
    
    expect(params).toEqual({
      username: 'john',
      postId: '123',
      commentId: '456',
    });
  });
});

describe('buildDeepLink', () => {
  it('should build deep link from components', () => {
    const link = buildDeepLink({
      scheme: 'app',
      host: 'recipe',
      path: '/123',
      params: { ref: 'share' },
    });
    
    expect(link).toBe('app://recipe/123?ref=share');
  });

  it('should handle empty params', () => {
    const link = buildDeepLink({
      scheme: 'https',
      host: 'example.com',
      path: '/recipes/123',
    });
    
    expect(link).toBe('https://example.com/recipes/123');
  });

  it('should encode params properly', () => {
    const link = buildDeepLink({
      scheme: 'app',
      host: 'search',
      path: '/',
      params: {
        q: 'pasta & sauce',
        tags: ['easy', 'quick dinner'],
      },
    });
    
    expect(link).toContain('q=pasta%20%26%20sauce');
    expect(link).toContain('tags=easy&tags=quick%20dinner');
  });
});

describe('DeepLinkHandler', () => {
  let handlers: Map<string, DeepLinkHandler>;

  beforeEach(() => {
    handlers = new Map();
    vi.clearAllMocks();
  });

  it('should register and unregister handlers', () => {
    const handler: DeepLinkHandler = vi.fn();
    
    registerDeepLinkHandler('recipe', handler, handlers);
    expect(handlers.has('recipe')).toBe(true);
    
    unregisterDeepLinkHandler('recipe', handlers);
    expect(handlers.has('recipe')).toBe(false);
  });

  it('should prevent duplicate handlers', () => {
    const handler1: DeepLinkHandler = vi.fn();
    const handler2: DeepLinkHandler = vi.fn();
    
    registerDeepLinkHandler('recipe', handler1, handlers);
    expect(() => {
      registerDeepLinkHandler('recipe', handler2, handlers);
    }).toThrow('Handler already registered for type: recipe');
  });

  it('should chain handlers', async () => {
    const handler1 = vi.fn().mockResolvedValue(true);
    const handler2 = vi.fn().mockResolvedValue(true);
    const handler3 = vi.fn().mockResolvedValue(true);

    const chainedHandler = chainDeepLinkHandlers([handler1, handler2, handler3]);
    
    const parsed = parseDeepLink('app://recipe/123');
    await chainedHandler(parsed);
    
    expect(handler1).toHaveBeenCalledWith(parsed);
    expect(handler2).toHaveBeenCalledWith(parsed);
    expect(handler3).toHaveBeenCalledWith(parsed);
  });

  it('should stop chain on false return', async () => {
    const handler1 = vi.fn().mockResolvedValue(true);
    const handler2 = vi.fn().mockResolvedValue(false);
    const handler3 = vi.fn().mockResolvedValue(true);

    const chainedHandler = chainDeepLinkHandlers([handler1, handler2, handler3]);
    
    const parsed = parseDeepLink('app://recipe/123');
    const result = await chainedHandler(parsed);
    
    expect(handler1).toHaveBeenCalled();
    expect(handler2).toHaveBeenCalled();
    expect(handler3).not.toHaveBeenCalled();
    expect(result).toBe(false);
  });
});

describe('Integration Tests', () => {
  it('should handle complete deep link flow', async () => {
    // Setup
    const navigate = vi.fn();
    const checkAuth = vi.fn().mockResolvedValue(true);
    
    const config: DeepLinkConfig = {
      handlers: {
        recipe: async (parsed) => {
          const params = extractDeepLinkParams(parsed.path, '/:id');
          if (params) {
            navigate(`/recipes/${params.id}`);
            return true;
          }
          return false;
        },
      },
      validator: validateDeepLink({
        allowedSchemes: ['app', 'https'],
        pathPatterns: {
          recipe: /^\/\d+$/,
        },
      }),
      authRequired: ['recipe'],
      onAuthRequired: checkAuth,
    };

    // Execute
    const result = await handleDeepLink('app://recipe/123?ref=email', config);
    
    // Verify
    expect(checkAuth).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/recipes/123');
    expect(result).toBe(true);
  });

  it('should handle pending deep links after auth', async () => {
    // Save pending deep link
    localStorageMock.getItem.mockReturnValue('app://recipe/123');
    
    const handler = vi.fn().mockResolvedValue(true);
    const config: DeepLinkConfig = {
      handlers: {
        recipe: handler,
      },
    };

    // Process pending deep link
    const pendingLink = localStorage.getItem('pendingDeepLink');
    if (pendingLink) {
      await handleDeepLink(pendingLink, config);
      localStorage.removeItem('pendingDeepLink');
    }
    
    expect(handler).toHaveBeenCalled();
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('pendingDeepLink');
  });
});
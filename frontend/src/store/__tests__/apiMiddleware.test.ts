import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import { create } from 'zustand';
import { createAPIMiddleware } from '../middleware/apiMiddleware';
import type { APIMiddlewareConfig, APIRequest, CircuitBreakerState } from '../middleware/apiMiddleware';

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('API Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Basic API Calls', () => {
    interface TestState {
      data: any;
      loading: boolean;
      error: string | null;
      fetchData: () => Promise<void>;
      postData: (data: any) => Promise<void>;
      updateData: (id: string, data: any) => Promise<void>;
      deleteData: (id: string) => Promise<void>;
    }

    it('should make API calls with proper configuration', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 1, name: 'Test' }),
      });

      const config: APIMiddlewareConfig = {
        baseURL: 'https://api.example.com',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'test-key',
        },
      };

      const apiMiddleware = createAPIMiddleware(config);

      const useStore = create<TestState>()(
        apiMiddleware((set, get, api) => ({
          data: null,
          loading: false,
          error: null,
          fetchData: async () => {
            set({ loading: true, error: null });
            try {
              const response = await api.get('/data');
              set({ data: response, loading: false });
            } catch (error) {
              set({ error: (error as Error).message, loading: false });
            }
          },
          postData: async (data) => {
            const response = await api.post('/data', data);
            set({ data: response });
          },
          updateData: async (id, data) => {
            await api.put(`/data/${id}`, data);
          },
          deleteData: async (id) => {
            await api.delete(`/data/${id}`);
          },
        }))
      );

      await useStore.getState().fetchData();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/data',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-API-Key': 'test-key',
          }),
        })
      );

      expect(useStore.getState().data).toEqual({ id: 1, name: 'Test' });
      expect(useStore.getState().loading).toBe(false);
      expect(useStore.getState().error).toBeNull();
    });

    it('should handle different HTTP methods', async () => {
      const responses = {
        get: { data: 'get response' },
        post: { data: 'post response' },
        put: { data: 'put response' },
        delete: { data: 'delete response' },
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => responses.get,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => responses.post,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => responses.put,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => responses.delete,
        });

      const apiMiddleware = createAPIMiddleware({});

      const useStore = create<{ api: any }>()(
        apiMiddleware((set, get, api) => ({
          api,
        }))
      );

      const { api } = useStore.getState();

      const getResult = await api.get('/test');
      expect(getResult).toEqual(responses.get);
      expect(mockFetch).toHaveBeenCalledWith(
        '/test',
        expect.objectContaining({ method: 'GET' })
      );

      const postResult = await api.post('/test', { data: 'test' });
      expect(postResult).toEqual(responses.post);
      expect(mockFetch).toHaveBeenCalledWith(
        '/test',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ data: 'test' }),
        })
      );

      const putResult = await api.put('/test/1', { updated: true });
      expect(putResult).toEqual(responses.put);

      const deleteResult = await api.delete('/test/1');
      expect(deleteResult).toEqual(responses.delete);
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ error: 'Resource not found' }),
      });

      const apiMiddleware = createAPIMiddleware({});

      const useStore = create<TestState>()(
        apiMiddleware((set, get, api) => ({
          data: null,
          loading: false,
          error: null,
          fetchData: async () => {
            try {
              await api.get('/nonexistent');
            } catch (error) {
              set({ error: (error as Error).message });
            }
          },
          postData: async () => {},
          updateData: async () => {},
          deleteData: async () => {},
        }))
      );

      await useStore.getState().fetchData();

      expect(useStore.getState().error).toContain('404');
    });
  });

  describe('Retry Logic', () => {
    it('should retry failed requests', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        });

      const config: APIMiddlewareConfig = {
        retry: {
          attempts: 3,
          delay: 100,
          backoff: 'exponential',
        },
      };

      const apiMiddleware = createAPIMiddleware(config);

      const useStore = create<{ api: any }>()(
        apiMiddleware((set, get, api) => ({
          api,
        }))
      );

      const startTime = Date.now();
      const result = await useStore.getState().api.get('/test');

      expect(result).toEqual({ success: true });
      expect(mockFetch).toHaveBeenCalledTimes(3);

      // Check that retries happened with delays
      jest.runAllTimers();
      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeGreaterThanOrEqual(300); // 100ms + 200ms delays
    });

    it('should respect max retry attempts', async () => {
      mockFetch.mockRejectedValue(new Error('Persistent error'));

      const config: APIMiddlewareConfig = {
        retry: {
          attempts: 2,
          delay: 50,
        },
      };

      const apiMiddleware = createAPIMiddleware(config);

      const useStore = create<{ api: any }>()(
        apiMiddleware((set, get, api) => ({
          api,
        }))
      );

      await expect(useStore.getState().api.get('/test')).rejects.toThrow('Persistent error');
      
      jest.runAllTimers();
      expect(mockFetch).toHaveBeenCalledTimes(2); // Initial + 1 retry
    });

    it('should handle custom retry conditions', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: 'success' }),
        });

      const config: APIMiddlewareConfig = {
        retry: {
          attempts: 3,
          delay: 50,
          shouldRetry: (error, attempt) => {
            // Retry on 503 errors
            return error.message.includes('503');
          },
        },
      };

      const apiMiddleware = createAPIMiddleware(config);

      const useStore = create<{ api: any }>()(
        apiMiddleware((set, get, api) => ({
          api,
        }))
      );

      const result = await useStore.getState().api.get('/test');
      
      jest.runAllTimers();
      expect(result).toEqual({ data: 'success' });
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should apply jitter to retry delays', async () => {
      const delays: number[] = [];
      let lastCallTime = Date.now();

      mockFetch
        .mockImplementation(() => {
          const now = Date.now();
          delays.push(now - lastCallTime);
          lastCallTime = now;
          return Promise.reject(new Error('Error'));
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        });

      const config: APIMiddlewareConfig = {
        retry: {
          attempts: 3,
          delay: 100,
          jitter: true,
        },
      };

      const apiMiddleware = createAPIMiddleware(config);

      const useStore = create<{ api: any }>()(
        apiMiddleware((set, get, api) => ({
          api,
        }))
      );

      await useStore.getState().api.get('/test');
      
      jest.runAllTimers();

      // Check that delays have some variation due to jitter
      const uniqueDelays = new Set(delays.slice(1)); // Skip first immediate call
      expect(uniqueDelays.size).toBeGreaterThan(1);
    });
  });

  describe('Circuit Breaker', () => {
    it('should open circuit after threshold failures', async () => {
      mockFetch.mockRejectedValue(new Error('Service error'));

      const config: APIMiddlewareConfig = {
        circuitBreaker: {
          enabled: true,
          failureThreshold: 3,
          resetTimeout: 1000,
        },
      };

      const apiMiddleware = createAPIMiddleware(config);

      const useStore = create<{ api: any }>()(
        apiMiddleware((set, get, api) => ({
          api,
        }))
      );

      const { api } = useStore.getState();

      // Make requests up to failure threshold
      for (let i = 0; i < 3; i++) {
        await expect(api.get('/test')).rejects.toThrow();
      }

      // Circuit should be open now
      await expect(api.get('/test')).rejects.toThrow('Circuit breaker is OPEN');
      
      // Should not make actual API call when circuit is open
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should enter half-open state after timeout', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockRejectedValueOnce(new Error('Error 2'))
        .mockRejectedValueOnce(new Error('Error 3'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ recovered: true }),
        });

      const config: APIMiddlewareConfig = {
        circuitBreaker: {
          enabled: true,
          failureThreshold: 3,
          resetTimeout: 100,
        },
      };

      const apiMiddleware = createAPIMiddleware(config);

      const useStore = create<{ api: any; getCircuitState: () => CircuitBreakerState }>()(
        apiMiddleware((set, get, api) => ({
          api,
          getCircuitState: () => (api as any).circuitBreaker?.state || 'CLOSED',
        }))
      );

      const { api, getCircuitState } = useStore.getState();

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(api.get('/test')).rejects.toThrow();
      }

      expect(getCircuitState()).toBe('OPEN');

      // Wait for reset timeout
      jest.advanceTimersByTime(100);

      // Should allow one request in half-open state
      const result = await api.get('/test');
      expect(result).toEqual({ recovered: true });
      expect(getCircuitState()).toBe('CLOSED');
    });

    it('should re-open circuit if request fails in half-open state', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockRejectedValueOnce(new Error('Error 2'))
        .mockRejectedValueOnce(new Error('Error 3'))
        .mockRejectedValueOnce(new Error('Still failing'));

      const config: APIMiddlewareConfig = {
        circuitBreaker: {
          enabled: true,
          failureThreshold: 3,
          resetTimeout: 100,
        },
      };

      const apiMiddleware = createAPIMiddleware(config);

      const useStore = create<{ api: any }>()(
        apiMiddleware((set, get, api) => ({
          api,
        }))
      );

      const { api } = useStore.getState();

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(api.get('/test')).rejects.toThrow();
      }

      // Wait for reset timeout
      jest.advanceTimersByTime(100);

      // Request fails in half-open state
      await expect(api.get('/test')).rejects.toThrow('Still failing');

      // Circuit should be open again
      await expect(api.get('/test')).rejects.toThrow('Circuit breaker is OPEN');
    });

    it('should track success rate', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
        .mockRejectedValueOnce(new Error('Error'))
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
        .mockRejectedValueOnce(new Error('Error'))
        .mockRejectedValueOnce(new Error('Error'));

      const config: APIMiddlewareConfig = {
        circuitBreaker: {
          enabled: true,
          failureThreshold: 3,
          successThreshold: 2,
          resetTimeout: 100,
        },
      };

      const apiMiddleware = createAPIMiddleware(config);

      const useStore = create<{ api: any }>()(
        apiMiddleware((set, get, api) => ({
          api,
        }))
      );

      const { api } = useStore.getState();

      // Mix of successes and failures
      await api.get('/test'); // Success
      await expect(api.get('/test')).rejects.toThrow(); // Failure
      await api.get('/test'); // Success
      await expect(api.get('/test')).rejects.toThrow(); // Failure
      await expect(api.get('/test')).rejects.toThrow(); // Failure - should open circuit

      // Circuit should be open
      await expect(api.get('/test')).rejects.toThrow('Circuit breaker is OPEN');
    });
  });

  describe('Request Batching', () => {
    it('should batch multiple requests', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { id: 1, data: 'result1' },
          { id: 2, data: 'result2' },
          { id: 3, data: 'result3' },
        ],
      });

      const config: APIMiddlewareConfig = {
        batching: {
          enabled: true,
          maxBatchSize: 5,
          batchDelay: 50,
          batchUrl: '/batch',
        },
      };

      const apiMiddleware = createAPIMiddleware(config);

      const useStore = create<{ api: any }>()(
        apiMiddleware((set, get, api) => ({
          api,
        }))
      );

      const { api } = useStore.getState();

      // Make multiple requests that should be batched
      const promises = [
        api.batch({ url: '/item/1', method: 'GET' }),
        api.batch({ url: '/item/2', method: 'GET' }),
        api.batch({ url: '/item/3', method: 'GET' }),
      ];

      // Advance timers to trigger batch
      jest.advanceTimersByTime(50);

      const results = await Promise.all(promises);

      expect(results).toEqual([
        { id: 1, data: 'result1' },
        { id: 2, data: 'result2' },
        { id: 3, data: 'result3' },
      ]);

      // Should make only one fetch call
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        '/batch',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('item/1'),
        })
      );
    });

    it('should respect max batch size', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{ id: 1 }, { id: 2 }, { id: 3 }],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{ id: 4 }, { id: 5 }],
        });

      const config: APIMiddlewareConfig = {
        batching: {
          enabled: true,
          maxBatchSize: 3,
          batchDelay: 50,
          batchUrl: '/batch',
        },
      };

      const apiMiddleware = createAPIMiddleware(config);

      const useStore = create<{ api: any }>()(
        apiMiddleware((set, get, api) => ({
          api,
        }))
      );

      const { api } = useStore.getState();

      // Make more requests than max batch size
      const promises = Array.from({ length: 5 }, (_, i) =>
        api.batch({ url: `/item/${i + 1}`, method: 'GET' })
      );

      jest.advanceTimersByTime(50);

      await Promise.all(promises);

      // Should make two batch requests
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should handle batch request failures', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Batch failed'));

      const config: APIMiddlewareConfig = {
        batching: {
          enabled: true,
          maxBatchSize: 5,
          batchDelay: 50,
          batchUrl: '/batch',
        },
      };

      const apiMiddleware = createAPIMiddleware(config);

      const useStore = create<{ api: any }>()(
        apiMiddleware((set, get, api) => ({
          api,
        }))
      );

      const { api } = useStore.getState();

      const promises = [
        api.batch({ url: '/item/1', method: 'GET' }),
        api.batch({ url: '/item/2', method: 'GET' }),
      ];

      jest.advanceTimersByTime(50);

      // All requests in the batch should fail
      await expect(Promise.all(promises)).rejects.toThrow('Batch failed');
    });
  });

  describe('Request/Response Interceptors', () => {
    it('should apply request interceptors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: 'test' }),
      });

      const config: APIMiddlewareConfig = {
        interceptors: {
          request: [
            (config) => ({
              ...config,
              headers: {
                ...config.headers,
                'X-Custom-Header': 'test-value',
              },
            }),
            (config) => ({
              ...config,
              headers: {
                ...config.headers,
                'X-Request-ID': '12345',
              },
            }),
          ],
        },
      };

      const apiMiddleware = createAPIMiddleware(config);

      const useStore = create<{ api: any }>()(
        apiMiddleware((set, get, api) => ({
          api,
        }))
      );

      await useStore.getState().api.get('/test');

      expect(mockFetch).toHaveBeenCalledWith(
        '/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Custom-Header': 'test-value',
            'X-Request-ID': '12345',
          }),
        })
      );
    });

    it('should apply response interceptors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: 'original' }),
      });

      const config: APIMiddlewareConfig = {
        interceptors: {
          response: [
            (response) => ({
              ...response,
              transformed: true,
            }),
            (response) => ({
              ...response,
              timestamp: Date.now(),
            }),
          ],
        },
      };

      const apiMiddleware = createAPIMiddleware(config);

      const useStore = create<{ api: any }>()(
        apiMiddleware((set, get, api) => ({
          api,
        }))
      );

      const result = await useStore.getState().api.get('/test');

      expect(result).toHaveProperty('data', 'original');
      expect(result).toHaveProperty('transformed', true);
      expect(result).toHaveProperty('timestamp');
    });

    it('should handle interceptor errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: 'test' }),
      });

      const config: APIMiddlewareConfig = {
        interceptors: {
          request: [
            (config) => {
              throw new Error('Interceptor error');
            },
          ],
        },
      };

      const apiMiddleware = createAPIMiddleware(config);

      const useStore = create<{ api: any }>()(
        apiMiddleware((set, get, api) => ({
          api,
        }))
      );

      await expect(useStore.getState().api.get('/test')).rejects.toThrow('Interceptor error');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network failure'));

      const config: APIMiddlewareConfig = {
        onError: jest.fn(),
      };

      const apiMiddleware = createAPIMiddleware(config);

      const useStore = create<{ api: any }>()(
        apiMiddleware((set, get, api) => ({
          api,
        }))
      );

      await expect(useStore.getState().api.get('/test')).rejects.toThrow('Network failure');
      expect(config.onError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Network failure',
        })
      );
    });

    it('should handle timeout errors', async () => {
      mockFetch.mockImplementationOnce(() => 
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: async () => ({ data: 'late response' }),
            });
          }, 200);
        })
      );

      const config: APIMiddlewareConfig = {
        timeout: 100,
      };

      const apiMiddleware = createAPIMiddleware(config);

      const useStore = create<{ api: any }>()(
        apiMiddleware((set, get, api) => ({
          api,
        }))
      );

      const promise = useStore.getState().api.get('/test');
      
      jest.advanceTimersByTime(100);
      
      await expect(promise).rejects.toThrow('Request timeout');
    });

    it('should transform errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ 
          error: { 
            code: 'VALIDATION_ERROR',
            message: 'Invalid input',
            fields: ['email', 'password'],
          },
        }),
      });

      const config: APIMiddlewareConfig = {
        transformError: (error) => {
          if (error.response?.error?.code === 'VALIDATION_ERROR') {
            return new Error(`Validation failed: ${error.response.error.fields.join(', ')}`);
          }
          return error;
        },
      };

      const apiMiddleware = createAPIMiddleware(config);

      const useStore = create<{ api: any }>()(
        apiMiddleware((set, get, api) => ({
          api,
        }))
      );

      await expect(useStore.getState().api.get('/test')).rejects.toThrow('Validation failed: email, password');
    });
  });

  describe('Caching Integration', () => {
    it('should cache GET requests', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 1, data: 'cached' }),
        });

      const config: APIMiddlewareConfig = {
        cache: {
          enabled: true,
          ttl: 1000,
          getCacheKey: (request: APIRequest) => `${request.method}:${request.url}`,
        },
      };

      const apiMiddleware = createAPIMiddleware(config);

      const useStore = create<{ api: any }>()(
        apiMiddleware((set, get, api) => ({
          api,
        }))
      );

      const { api } = useStore.getState();

      // First request should hit the API
      const result1 = await api.get('/test');
      expect(result1).toEqual({ id: 1, data: 'cached' });
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second request should use cache
      const result2 = await api.get('/test');
      expect(result2).toEqual({ id: 1, data: 'cached' });
      expect(mockFetch).toHaveBeenCalledTimes(1); // Still 1

      // Advance time past TTL
      jest.advanceTimersByTime(1001);

      // Third request should hit API again
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 1, data: 'updated' }),
      });

      const result3 = await api.get('/test');
      expect(result3).toEqual({ id: 1, data: 'updated' });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should not cache non-GET requests by default', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ created: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ created: true, again: true }),
        });

      const config: APIMiddlewareConfig = {
        cache: {
          enabled: true,
          ttl: 1000,
        },
      };

      const apiMiddleware = createAPIMiddleware(config);

      const useStore = create<{ api: any }>()(
        apiMiddleware((set, get, api) => ({
          api,
        }))
      );

      const { api } = useStore.getState();

      await api.post('/test', { data: 'test' });
      await api.post('/test', { data: 'test' });

      // Should make two requests (no caching)
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should invalidate cache on mutations', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 1, data: 'original' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ updated: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 1, data: 'updated' }),
        });

      const config: APIMiddlewareConfig = {
        cache: {
          enabled: true,
          ttl: 1000,
          invalidateOn: ['POST', 'PUT', 'DELETE'],
          invalidatePattern: (request: APIRequest) => {
            if (request.method === 'PUT') {
              return new RegExp(`^GET:${request.url.replace(/\/\d+$/, '')}`);
            }
            return null;
          },
        },
      };

      const apiMiddleware = createAPIMiddleware(config);

      const useStore = create<{ api: any }>()(
        apiMiddleware((set, get, api) => ({
          api,
        }))
      );

      const { api } = useStore.getState();

      // Cache the GET request
      await api.get('/items/1');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // PUT should invalidate cache
      await api.put('/items/1', { data: 'updated' });

      // Next GET should hit API (cache invalidated)
      await api.get('/items/1');
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });
});
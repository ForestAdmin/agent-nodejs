type MockRouteHandler<T> = T | ((url: string, options?: RequestInit) => T);

interface MockRoute<T> {
  pattern: string | RegExp;
  method?: string;
  response: MockRouteHandler<T>;
  status?: number;
}

/**
 * Mock server class for mocking fetch requests to specific routes
 */
export default class MockServer {
  private routes: MockRoute<unknown>[] = [];
  private mockFn: jest.Mock;

  constructor() {
    this.mockFn = jest.fn((url: string, options?: RequestInit) => {
      return this.handleRequest(url, options);
    });
  }

  /**
   * Register a route with a JSON payload or a function that returns a payload
   */
  route<T>(
    pattern: string | RegExp,
    response: MockRouteHandler<T>,
    options: { method?: string; status?: number } = {},
  ): this {
    this.routes.push({
      pattern,
      method: options.method,
      response,
      status: options.status ?? 200,
    });

    return this;
  }

  /**
   * Register a GET route
   */
  get<T>(pattern: string | RegExp, response: MockRouteHandler<T>, status?: number): this {
    return this.route(pattern, response, { method: 'GET', status });
  }

  /**
   * Register a POST route
   */
  post<T>(pattern: string | RegExp, response: MockRouteHandler<T>, status?: number): this {
    return this.route(pattern, response, { method: 'POST', status });
  }

  /**
   * Register a PUT route
   */
  put<T>(pattern: string | RegExp, response: MockRouteHandler<T>, status?: number): this {
    return this.route(pattern, response, { method: 'PUT', status });
  }

  /**
   * Register a DELETE route
   */
  delete<T>(pattern: string | RegExp, response: MockRouteHandler<T>, status?: number): this {
    return this.route(pattern, response, { method: 'DELETE', status });
  }

  /**
   * Register a PATCH route
   */
  patch<T>(pattern: string | RegExp, response: MockRouteHandler<T>, status?: number): this {
    return this.route(pattern, response, { method: 'PATCH', status });
  }

  /**
   * Get the mock function to use as global.fetch
   */
  get fetch(): jest.Mock {
    return this.mockFn;
  }

  /**
   * Clear mock call history
   */
  clear(): void {
    this.mockFn.mockClear();
  }

  /**
   * Reset all routes
   */
  reset(): void {
    this.routes = [];
    this.mockFn.mockClear();
  }

  private handleRequest(url: string, options?: RequestInit): Promise<Response> {
    const urlString = url.toString();
    const method = options?.method || 'GET';

    for (const route of this.routes) {
      const patternMatch =
        typeof route.pattern === 'string'
          ? urlString.includes(route.pattern)
          : route.pattern.test(urlString);

      const methodMatch = !route.method || route.method.toUpperCase() === method.toUpperCase();

      if (patternMatch && methodMatch) {
        const payload =
          typeof route.response === 'function'
            ? (route.response as (url: string, options?: RequestInit) => unknown)(url, options)
            : route.response;

        const status = route.status ?? 200;

        return Promise.resolve({
          ok: status >= 200 && status < 300,
          status,
          statusText: status === 200 ? 'OK' : 'Error',
          json: () => Promise.resolve(payload),
        } as Response);
      }
    }

    // Default: return 404 for unknown endpoints
    return Promise.resolve({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: () => Promise.resolve({ error: 'Not found' }),
    } as Response);
  }
}

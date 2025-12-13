type MockRouteHandler<T> = T | ((url: string, options?: RequestInit) => T);

interface MockRoute<T> {
  pattern: string | RegExp;
  method?: string;
  response: MockRouteHandler<T>;
  status?: number;
}

// Store original superagent methods for restoration
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let originalSuperagent: any = null;

/**
 * Mock server class for mocking fetch requests to specific routes
 * Also intercepts superagent requests used by forestadmin-client
 */
export default class MockServer {
  private routes: MockRoute<unknown>[] = [];
  private mockFn: jest.Mock;
  private superagentMocked = false;

  constructor() {
    this.mockFn = jest.fn((url: string, options?: RequestInit) => {
      return this.handleRequest(url, options);
    });
  }

  /**
   * Setup superagent mocking to intercept HTTP requests made by forestadmin-client
   */
  setupSuperagentMock(): void {
    if (this.superagentMocked) return;

    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires, global-require
    const superagent = require('superagent');

    if (!originalSuperagent) {
      originalSuperagent = { ...superagent };
    }

    // Create mock request builder using arrow function to preserve 'this'
    const createMockRequest = (method: string, reqUrl: string) => {
      let headers: Record<string, string> = {};
      let body: unknown = null;

      const mockRequest = {
        set: (key: string | Record<string, string>, value?: string) => {
          if (typeof key === 'object') {
            headers = { ...headers, ...key };
          } else if (value !== undefined) {
            headers[key] = value;
          }

          return mockRequest;
        },
        timeout: () => mockRequest,
        send: async (data?: unknown) => {
          body = data;

          return this.handleSuperagentRequest(method, reqUrl, headers, body);
        },
      };

      return mockRequest;
    };

    // Override superagent methods
    superagent.get = (reqUrl: string) => createMockRequest('GET', reqUrl);
    superagent.post = (reqUrl: string) => createMockRequest('POST', reqUrl);
    superagent.put = (reqUrl: string) => createMockRequest('PUT', reqUrl);
    superagent.delete = (reqUrl: string) => createMockRequest('DELETE', reqUrl);

    this.superagentMocked = true;
  }

  /**
   * Restore original superagent methods
   */
  restoreSuperagent(): void {
    if (!this.superagentMocked || !originalSuperagent) return;

    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires, global-require
    const superagent = require('superagent');

    Object.assign(superagent, originalSuperagent);
    this.superagentMocked = false;
  }

  private async handleSuperagentRequest(
    method: string,
    reqUrl: string,
    headers: Record<string, string>,
    body: unknown,
  ): Promise<{ body: unknown; status: number }> {
    for (const route of this.routes) {
      const patternMatch =
        typeof route.pattern === 'string'
          ? reqUrl.includes(route.pattern)
          : route.pattern.test(reqUrl);

      const methodMatch = !route.method || route.method.toUpperCase() === method.toUpperCase();

      if (patternMatch && methodMatch) {
        const payload =
          typeof route.response === 'function'
            ? (route.response as (url: string, options?: RequestInit) => unknown)(reqUrl, {
                method,
                headers: headers as unknown as HeadersInit,
                body: body as BodyInit,
              })
            : route.response;

        const status = route.status ?? 200;

        return { body: payload, status };
      }
    }

    // No match found - throw error like superagent would for 404
    const error = new Error(`Not Found: ${method} ${reqUrl}`) as Error & {
      response: { status: number; body: { errors: { detail: string }[] } };
    };
    error.response = {
      status: 404,
      body: { errors: [{ detail: 'Not found' }] },
    };
    throw error;
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

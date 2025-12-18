/* eslint-disable @typescript-eslint/no-explicit-any */
type MockRouteHandler<T> = T | ((url: string, options?: RequestInit) => T);

interface MockRoute<T> {
  pattern: string | RegExp;
  method?: string;
  response: MockRouteHandler<T>;
  status?: number;
}

// Store original superagent methods for restoration
let originalSuperagent: any = null;

/**
 * Mock server class for mocking Forest Admin API requests
 * Intercepts both fetch and superagent requests
 */
export default class MockForestServer {
  private routes: MockRoute<unknown>[] = [];
  private mockFn: jest.Mock;
  private superagentMocked = false;
  private originalFetch: typeof global.fetch | null = null;

  // Dynamic agent URL that can be set for each test
  public agentUrl: string | null = null;

  constructor() {
    this.mockFn = jest.fn((url: string, options?: RequestInit) => {
      return this.handleRequest(url, options);
    });
  }

  /**
   * Setup default Forest Admin API routes for testing
   */
  setupDefaultRoutes(
    options: {
      envSecret?: string;
      forestServerUrl?: string;
      agentUrl?: string;
      collections?: Array<{ name: string; fields: Array<{ field: string; type: string }> }>;
    } = {},
  ): this {
    const {
      envSecret = '0'.repeat(64),
      forestServerUrl = 'https://api.forestadmin.com',
      agentUrl,
      collections = [],
    } = options;

    // OIDC Configuration endpoint (required by forestadmin-client for auth)
    this.get('/oidc/.well-known/openid-configuration', {
      issuer: forestServerUrl,
      authorization_endpoint: `${forestServerUrl}/oidc/auth`,
      token_endpoint: `${forestServerUrl}/oidc/token`,
      registration_endpoint: `${forestServerUrl}/oidc/reg`,
      jwks_uri: `${forestServerUrl}/oidc/jwks`,
      response_types_supported: ['code'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256'],
      scopes_supported: ['openid', 'email', 'profile'],
      token_endpoint_auth_methods_supported: ['none'],
      grant_types_supported: ['authorization_code'],
    });

    // OIDC Client registration endpoint
    this.post('/oidc/reg', {
      client_id: `forest-client-${envSecret.slice(0, 8)}`,
      client_secret: null,
      registration_access_token: 'test-registration-token',
      registration_client_uri: `${forestServerUrl}/oidc/reg/test-client`,
      redirect_uris: [],
      response_types: ['code'],
      grant_types: ['authorization_code'],
      token_endpoint_auth_method: 'none',
    });

    // Environment endpoint
    // api_endpoint is used by MCP server to call back to the agent
    // Use a function so this.agentUrl can be updated dynamically per test
    this.get('/liana/environment', () => ({
      data: {
        id: '123',
        type: 'environments',
        attributes: {
          api_endpoint: this.agentUrl || agentUrl || forestServerUrl,
          env_secret: envSecret,
        },
      },
    }));

    // Forest schema endpoint
    this.get('/liana/forest-schema', {
      data: collections.map(col => ({
        id: col.name,
        type: 'collections',
        attributes: {
          name: col.name,
          fields: col.fields,
        },
      })),
      meta: {
        liana: 'forest-express-sequelize',
        liana_version: '9.0.0',
        liana_features: null,
      },
    });

    // Schema posting (apimap)
    this.post('/forest/apimaps', { success: true });

    // OAuth client registration (MCP)
    this.get(/\/oauth\/register\//, {
      client_id: 'test-client',
      redirect_uris: ['http://localhost:3000/callback'],
      client_name: 'Test Client',
    });

    // Users permissions endpoint - returns array of UserPermissionV4
    this.get('/liana/v4/permissions/users', [
      {
        id: 1,
        firstName: 'Test',
        lastName: 'User',
        fullName: 'Test User',
        email: 'test@example.com',
        permissionLevel: 'admin',
        tags: {},
        roleId: 1,
      },
    ]);

    // Environment permissions endpoint - returns EnvironmentPermissionsV4
    // Using 'true' means all permissions are granted (development mode behavior)
    this.get('/liana/v4/permissions/environment', {
      collections: {
        users: {
          collection: {
            browseEnabled: true,
            readEnabled: true,
            editEnabled: true,
            addEnabled: true,
            deleteEnabled: true,
            exportEnabled: true,
          },
          actions: {},
        },
        posts: {
          collection: {
            browseEnabled: true,
            readEnabled: true,
            editEnabled: true,
            addEnabled: true,
            deleteEnabled: true,
            exportEnabled: true,
          },
          actions: {},
        },
      },
    });

    // Scope invalidation
    this.post('/liana/scopes', { success: true });

    // Activity logs endpoint (used by MCP server)
    this.post('/api/activity-logs-requests', { success: true });

    // Server events (SSE endpoint mock)
    this.get('/liana/v4/subscriptions/server-events', {
      data: [],
    });

    // IP Whitelist rules
    this.get('/liana/v1/ip-whitelist-rules', {
      data: {
        type: 'ip-whitelist-rules',
        id: '1',
        attributes: {
          use_ip_whitelist: false,
          rules: [],
        },
      },
    });

    // Permissions rendering endpoint - returns RenderingPermissionV4
    this.get(/\/liana\/v4\/permissions\/renderings\/\d+/, {
      team: { id: 1, name: 'Test Team' },
      collections: {
        users: {
          scope: null,
          segments: [],
        },
        posts: {
          scope: null,
          segments: [],
        },
      },
      stats: [],
    });

    return this;
  }

  /**
   * Setup superagent mocking to intercept HTTP requests made by forestadmin-client
   */
  setupSuperagentMock(): this {
    if (this.superagentMocked) return this;

    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires, global-require
    const superagent = require('superagent');

    if (!originalSuperagent) {
      originalSuperagent = { ...superagent };
    }

    // Only intercept requests to Forest Admin API, not to localhost test servers
    const shouldIntercept = (url: string) => {
      return (
        url.includes('forestadmin.com') ||
        url.includes('/liana/') ||
        url.includes('/forest/apimaps') ||
        url.includes('/oidc/')
      );
    };

    // Create mock request builder using arrow function to preserve 'this'
    const createMockRequest = (
      method: string,
      reqUrl: string,
      originalMethod: (requestUrl: string) => unknown,
    ) => {
      // If not a Forest Admin API call, use real superagent
      if (!shouldIntercept(reqUrl)) {
        return originalMethod.call(originalSuperagent, reqUrl);
      }

      let headers: Record<string, string> = {};
      let body: unknown = null;
      let queryParams: Record<string, unknown> = {};

      const executeRequest = () => {
        const requestBody = body ?? (Object.keys(queryParams).length > 0 ? queryParams : null);

        return this.handleSuperagentRequest(method, reqUrl, headers, requestBody);
      };

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
        redirects: () => mockRequest,
        query: (params: Record<string, unknown>) => {
          queryParams = { ...queryParams, ...params };

          return mockRequest;
        },
        send: async (data?: unknown) => {
          body = data;

          return executeRequest();
        },
        // Make the request thenable so it can be awaited without calling send()
        then: (
          resolve: (value: { body: unknown; status: number }) => void,
          reject: (reason: unknown) => void,
        ) => {
          return executeRequest().then(resolve, reject);
        },
      };

      return mockRequest;
    };

    // Override superagent methods - pass original method for fallback
    superagent.get = (reqUrl: string) => createMockRequest('GET', reqUrl, originalSuperagent.get);
    superagent.post = (reqUrl: string) =>
      createMockRequest('POST', reqUrl, originalSuperagent.post);
    superagent.put = (reqUrl: string) => createMockRequest('PUT', reqUrl, originalSuperagent.put);
    superagent.delete = (reqUrl: string) =>
      createMockRequest('DELETE', reqUrl, originalSuperagent.delete);

    this.superagentMocked = true;

    return this;
  }

  /**
   * Setup fetch mocking
   */
  setupFetchMock(): this {
    this.originalFetch = global.fetch;
    global.fetch = this.mockFn;

    return this;
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

  /**
   * Restore original fetch
   */
  restoreFetch(): void {
    if (this.originalFetch) {
      global.fetch = this.originalFetch;
      this.originalFetch = null;
    }
  }

  /**
   * Restore all mocked functions
   */
  restore(): void {
    this.restoreSuperagent();
    this.restoreFetch();
  }

  private async handleSuperagentRequest(
    method: string,
    reqUrl: string,
    headers: Record<string, string>,
    body: unknown,
  ): Promise<{ body: unknown; status: number; text: string }> {
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
        const text = typeof payload === 'string' ? payload : JSON.stringify(payload);

        return { body: payload, status, text };
      }
    }

    // No match found - throw error like superagent would for 404
    const error = new Error(`MockForestServer: Not Found: ${method} ${reqUrl}`) as Error & {
      response: { status: number; body: { errors: { detail: string }[] }; text: string };
    };
    error.response = {
      status: 404,
      body: { errors: [{ detail: 'Not found' }] },
      text: JSON.stringify({ errors: [{ detail: 'Not found' }] }),
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
        const textResponse = typeof payload === 'string' ? payload : JSON.stringify(payload);

        return Promise.resolve({
          ok: status >= 200 && status < 300,
          status,
          statusText: status === 200 ? 'OK' : 'Error',
          json: () => Promise.resolve(payload),
          text: () => Promise.resolve(textResponse),
        } as Response);
      }
    }

    // Default: return 404 for unknown endpoints
    const notFoundPayload = { error: `MockForestServer: Not found: ${method} ${urlString}` };

    return Promise.resolve({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: () => Promise.resolve(notFoundPayload),
      text: () => Promise.resolve(JSON.stringify(notFoundPayload)),
    } as Response);
  }
}

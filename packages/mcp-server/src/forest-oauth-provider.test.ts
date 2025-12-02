import type { OAuthClientInformationFull } from '@modelcontextprotocol/sdk/shared/auth.js';
import type { Response } from 'express';

import ForestAdminOAuthProvider from './forest-oauth-provider.js';
import MockServer from './test-utils/mock-server.js';

describe('ForestAdminOAuthProvider', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let mockServer: MockServer;
  const originalFetch = global.fetch;

  beforeAll(() => {
    originalEnv = { ...process.env };
  });

  afterAll(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  beforeEach(() => {
    process.env.FOREST_ENV_SECRET = 'test-env-secret';
    process.env.FOREST_AUTH_SECRET = 'test-auth-secret';
    mockServer = new MockServer();
  });

  afterEach(() => {
    mockServer.reset();
  });

  describe('constructor', () => {
    it('should create instance with forestServerUrl', () => {
      const customProvider = new ForestAdminOAuthProvider({
        forestServerUrl: 'https://custom.forestadmin.com',
      });

      expect(customProvider).toBeDefined();
    });
  });

  describe('initialize', () => {
    it('should not throw when FOREST_ENV_SECRET is missing', async () => {
      delete process.env.FOREST_ENV_SECRET;
      const customProvider = new ForestAdminOAuthProvider({
        forestServerUrl: 'https://api.forestadmin.com',
      });

      await expect(customProvider.initialize()).resolves.not.toThrow();
    });

    it('should fetch environmentId from Forest Admin API', async () => {
      mockServer.get('/liana/environment', { data: { id: '98765' } });
      global.fetch = mockServer.fetch;

      const testProvider = new ForestAdminOAuthProvider({
        forestServerUrl: 'https://api.forestadmin.com',
      });

      await testProvider.initialize();

      // Verify fetch was called with correct URL and headers
      expect(mockServer.fetch).toHaveBeenCalledWith(
        'https://api.forestadmin.com/liana/environment',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'forest-secret-key': 'test-env-secret',
            'Content-Type': 'application/json',
          }),
        }),
      );
    });

    it('should set environmentId after successful initialization', async () => {
      mockServer.get('/liana/environment', { data: { id: '54321' } });
      global.fetch = mockServer.fetch;

      const testProvider = new ForestAdminOAuthProvider({
        forestServerUrl: 'https://api.forestadmin.com',
      });

      await testProvider.initialize();

      // Verify environmentId is set by checking authorize redirect includes it
      const mockResponse = { redirect: jest.fn() };
      const mockClient = {
        client_id: 'test-client',
        redirect_uris: ['https://example.com/callback'],
      } as OAuthClientInformationFull;

      await testProvider.authorize(
        mockClient,
        {
          redirectUri: 'https://example.com/callback',
          codeChallenge: 'challenge',
          state: 'state',
          scopes: ['mcp:read'],
          resource: new URL('https://localhost:3931'),
        },
        mockResponse as unknown as Response,
      );

      const redirectUrl = new URL((mockResponse.redirect as jest.Mock).mock.calls[0][0]);
      expect(redirectUrl.searchParams.get('environmentId')).toBe('54321');
    });

    it('should handle non-OK response from Forest Admin API', async () => {
      mockServer.get('/liana/environment', { error: 'Unauthorized' }, 401);
      global.fetch = mockServer.fetch;

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const testProvider = new ForestAdminOAuthProvider({
        forestServerUrl: 'https://api.forestadmin.com',
      });

      await testProvider.initialize();

      expect(consoleSpy).toHaveBeenCalledWith(
        '[WARN] Failed to fetch environmentId from Forest Admin API:',
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });

    it('should handle fetch network errors gracefully', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const testProvider = new ForestAdminOAuthProvider({
        forestServerUrl: 'https://api.forestadmin.com',
      });

      await testProvider.initialize();

      expect(consoleSpy).toHaveBeenCalledWith(
        '[WARN] Failed to fetch environmentId from Forest Admin API:',
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });

    it('should use correct forest server URL for API call', async () => {
      mockServer.get('/liana/environment', { data: { id: '11111' } });
      global.fetch = mockServer.fetch;

      const testProvider = new ForestAdminOAuthProvider({
        forestServerUrl: 'https://custom.forestadmin.com',
      });

      await testProvider.initialize();

      expect(mockServer.fetch).toHaveBeenCalledWith(
        'https://custom.forestadmin.com/liana/environment',
        expect.any(Object),
      );
    });
  });

  describe('clientsStore.getClient', () => {
    it('should fetch client from Forest Admin API', async () => {
      const clientData = {
        client_id: 'test-client-123',
        redirect_uris: ['https://example.com/callback'],
        client_name: 'Test Client',
      };
      mockServer.get('/oauth/register/test-client-123', clientData);
      global.fetch = mockServer.fetch;

      const provider = new ForestAdminOAuthProvider({
        forestServerUrl: 'https://api.forestadmin.com',
      });

      const client = await provider.clientsStore.getClient('test-client-123');

      expect(client).toEqual(clientData);
      expect(mockServer.fetch).toHaveBeenCalledWith(
        'https://api.forestadmin.com/oauth/register/test-client-123',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'forest-secret-key': 'test-env-secret',
            'Content-Type': 'application/json',
          }),
        }),
      );
    });

    it('should return undefined when client is not found', async () => {
      mockServer.get('/oauth/register/unknown-client', { error: 'Not found' }, 404);
      global.fetch = mockServer.fetch;

      const provider = new ForestAdminOAuthProvider({
        forestServerUrl: 'https://api.forestadmin.com',
      });

      const client = await provider.clientsStore.getClient('unknown-client');

      expect(client).toBeUndefined();
    });

    it('should return undefined on server error', async () => {
      mockServer.get('/oauth/register/error-client', { error: 'Internal error' }, 500);
      global.fetch = mockServer.fetch;

      const provider = new ForestAdminOAuthProvider({
        forestServerUrl: 'https://api.forestadmin.com',
      });

      const client = await provider.clientsStore.getClient('error-client');

      expect(client).toBeUndefined();
    });
  });

  describe('authorize', () => {
    let mockResponse: Partial<Response>;
    let mockClient: OAuthClientInformationFull;
    let initializedProvider: ForestAdminOAuthProvider;

    beforeEach(async () => {
      mockResponse = {
        redirect: jest.fn(),
      };
      mockClient = {
        client_id: 'test-client-id',
        redirect_uris: ['https://example.com/callback'],
      } as OAuthClientInformationFull;

      // Create provider and mock the fetch to set environmentId
      initializedProvider = new ForestAdminOAuthProvider({
        forestServerUrl: 'https://api.forestadmin.com',
      });

      // Mock fetch to return a valid response
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { id: '12345' } }),
      });
      global.fetch = mockFetch;

      await initializedProvider.initialize();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should redirect to Forest Admin authentication URL', async () => {
      await initializedProvider.authorize(
        mockClient,
        {
          redirectUri: 'https://example.com/callback',
          codeChallenge: 'test-code-challenge',
          state: 'test-state',
          scopes: ['mcp:read', 'profile'],
          resource: new URL('https://localhost:3931'),
        },
        mockResponse as Response,
      );

      expect(mockResponse.redirect).toHaveBeenCalledWith(
        expect.stringContaining('https://app.forestadmin.com/oauth/authorize'),
      );
    });

    it('should include all required query parameters in redirect URL', async () => {
      await initializedProvider.authorize(
        mockClient,
        {
          redirectUri: 'https://example.com/callback',
          codeChallenge: 'test-code-challenge',
          state: 'test-state',
          scopes: ['mcp:read', 'profile'],
          resource: new URL('https://localhost:3931'),
        },
        mockResponse as Response,
      );

      const redirectCall = (mockResponse.redirect as jest.Mock).mock.calls[0][0];
      const url = new URL(redirectCall);

      expect(url.hostname).toBe('app.forestadmin.com');
      expect(url.pathname).toBe('/oauth/authorize');
      expect(url.searchParams.get('redirect_uri')).toBe('https://example.com/callback');
      expect(url.searchParams.get('code_challenge')).toBe('test-code-challenge');
      expect(url.searchParams.get('client_id')).toBe('test-client-id');
      expect(url.searchParams.get('state')).toBe('test-state');
      expect(url.searchParams.get('scope')).toBe('mcp:read+profile');
      expect(url.searchParams.get('environmentId')).toBe('12345');
    });

    it('should redirect to error URL when environmentId is not set', async () => {
      // Create a provider without initializing (environmentId is undefined)
      const uninitializedProvider = new ForestAdminOAuthProvider({
        forestServerUrl: 'https://api.forestadmin.com',
      });

      await uninitializedProvider.authorize(
        mockClient,
        {
          redirectUri: 'https://example.com/callback',
          codeChallenge: 'test-code-challenge',
          state: 'test-state',
          scopes: ['mcp:read'],
          resource: new URL('https://localhost:3931'),
        },
        mockResponse as Response,
      );

      const redirectCall = (mockResponse.redirect as jest.Mock).mock.calls[0][0];

      expect(redirectCall).toContain('https://example.com/callback');
      expect(redirectCall).toContain('error=server_error');
    });
  });
});

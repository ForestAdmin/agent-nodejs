import type { OAuthClientInformationFull } from '@modelcontextprotocol/sdk/shared/auth.js';
import type { Response } from 'express';

import createForestAdminClient from '@forestadmin/forestadmin-client';
import jsonwebtoken from 'jsonwebtoken';

import ForestAdminOAuthProvider from './forest-oauth-provider.js';
import MockServer from './test-utils/mock-server.js';

jest.mock('jsonwebtoken');
jest.mock('@forestadmin/forestadmin-client');

const mockCreateForestAdminClient = createForestAdminClient as jest.MockedFunction<
  typeof createForestAdminClient
>;
const mockJwtDecode = jsonwebtoken.decode as jest.Mock;
const mockJwtSign = jsonwebtoken.sign as jest.Mock;

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
      mockServer.get('/liana/environment', {
        data: { id: '98765', attributes: { api_endpoint: 'https://api.example.com' } },
      });
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
      mockServer.get('/liana/environment', {
        data: { id: '54321', attributes: { api_endpoint: 'https://api.example.com' } },
      });
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
      mockServer.get('/liana/environment', {
        data: { id: '11111', attributes: { api_endpoint: 'https://api.example.com' } },
      });
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
        json: () =>
          Promise.resolve({
            data: { id: '12345', attributes: { api_endpoint: 'https://api.example.com' } },
          }),
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
      expect(url.searchParams.get('code_challenge_method')).toBe('S256');
      expect(url.searchParams.get('response_type')).toBe('code');
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

  describe('exchangeAuthorizationCode', () => {
    let mockClient: OAuthClientInformationFull;
    let mockGetUserInfo: jest.Mock;

    beforeEach(() => {
      mockClient = {
        client_id: 'test-client-id',
        redirect_uris: ['https://example.com/callback'],
        scope: 'mcp:read mcp:write',
      } as OAuthClientInformationFull;

      // Setup mock for forestAdminClient
      mockGetUserInfo = jest.fn().mockResolvedValue({
        id: 123,
        email: 'user@example.com',
        firstName: 'Test',
        lastName: 'User',
        team: 'Operations',
        role: 'Admin',
        tags: {},
        renderingId: 456,
        permissionLevel: 'admin',
      });

      mockCreateForestAdminClient.mockReturnValue({
        authService: {
          getUserInfo: mockGetUserInfo,
        },
      } as unknown as ReturnType<typeof createForestAdminClient>);

      // Setup mock for jsonwebtoken
      mockJwtDecode.mockReturnValue({
        meta: { renderingId: 456 },
        expires_in: 3600,
        scope: 'mcp:read',
      });
      mockJwtSign.mockReturnValue('mocked-jwt-token');
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should exchange authorization code with Forest Admin server', async () => {
      mockServer
        .get('/liana/environment', {
          data: { id: '12345', attributes: { api_endpoint: 'https://api.example.com' } },
        })
        .post('/oauth/token', {
          access_token: 'forest-access-token',
          refresh_token: 'forest-refresh-token',
          expires_in: 3600,
          token_type: 'Bearer',
          scope: 'mcp:read',
        });
      global.fetch = mockServer.fetch;

      const provider = new ForestAdminOAuthProvider({
        forestServerUrl: 'https://api.forestadmin.com',
      });

      const result = await provider.exchangeAuthorizationCode(
        mockClient,
        'auth-code-123',
        'code-verifier-456',
        'https://example.com/callback',
      );

      expect(mockServer.fetch).toHaveBeenCalledWith(
        'https://api.forestadmin.com/oauth/token',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'forest-secret-key': 'test-env-secret',
          }),
          body: JSON.stringify({
            grant_type: 'authorization_code',
            code: 'auth-code-123',
            redirect_uri: 'https://example.com/callback',
            client_id: 'test-client-id',
            code_verifier: 'code-verifier-456',
          }),
        }),
      );

      expect(result.access_token).toBe('mocked-jwt-token');
      expect(result.refresh_token).toBe('mocked-jwt-token');
      expect(result.token_type).toBe('Bearer');
      expect(result.expires_in).toBe(3600);
      expect(result.scope).toBe('mcp:read');

      expect(mockJwtDecode).toHaveBeenCalledWith('forest-access-token');
      expect(mockGetUserInfo).toHaveBeenCalledWith(456, 'forest-access-token');

      // First call: access token
      expect(mockJwtSign).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 123,
          email: 'user@example.com',
          serverToken: 'forest-access-token',
        }),
        'test-auth-secret',
        { expiresIn: 3600 },
      );

      // Second call: refresh token
      expect(mockJwtSign).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'refresh',
          clientId: 'test-client-id',
          userId: 123,
          renderingId: 456,
          serverRefreshToken: 'forest-refresh-token',
        }),
        'test-auth-secret',
        { expiresIn: '7d' },
      );
    });

    it('should throw error when token exchange fails', async () => {
      mockServer
        .get('/liana/environment', {
          data: { id: '12345', attributes: { api_endpoint: 'https://api.example.com' } },
        })
        .post('/oauth/token', { error: 'invalid_grant' }, 400);
      global.fetch = mockServer.fetch;

      const provider = new ForestAdminOAuthProvider({
        forestServerUrl: 'https://api.forestadmin.com',
      });

      await expect(
        provider.exchangeAuthorizationCode(
          mockClient,
          'invalid-code',
          'code-verifier',
          'https://example.com/callback',
        ),
      ).rejects.toThrow('Failed to exchange authorization code');
    });
  });

  describe('exchangeRefreshToken', () => {
    let mockClient: OAuthClientInformationFull;
    let mockGetUserInfo: jest.Mock;

    beforeEach(() => {
      mockClient = {
        client_id: 'test-client-id',
        redirect_uris: ['https://example.com/callback'],
        scope: 'mcp:read mcp:write',
      } as OAuthClientInformationFull;

      mockGetUserInfo = jest.fn().mockResolvedValue({
        id: 123,
        email: 'user@example.com',
        firstName: 'Test',
        lastName: 'User',
        team: 'Operations',
        role: 'Admin',
        tags: {},
        renderingId: 456,
        permissionLevel: 'admin',
      });

      mockCreateForestAdminClient.mockReturnValue({
        authService: {
          getUserInfo: mockGetUserInfo,
        },
      } as unknown as ReturnType<typeof createForestAdminClient>);

      mockJwtSign.mockReturnValue('new-mocked-jwt-token');
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should exchange refresh token for new tokens', async () => {
      // Mock jwt.verify to return decoded refresh token
      (jsonwebtoken.verify as jest.Mock).mockReturnValue({
        type: 'refresh',
        clientId: 'test-client-id',
        userId: 123,
        renderingId: 456,
        serverRefreshToken: 'forest-refresh-token',
      });

      // Mock jwt.decode for the new access token
      mockJwtDecode.mockReturnValue({
        meta: { renderingId: 456 },
        expires_in: 3600,
        scope: 'mcp:read',
      });

      mockServer.post('/oauth/token', {
        access_token: 'new-forest-access-token',
        refresh_token: 'new-forest-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'mcp:read',
      });
      global.fetch = mockServer.fetch;

      const provider = new ForestAdminOAuthProvider({
        forestServerUrl: 'https://api.forestadmin.com',
      });

      const result = await provider.exchangeRefreshToken(mockClient, 'valid-refresh-token');

      expect(result.access_token).toBe('new-mocked-jwt-token');
      expect(result.refresh_token).toBe('new-mocked-jwt-token');
      expect(result.token_type).toBe('Bearer');
      expect(result.expires_in).toBe(3600);

      expect(mockServer.fetch).toHaveBeenCalledWith(
        'https://api.forestadmin.com/oauth/token',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            grant_type: 'refresh_token',
            refresh_token: 'forest-refresh-token',
            client_id: 'test-client-id',
          }),
        }),
      );
    });

    it('should throw error for invalid refresh token', async () => {
      (jsonwebtoken.verify as jest.Mock).mockImplementation(() => {
        throw new Error('invalid signature');
      });

      const provider = new ForestAdminOAuthProvider({
        forestServerUrl: 'https://api.forestadmin.com',
      });

      await expect(
        provider.exchangeRefreshToken(mockClient, 'invalid-refresh-token'),
      ).rejects.toThrow('Invalid or expired refresh token');
    });

    it('should throw error when token type is not refresh', async () => {
      (jsonwebtoken.verify as jest.Mock).mockReturnValue({
        type: 'access',
        clientId: 'test-client-id',
      });

      const provider = new ForestAdminOAuthProvider({
        forestServerUrl: 'https://api.forestadmin.com',
      });

      await expect(provider.exchangeRefreshToken(mockClient, 'access-token')).rejects.toThrow(
        'Invalid token type',
      );
    });

    it('should throw error when client_id does not match', async () => {
      (jsonwebtoken.verify as jest.Mock).mockReturnValue({
        type: 'refresh',
        clientId: 'different-client-id',
        userId: 123,
        renderingId: 456,
        serverRefreshToken: 'forest-refresh-token',
      });

      const provider = new ForestAdminOAuthProvider({
        forestServerUrl: 'https://api.forestadmin.com',
      });

      await expect(
        provider.exchangeRefreshToken(mockClient, 'refresh-token-for-different-client'),
      ).rejects.toThrow('Token was not issued to this client');
    });

    it('should throw error when Forest Admin refresh fails', async () => {
      (jsonwebtoken.verify as jest.Mock).mockReturnValue({
        type: 'refresh',
        clientId: 'test-client-id',
        userId: 123,
        renderingId: 456,
        serverRefreshToken: 'expired-forest-refresh-token',
      });

      mockServer.post('/oauth/token', { error: 'invalid_grant' }, 400);
      global.fetch = mockServer.fetch;

      const provider = new ForestAdminOAuthProvider({
        forestServerUrl: 'https://api.forestadmin.com',
      });

      await expect(
        provider.exchangeRefreshToken(mockClient, 'valid-refresh-token'),
      ).rejects.toThrow('Failed to refresh token');
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify and decode a valid access token', async () => {
      const mockDecoded = {
        id: 123,
        email: 'user@example.com',
        renderingId: 456,
        serverToken: 'forest-server-token',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };

      (jsonwebtoken.verify as jest.Mock).mockReturnValue(mockDecoded);

      const provider = new ForestAdminOAuthProvider({
        forestServerUrl: 'https://api.forestadmin.com',
      });

      const result = await provider.verifyAccessToken('valid-access-token');

      expect(result.token).toBe('valid-access-token');
      expect(result.clientId).toBe('456');
      expect(result.expiresAt).toBe(mockDecoded.exp);
      expect(result.scopes).toEqual(['mcp:read', 'mcp:write', 'mcp:action']);
      expect(result.extra).toEqual({
        userId: 123,
        email: 'user@example.com',
        renderingId: 456,
      });
    });

    it('should throw error for expired access token', async () => {
      (jsonwebtoken.verify as jest.Mock).mockImplementation(() => {
        throw new jsonwebtoken.TokenExpiredError('jwt expired', new Date());
      });

      const provider = new ForestAdminOAuthProvider({
        forestServerUrl: 'https://api.forestadmin.com',
      });

      await expect(provider.verifyAccessToken('expired-token')).rejects.toThrow(
        'Access token has expired',
      );
    });

    it('should throw error for invalid access token', async () => {
      (jsonwebtoken.verify as jest.Mock).mockImplementation(() => {
        throw new jsonwebtoken.JsonWebTokenError('invalid signature');
      });

      const provider = new ForestAdminOAuthProvider({
        forestServerUrl: 'https://api.forestadmin.com',
      });

      await expect(provider.verifyAccessToken('invalid-token')).rejects.toThrow(
        'Invalid access token',
      );
    });

    it('should throw error when using refresh token as access token', async () => {
      (jsonwebtoken.verify as jest.Mock).mockReturnValue({
        type: 'refresh',
        clientId: 'test-client-id',
      });

      const provider = new ForestAdminOAuthProvider({
        forestServerUrl: 'https://api.forestadmin.com',
      });

      await expect(provider.verifyAccessToken('refresh-token')).rejects.toThrow(
        'Cannot use refresh token as access token',
      );
    });
  });
});

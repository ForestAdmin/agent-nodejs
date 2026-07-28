import type { Logger } from '../src/server';
import type { TokenTtlOptions } from '../src/utils/token-ttl';
import type { OAuthClientInformationFull } from '@modelcontextprotocol/sdk/shared/auth';
import type { Response } from 'express';

import createForestAdminClient from '@forestadmin/forestadmin-client';
import { InvalidGrantError } from '@modelcontextprotocol/sdk/server/auth/errors.js';
import jsonwebtoken from 'jsonwebtoken';

import MockServer from './test-utils/mock-server';
import ForestOAuthProvider from '../src/forest-oauth-provider';

jest.mock('jsonwebtoken');
jest.mock('@forestadmin/forestadmin-client');

const mockCreateForestAdminClient = createForestAdminClient as jest.MockedFunction<
  typeof createForestAdminClient
>;
const mockJwtDecode = jsonwebtoken.decode as jest.Mock;
const mockJwtSign = jsonwebtoken.sign as jest.Mock;

const TEST_ENV_SECRET = 'test-env-secret';
const TEST_AUTH_SECRET = 'test-auth-secret';
const TEST_FOREST_APP_URL = 'https://app.forestadmin.com';

function createProvider(
  forestServerUrl = 'https://api.forestadmin.com',
  agentUrl?: string,
  tokenTtl?: TokenTtlOptions,
  logger: Logger = console.info,
) {
  return new ForestOAuthProvider({
    forestServerUrl,
    forestAppUrl: TEST_FOREST_APP_URL,
    envSecret: TEST_ENV_SECRET,
    authSecret: TEST_AUTH_SECRET,
    logger,
    agentUrl,
    tokenTtl,
  });
}

describe('ForestOAuthProvider', () => {
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
    process.env.FOREST_ENV_SECRET = TEST_ENV_SECRET;
    process.env.FOREST_AUTH_SECRET = TEST_AUTH_SECRET;
    mockServer = new MockServer();
  });

  afterEach(() => {
    mockServer.reset();
  });

  describe('constructor', () => {
    it('should create instance with forestServerUrl', () => {
      const customProvider = createProvider('https://custom.forestadmin.com');

      expect(customProvider).toBeDefined();
    });

    it('should create instance with custom forestAppUrl', () => {
      const customProvider = new ForestOAuthProvider({
        forestServerUrl: 'https://api.forestadmin.com',
        forestAppUrl: 'https://custom-app.forestadmin.com',
        envSecret: TEST_ENV_SECRET,
        authSecret: TEST_AUTH_SECRET,
        logger: console.info,
      });

      expect(customProvider).toBeDefined();
    });
  });

  describe('initialize', () => {
    it('should not throw when envSecret is empty string', async () => {
      const customProvider = new ForestOAuthProvider({
        forestServerUrl: 'https://api.forestadmin.com',
        forestAppUrl: TEST_FOREST_APP_URL,
        envSecret: '',
        authSecret: TEST_AUTH_SECRET,
        logger: console.info,
      });

      await expect(customProvider.initialize()).resolves.not.toThrow();
    });

    it('should fetch environmentId from Forest Admin API', async () => {
      mockServer.get('/liana/environment', {
        data: { id: '98765', attributes: { api_endpoint: 'https://api.example.com' } },
      });
      global.fetch = mockServer.fetch;

      const testProvider = createProvider();

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

      const testProvider = createProvider();

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

      const loggerSpy = jest.fn();
      const testProvider = new ForestOAuthProvider({
        forestServerUrl: 'https://api.forestadmin.com',
        forestAppUrl: TEST_FOREST_APP_URL,
        envSecret: TEST_ENV_SECRET,
        authSecret: TEST_AUTH_SECRET,
        logger: loggerSpy,
      });

      await testProvider.initialize();

      expect(loggerSpy).toHaveBeenCalledWith(
        'Warn',
        expect.stringContaining('Failed to fetch environmentId from Forest Admin API'),
      );
    });

    it('should handle fetch network errors gracefully', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const loggerSpy = jest.fn();
      const testProvider = new ForestOAuthProvider({
        forestServerUrl: 'https://api.forestadmin.com',
        forestAppUrl: TEST_FOREST_APP_URL,
        envSecret: TEST_ENV_SECRET,
        authSecret: TEST_AUTH_SECRET,
        logger: loggerSpy,
      });

      await testProvider.initialize();

      expect(loggerSpy).toHaveBeenCalledWith(
        'Warn',
        expect.stringContaining('Failed to fetch environmentId from Forest Admin API'),
      );
    });

    it('should use correct forest server URL for API call', async () => {
      mockServer.get('/liana/environment', {
        data: { id: '11111', attributes: { api_endpoint: 'https://api.example.com' } },
      });
      global.fetch = mockServer.fetch;

      const testProvider = createProvider('https://custom.forestadmin.com');

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

      const provider = createProvider();

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

      const provider = createProvider();

      const client = await provider.clientsStore.getClient('unknown-client');

      expect(client).toBeUndefined();
    });

    it('should return undefined on server error', async () => {
      mockServer.get('/oauth/register/error-client', { error: 'Internal error' }, 500);
      global.fetch = mockServer.fetch;

      const provider = createProvider();

      const client = await provider.clientsStore.getClient('error-client');

      expect(client).toBeUndefined();
    });
  });

  describe('authorize', () => {
    let mockResponse: Partial<Response>;
    let mockClient: OAuthClientInformationFull;
    let initializedProvider: ForestOAuthProvider;

    beforeEach(async () => {
      mockResponse = {
        redirect: jest.fn(),
      };
      mockClient = {
        client_id: 'test-client-id',
        redirect_uris: ['https://example.com/callback'],
      } as OAuthClientInformationFull;

      // Create provider and mock the fetch to set environmentId
      initializedProvider = createProvider();

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
      const uninitializedProvider = createProvider();

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

    it('should use custom forestAppUrl for redirect', async () => {
      const customAppUrl = 'https://custom-app.forestadmin.com';
      const customProvider = new ForestOAuthProvider({
        forestServerUrl: 'https://api.forestadmin.com',
        forestAppUrl: customAppUrl,
        envSecret: TEST_ENV_SECRET,
        authSecret: TEST_AUTH_SECRET,
        logger: console.info,
      });

      // Mock fetch to return a valid response for initialize
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { id: '12345', attributes: { api_endpoint: 'https://api.example.com' } },
          }),
      });

      await customProvider.initialize();

      await customProvider.authorize(
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
      const url = new URL(redirectCall);

      expect(url.hostname).toBe('custom-app.forestadmin.com');
      expect(url.pathname).toBe('/oauth/authorize');
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

      // Setup mock for jsonwebtoken - decode is called twice:
      // first for access token, then for refresh token
      const now = Math.floor(Date.now() / 1000);
      mockJwtDecode
        .mockReturnValueOnce({
          meta: { renderingId: 456 },
          exp: now + 3600, // expires in 1 hour
          iat: now,
          scope: 'mcp:read',
        })
        .mockReturnValueOnce({
          exp: now + 604800, // expires in 7 days
          iat: now,
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

      const provider = createProvider();

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
      // expires_in is calculated as exp - now, so it should be approximately 3600
      expect(result.expires_in).toBeGreaterThan(3590);
      expect(result.expires_in).toBeLessThanOrEqual(3600);
      expect(result.scope).toBe('mcp:read');

      expect(mockJwtDecode).toHaveBeenCalledWith('forest-access-token');
      expect(mockJwtDecode).toHaveBeenCalledWith('forest-refresh-token');
      expect(mockGetUserInfo).toHaveBeenCalledWith(456, 'forest-access-token');

      // First call: access token - expiresIn is calculated as exp - now, so it's approximately 3600
      expect(mockJwtSign).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 123,
          email: 'user@example.com',
          firstName: 'Test',
          lastName: 'User',
          renderingId: 456,
          // snake_case duplicates for Ruby (forest_liana) compatibility
          first_name: 'Test',
          last_name: 'User',
          rendering_id: '456',
          permission_level: 'admin',
          tags: [],
          serverToken: 'forest-access-token',
        }),
        'test-auth-secret',
        { expiresIn: expect.any(Number) },
      );

      // Second call: refresh token - expiresIn is calculated as exp - now, so it's approximately 604800
      expect(mockJwtSign).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'refresh',
          clientId: 'test-client-id',
          userId: 123,
          renderingId: 456,
          serverRefreshToken: 'forest-refresh-token',
        }),
        'test-auth-secret',
        { expiresIn: expect.any(Number) },
      );
    });

    it('should automatically convert all camelCase user claims to snake_case', async () => {
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

      const provider = createProvider();
      await provider.exchangeAuthorizationCode(
        mockClient,
        'auth-code-123',
        'code-verifier-456',
        'https://example.com/callback',
      );

      const signedPayload = mockJwtSign.mock.calls[0][0];

      // All camelCase UserInfo fields should have snake_case equivalents
      expect(signedPayload).toHaveProperty('first_name', 'Test');
      expect(signedPayload).toHaveProperty('last_name', 'User');
      expect(signedPayload).toHaveProperty('permission_level', 'admin');
      expect(signedPayload).toHaveProperty('rendering_id', '456');

      // Original camelCase fields should still be present
      expect(signedPayload).toHaveProperty('firstName', 'Test');
      expect(signedPayload).toHaveProperty('lastName', 'User');
      expect(signedPayload).toHaveProperty('permissionLevel', 'admin');
      expect(signedPayload).toHaveProperty('renderingId', 456);

      // Non-user fields should not be snake_cased
      expect(signedPayload).toHaveProperty('serverToken');
      expect(signedPayload).not.toHaveProperty('server_token');
    });

    it('should convert non-empty tags to array format for Ruby compatibility', async () => {
      mockGetUserInfo.mockResolvedValue({
        id: 123,
        email: 'user@example.com',
        firstName: 'Test',
        lastName: 'User',
        team: 'Operations',
        role: 'Admin',
        tags: { region: 'EU', plan: 'enterprise' },
        renderingId: 456,
        permissionLevel: 'admin',
      });

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

      const provider = createProvider();
      await provider.exchangeAuthorizationCode(
        mockClient,
        'auth-code-123',
        'code-verifier-456',
        'https://example.com/callback',
      );

      expect(mockJwtSign).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: [
            { key: 'region', value: 'EU' },
            { key: 'plan', value: 'enterprise' },
          ],
        }),
        'test-auth-secret',
        { expiresIn: expect.any(Number) },
      );
    });

    it('should throw error when token exchange fails', async () => {
      mockServer
        .get('/liana/environment', {
          data: { id: '12345', attributes: { api_endpoint: 'https://api.example.com' } },
        })
        .post('/oauth/token', { error: 'invalid_grant' }, 400);
      global.fetch = mockServer.fetch;

      const provider = createProvider();

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

      // Mock jwt.decode - called twice: first for access token, then for refresh token
      const now = Math.floor(Date.now() / 1000);
      mockJwtDecode
        .mockReturnValueOnce({
          meta: { renderingId: 456 },
          exp: now + 3600, // expires in 1 hour
          iat: now,
          scope: 'mcp:read',
        })
        .mockReturnValueOnce({
          exp: now + 604800, // expires in 7 days
          iat: now,
        });

      mockServer.post('/oauth/token', {
        access_token: 'new-forest-access-token',
        refresh_token: 'new-forest-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'mcp:read',
      });
      global.fetch = mockServer.fetch;

      const provider = createProvider();

      const result = await provider.exchangeRefreshToken(mockClient, 'valid-refresh-token');

      expect(result.access_token).toBe('new-mocked-jwt-token');
      expect(result.refresh_token).toBe('new-mocked-jwt-token');
      expect(result.token_type).toBe('Bearer');
      // expires_in is calculated as exp - now, so it should be approximately 3600
      expect(result.expires_in).toBeGreaterThan(3590);
      expect(result.expires_in).toBeLessThanOrEqual(3600);

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

      const provider = createProvider();

      await expect(
        provider.exchangeRefreshToken(mockClient, 'invalid-refresh-token'),
      ).rejects.toThrow('Invalid refresh token');
    });

    it('should throw error for expired refresh token', async () => {
      (jsonwebtoken.verify as jest.Mock).mockImplementation(() => {
        throw new jsonwebtoken.TokenExpiredError('jwt expired', new Date());
      });

      const provider = createProvider();

      await expect(
        provider.exchangeRefreshToken(mockClient, 'expired-refresh-token'),
      ).rejects.toThrow('Refresh token has expired');
    });

    it('should throw error when token type is not refresh', async () => {
      (jsonwebtoken.verify as jest.Mock).mockReturnValue({
        type: 'access',
        clientId: 'test-client-id',
      });

      const provider = createProvider();

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

      const provider = createProvider();

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

      const provider = createProvider();

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

      const provider = createProvider();

      const result = await provider.verifyAccessToken('valid-access-token');

      expect(result.token).toBe('valid-access-token');
      expect(result.clientId).toBe('123');
      expect(result.expiresAt).toBe(mockDecoded.exp);
      expect(result.scopes).toEqual(['mcp:read', 'mcp:write', 'mcp:action']);
      expect(result.extra).toEqual({
        userId: 123,
        email: 'user@example.com',
        renderingId: 456,
        environmentApiEndpoint: undefined,
        forestServerToken: 'forest-server-token',
      });
    });

    it('uses agentUrl as the tool callback endpoint when configured', async () => {
      (jsonwebtoken.verify as jest.Mock).mockReturnValue({
        id: 1,
        email: 'user@example.com',
        renderingId: 2,
        serverToken: 'forest-server-token',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      });

      const provider = createProvider(
        'https://api.forestadmin.com',
        'http://forest-agent.internal:3310',
      );
      const result = await provider.verifyAccessToken('valid-access-token');

      expect((result.extra as { environmentApiEndpoint: string }).environmentApiEndpoint).toBe(
        'http://forest-agent.internal:3310',
      );
    });

    it('falls back to the environment api_endpoint when no agentUrl is set', async () => {
      mockServer.get('/liana/environment', {
        data: { id: '1', attributes: { api_endpoint: 'https://public.example.com' } },
      });
      global.fetch = mockServer.fetch;

      (jsonwebtoken.verify as jest.Mock).mockReturnValue({
        id: 1,
        email: 'user@example.com',
        renderingId: 2,
        serverToken: 'forest-server-token',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      });

      const provider = createProvider();
      await provider.initialize();
      const result = await provider.verifyAccessToken('valid-access-token');

      expect((result.extra as { environmentApiEndpoint: string }).environmentApiEndpoint).toBe(
        'https://public.example.com',
      );
    });

    it('should throw error for expired access token', async () => {
      (jsonwebtoken.verify as jest.Mock).mockImplementation(() => {
        throw new jsonwebtoken.TokenExpiredError('jwt expired', new Date());
      });

      const provider = createProvider();

      await expect(provider.verifyAccessToken('expired-token')).rejects.toThrow(
        'Access token has expired',
      );
    });

    it('should throw error for invalid access token', async () => {
      (jsonwebtoken.verify as jest.Mock).mockImplementation(() => {
        throw new jsonwebtoken.JsonWebTokenError('invalid signature');
      });

      const provider = createProvider();

      await expect(provider.verifyAccessToken('invalid-token')).rejects.toThrow(
        'Invalid access token',
      );
    });

    it('should throw error when using refresh token as access token', async () => {
      (jsonwebtoken.verify as jest.Mock).mockReturnValue({
        type: 'refresh',
        clientId: 'test-client-id',
      });

      const provider = createProvider();

      await expect(provider.verifyAccessToken('refresh-token')).rejects.toThrow(
        'Cannot use refresh token as access token',
      );
    });

    it('should include environmentApiEndpoint after initialize is called', async () => {
      mockServer.get('/liana/environment', {
        data: {
          id: '12345',
          attributes: { api_endpoint: 'https://api.example.com' },
        },
      });

      global.fetch = mockServer.fetch;

      const mockDecoded = {
        id: 123,
        email: 'user@example.com',
        renderingId: 456,
        serverToken: 'forest-server-token',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };

      (jsonwebtoken.verify as jest.Mock).mockReturnValue(mockDecoded);

      const provider = createProvider();

      // Call initialize to fetch environment data
      await provider.initialize();

      const result = await provider.verifyAccessToken('valid-access-token');

      expect(result.extra).toEqual({
        userId: 123,
        email: 'user@example.com',
        renderingId: 456,
        environmentApiEndpoint: 'https://api.example.com',
        forestServerToken: 'forest-server-token',
      });
    });
  });

  describe('tokenTtl', () => {
    const NOW_MS = Date.UTC(2026, 0, 1);
    const nowInSeconds = Math.floor(NOW_MS / 1000);
    const FOREST_ACCESS_TTL = 3600;
    const FOREST_REFRESH_TTL = 604800;

    let mockClient: OAuthClientInformationFull;

    function primeForestTokens() {
      mockJwtDecode
        .mockReturnValueOnce({
          meta: { renderingId: 456 },
          exp: nowInSeconds + FOREST_ACCESS_TTL,
          iat: nowInSeconds,
          scope: 'mcp:read',
        })
        .mockReturnValueOnce({
          exp: nowInSeconds + FOREST_REFRESH_TTL,
          iat: nowInSeconds,
        });
      mockJwtSign.mockReturnValue('mocked-jwt-token');

      mockServer
        .get('/liana/environment', {
          data: { id: '12345', attributes: { api_endpoint: 'https://api.example.com' } },
        })
        .post('/oauth/token', {
          access_token: 'forest-access-token',
          refresh_token: 'forest-refresh-token',
          expires_in: FOREST_ACCESS_TTL,
          token_type: 'Bearer',
          scope: 'mcp:read',
        });
      global.fetch = mockServer.fetch;
    }

    const signedTtl = (nthCall: number) => mockJwtSign.mock.calls[nthCall - 1][2].expiresIn;
    const signedPayload = (nthCall: number) => mockJwtSign.mock.calls[nthCall - 1][0];

    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(NOW_MS);

      mockClient = {
        client_id: 'test-client-id',
        redirect_uris: ['https://example.com/callback'],
        scope: 'mcp:read mcp:write',
      } as OAuthClientInformationFull;

      mockCreateForestAdminClient.mockReturnValue({
        authService: {
          getUserInfo: jest.fn().mockResolvedValue({
            id: 123,
            email: 'user@example.com',
            firstName: 'Test',
            lastName: 'User',
            team: 'Operations',
            role: 'Admin',
            tags: {},
            renderingId: 456,
            permissionLevel: 'admin',
          }),
        },
      } as unknown as ReturnType<typeof createForestAdminClient>);

      primeForestTokens();
    });

    afterEach(() => {
      jest.useRealTimers();
      jest.clearAllMocks();
    });

    it('shortens both token lifetimes to the configured caps', async () => {
      const provider = createProvider(undefined, undefined, {
        accessTokenSeconds: 900,
        refreshTokenSeconds: 86400,
      });

      const result = await provider.exchangeAuthorizationCode(mockClient, 'auth-code-123');

      expect(signedTtl(1)).toBe(900);
      expect(signedTtl(2)).toBe(86400);
      expect(result.expires_in).toBe(900);
    });

    it('never extends beyond the lifetimes Forest Admin granted', async () => {
      const provider = createProvider(undefined, undefined, {
        accessTokenSeconds: 7200,
        refreshTokenSeconds: 30 * 24 * 3600,
      });

      const result = await provider.exchangeAuthorizationCode(mockClient, 'auth-code-123');

      expect(signedTtl(1)).toBe(FOREST_ACCESS_TTL);
      expect(signedTtl(2)).toBe(FOREST_REFRESH_TTL);
      expect(result.expires_in).toBe(FOREST_ACCESS_TTL);
    });

    it('warns when the access cap exceeds the lifetime Forest Admin granted', async () => {
      const logger = jest.fn();
      const provider = createProvider(undefined, undefined, { accessTokenSeconds: 7200 }, logger);

      await provider.exchangeAuthorizationCode(mockClient, 'auth-code-123');

      expect(logger).toHaveBeenCalledWith(
        'Warn',
        expect.stringContaining(`tokenTtl.accessTokenSeconds=7200 exceeds the 3600s`),
      );
    });

    // A refresh cap bounds the whole session, which Forest re-extends on every refresh, so a value
    // above one token's lifetime still forces a re-login and must not be reported as inert.
    it('stays silent when the refresh cap exceeds one Forest refresh lifetime', async () => {
      const logger = jest.fn();
      const provider = createProvider(
        undefined,
        undefined,
        { refreshTokenSeconds: 30 * 24 * 3600 },
        logger,
      );

      await provider.exchangeAuthorizationCode(mockClient, 'auth-code-123');

      expect(logger).not.toHaveBeenCalled();
    });

    it('warns once per field instead of on every token issuance', async () => {
      const logger = jest.fn();
      const provider = createProvider(undefined, undefined, { accessTokenSeconds: 7200 }, logger);

      await provider.exchangeAuthorizationCode(mockClient, 'auth-code-123');
      primeForestTokens();
      await provider.exchangeAuthorizationCode(mockClient, 'auth-code-456');

      expect(logger).toHaveBeenCalledTimes(1);
    });

    it('stays silent when the caps are effective', async () => {
      const logger = jest.fn();
      const provider = createProvider(
        undefined,
        undefined,
        { accessTokenSeconds: 900, refreshTokenSeconds: 86400 },
        logger,
      );

      await provider.exchangeAuthorizationCode(mockClient, 'auth-code-123');

      expect(logger).not.toHaveBeenCalled();
    });

    it('stays silent when the Forest token is already expired', async () => {
      const logger = jest.fn();
      mockJwtDecode.mockReset();
      mockJwtDecode
        .mockReturnValueOnce({
          meta: { renderingId: 456 },
          exp: nowInSeconds - 10,
          iat: nowInSeconds - 3610,
          scope: 'mcp:read',
        })
        .mockReturnValueOnce({ exp: nowInSeconds + FOREST_REFRESH_TTL, iat: nowInSeconds });
      const provider = createProvider(undefined, undefined, { accessTokenSeconds: 7200 }, logger);

      await provider.exchangeAuthorizationCode(mockClient, 'auth-code-123');

      expect(logger).not.toHaveBeenCalled();
    });

    it('leaves both lifetimes untouched when no cap is configured', async () => {
      const provider = createProvider();

      const result = await provider.exchangeAuthorizationCode(mockClient, 'auth-code-123');

      expect(signedTtl(1)).toBe(FOREST_ACCESS_TTL);
      expect(signedTtl(2)).toBe(FOREST_REFRESH_TTL);
      expect(result.expires_in).toBe(FOREST_ACCESS_TTL);
    });

    it('stamps the session start on the refresh token issued at login', async () => {
      const provider = createProvider(undefined, undefined, { refreshTokenSeconds: 86400 });

      await provider.exchangeAuthorizationCode(mockClient, 'auth-code-123');

      expect(signedPayload(2)).toEqual(
        expect.objectContaining({ type: 'refresh', sessionStartedAt: nowInSeconds }),
      );
    });

    // Every real refresh token carries both claims, `iat` being the mint time of that refresh. The
    // anchor must be the stamped session start, or the window slides on every refresh.
    it('anchors on the stamped session start, not on the refresh token issue date', async () => {
      (jsonwebtoken.verify as jest.Mock).mockReturnValue({
        type: 'refresh',
        clientId: 'test-client-id',
        userId: 123,
        renderingId: 456,
        serverRefreshToken: 'forest-refresh-token',
        sessionStartedAt: nowInSeconds - 80000,
        iat: nowInSeconds - 300,
      });
      const provider = createProvider(undefined, undefined, { refreshTokenSeconds: 86400 });

      await provider.exchangeRefreshToken(mockClient, 'our-refresh-token');

      expect(signedTtl(2)).toBe(6400);
      expect(signedPayload(2)).toEqual(
        expect.objectContaining({ sessionStartedAt: nowInSeconds - 80000 }),
      );
    });

    it('keeps the access token inside the session window', async () => {
      (jsonwebtoken.verify as jest.Mock).mockReturnValue({
        type: 'refresh',
        clientId: 'test-client-id',
        userId: 123,
        renderingId: 456,
        serverRefreshToken: 'forest-refresh-token',
        sessionStartedAt: nowInSeconds - 86340,
      });
      const provider = createProvider(undefined, undefined, { refreshTokenSeconds: 86400 });

      const result = await provider.exchangeRefreshToken(mockClient, 'our-refresh-token');

      expect(signedTtl(1)).toBe(60);
      expect(result.expires_in).toBe(60);
    });

    it('rejects when the session elapses while talking to Forest Admin', async () => {
      (jsonwebtoken.verify as jest.Mock).mockReturnValue({
        type: 'refresh',
        clientId: 'test-client-id',
        userId: 123,
        renderingId: 456,
        serverRefreshToken: 'forest-refresh-token',
        sessionStartedAt: nowInSeconds - 86399,
      });
      const provider = createProvider(undefined, undefined, { refreshTokenSeconds: 86400 });

      // The pre-flight check passes with 1s left, then the round trips outlast the session.
      const pending = provider.exchangeRefreshToken(mockClient, 'our-refresh-token');
      jest.setSystemTime(NOW_MS + 5000);

      // Only invalid_grant makes the client re-run the interactive login.
      await expect(pending).rejects.toBeInstanceOf(InvalidGrantError);
      expect(mockJwtSign).not.toHaveBeenCalled();
    });

    it('rejects a refresh once the session window has elapsed, without calling Forest Admin', async () => {
      (jsonwebtoken.verify as jest.Mock).mockReturnValue({
        type: 'refresh',
        clientId: 'test-client-id',
        userId: 123,
        renderingId: 456,
        serverRefreshToken: 'forest-refresh-token',
        sessionStartedAt: nowInSeconds - 90000,
      });
      const provider = createProvider(undefined, undefined, { refreshTokenSeconds: 86400 });

      await expect(
        provider.exchangeRefreshToken(mockClient, 'our-refresh-token'),
      ).rejects.toBeInstanceOf(InvalidGrantError);
      expect(mockServer.fetch).not.toHaveBeenCalledWith(
        expect.stringContaining('/oauth/token'),
        expect.anything(),
      );
    });

    it('falls back to the issue date for a refresh token minted before the anchor existed', async () => {
      (jsonwebtoken.verify as jest.Mock).mockReturnValue({
        type: 'refresh',
        clientId: 'test-client-id',
        userId: 123,
        renderingId: 456,
        serverRefreshToken: 'forest-refresh-token',
        iat: nowInSeconds - 1000,
      });
      const provider = createProvider(undefined, undefined, { refreshTokenSeconds: 86400 });

      await provider.exchangeRefreshToken(mockClient, 'our-refresh-token');

      expect(signedTtl(2)).toBe(85400);
    });

    it('still advertises the 3600 fallback when the Forest token is already expired', async () => {
      mockJwtDecode.mockReset();
      mockJwtDecode
        .mockReturnValueOnce({
          meta: { renderingId: 456 },
          exp: nowInSeconds - 10,
          iat: nowInSeconds - 3610,
          scope: 'mcp:read',
        })
        .mockReturnValueOnce({ exp: nowInSeconds + FOREST_REFRESH_TTL, iat: nowInSeconds });
      const provider = createProvider();

      const result = await provider.exchangeAuthorizationCode(mockClient, 'auth-code-123');

      expect(signedTtl(1)).toBe(-10);
      expect(result.expires_in).toBe(3600);
    });
  });
});

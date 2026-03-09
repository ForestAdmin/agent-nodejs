import jsonwebtoken from 'jsonwebtoken';

import MockServer from './test-utils/mock-server';
import { generateToken } from '../src/generate-token';

const VALID_ENV_SECRET = 'a'.repeat(64);
const AUTH_SECRET = 'my-auth-secret';
const RENDERING_ID = 42;

function createOAuthToken(
  overrides: Record<string, unknown> = {},
  expiresIn: number | null = 3600,
): string {
  const payload = {
    meta: { renderingId: RENDERING_ID },
    ...overrides,
  };

  if (expiresIn === null) {
    return jsonwebtoken.sign(payload, 'pat-secret');
  }

  return jsonwebtoken.sign(payload, 'pat-secret', { expiresIn });
}

function createApplicationToken(expiresIn = 3600): string {
  const payload = {
    isApplicationToken: true,
    data: {
      data: {
        type: 'users',
        id: '200',
        attributes: {
          first_name: 'Jane',
          last_name: 'Smith',
          email: 'jane@example.com',
        },
      },
    },
  };

  return jsonwebtoken.sign(payload, 'pat-secret', { expiresIn });
}

function createUserInfoResponse(id = '100') {
  return {
    data: {
      id,
      attributes: {
        email: 'john@example.com',
        first_name: 'John',
        last_name: 'Doe',
        teams: ['Operations'],
        role: 'admin',
        permission_level: 'admin',
        tags: [{ key: 'city', value: 'Paris' }],
      },
    },
  };
}

describe('generateToken', () => {
  const originalFetch = global.fetch;
  let mockServer: MockServer;

  beforeEach(() => {
    mockServer = new MockServer();
    global.fetch = mockServer.fetch;
  });

  afterEach(() => {
    mockServer.reset();
    global.fetch = originalFetch;
  });

  describe('input validation', () => {
    it('should throw if envSecret is missing', async () => {
      await expect(
        generateToken({ envSecret: '', authSecret: AUTH_SECRET, token: 'some-token' }),
      ).rejects.toThrow('FOREST_ENV_SECRET is invalid. Expected 64 hex characters.');
    });

    it('should throw if envSecret is not 64 hex characters', async () => {
      await expect(
        generateToken({ envSecret: 'not-hex', authSecret: AUTH_SECRET, token: 'some-token' }),
      ).rejects.toThrow('FOREST_ENV_SECRET is invalid. Expected 64 hex characters.');
    });

    it('should throw if envSecret contains uppercase hex', async () => {
      await expect(
        generateToken({ envSecret: 'A'.repeat(64), authSecret: AUTH_SECRET, token: 'some-token' }),
      ).rejects.toThrow('FOREST_ENV_SECRET is invalid. Expected 64 hex characters.');
    });

    it('should throw if authSecret is missing', async () => {
      await expect(
        generateToken({ envSecret: VALID_ENV_SECRET, authSecret: '', token: 'some-token' }),
      ).rejects.toThrow('FOREST_AUTH_SECRET is required.');
    });

    it('should throw if token is missing', async () => {
      await expect(
        generateToken({ envSecret: VALID_ENV_SECRET, authSecret: AUTH_SECRET, token: '' }),
      ).rejects.toThrow('A personal access token is required.');
    });
  });

  describe('token validation', () => {
    it('should throw if token is not a valid JWT', async () => {
      await expect(
        generateToken({
          envSecret: VALID_ENV_SECRET,
          authSecret: AUTH_SECRET,
          token: 'not-a-jwt',
        }),
      ).rejects.toThrow(
        'Could not decode token. Ensure it is a valid Forest Admin personal access token.',
      );
    });

    it('should throw if token has expired', async () => {
      const pat = jsonwebtoken.sign({ meta: { renderingId: 1 } }, 'secret', { expiresIn: -1 });

      await expect(
        generateToken({ envSecret: VALID_ENV_SECRET, authSecret: AUTH_SECRET, token: pat }),
      ).rejects.toThrow('Token has expired. Please generate a new personal access token.');
    });
  });

  describe('OAuth token flow (meta.renderingId)', () => {
    it('should throw if token has no meta.renderingId', async () => {
      const pat = jsonwebtoken.sign({ foo: 'bar' }, 'secret', { expiresIn: '1h' });

      await expect(
        generateToken({ envSecret: VALID_ENV_SECRET, authSecret: AUTH_SECRET, token: pat }),
      ).rejects.toThrow('Token does not contain a renderingId (expected in meta.renderingId).');
    });

    it('should generate a valid MCP token with correct user info', async () => {
      const pat = createOAuthToken();
      mockServer.get(/\/liana\/v2\/renderings\//, createUserInfoResponse());

      const { token } = await generateToken({
        envSecret: VALID_ENV_SECRET,
        authSecret: AUTH_SECRET,
        token: pat,
      });

      const decoded = jsonwebtoken.verify(token, AUTH_SECRET) as Record<string, unknown>;
      expect(decoded).toEqual(
        expect.objectContaining({
          id: 100,
          email: 'john@example.com',
          firstName: 'John',
          lastName: 'Doe',
          team: 'Operations',
          role: 'admin',
          permissionLevel: 'admin',
          renderingId: RENDERING_ID,
          tags: { city: 'Paris' },
          serverToken: pat,
          scopes: ['mcp:read', 'mcp:write', 'mcp:action'],
        }),
      );
    });

    it('should call the API with correct headers', async () => {
      const pat = createOAuthToken();
      mockServer.get(/\/liana\/v2\/renderings\//, createUserInfoResponse());

      await generateToken({
        envSecret: VALID_ENV_SECRET,
        authSecret: AUTH_SECRET,
        token: pat,
      });

      expect(mockServer.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/liana/v2/renderings/${RENDERING_ID}/authorization`),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'forest-token': pat,
            'forest-secret-key': VALID_ENV_SECRET,
          }),
        }),
      );
    });

    it('should handle missing tags in user info response', async () => {
      const pat = createOAuthToken();
      const response = createUserInfoResponse();
      delete (response.data.attributes as Record<string, unknown>).tags;
      mockServer.get(/\/liana\/v2\/renderings\//, response);

      const { token } = await generateToken({
        envSecret: VALID_ENV_SECRET,
        authSecret: AUTH_SECRET,
        token: pat,
      });

      const decoded = jsonwebtoken.verify(token, AUTH_SECRET) as Record<string, unknown>;
      expect(decoded.tags).toBeUndefined();
    });

    it('should handle user with empty teams array', async () => {
      const pat = createOAuthToken();
      const response = createUserInfoResponse();
      response.data.attributes.teams = [];
      mockServer.get(/\/liana\/v2\/renderings\//, response);

      const { token } = await generateToken({
        envSecret: VALID_ENV_SECRET,
        authSecret: AUTH_SECRET,
        token: pat,
      });

      const decoded = jsonwebtoken.verify(token, AUTH_SECRET) as Record<string, unknown>;
      expect(decoded.team).toBeUndefined();
    });
  });

  describe('application token flow (isApplicationToken)', () => {
    it('should throw if --rendering-id is missing', async () => {
      const pat = createApplicationToken();

      await expect(
        generateToken({
          envSecret: VALID_ENV_SECRET,
          authSecret: AUTH_SECRET,
          token: pat,
        }),
      ).rejects.toThrow('--rendering-id is required when using a personal access token.');
    });

    it('should throw if --rendering-id is not a number', async () => {
      const pat = createApplicationToken();

      await expect(
        generateToken({
          envSecret: VALID_ENV_SECRET,
          authSecret: AUTH_SECRET,
          token: pat,
          renderingId: 'abc',
        }),
      ).rejects.toThrow('--rendering-id is required when using a personal access token.');
    });

    it('should generate a token with user info from PAT', async () => {
      const pat = createApplicationToken();

      const { token } = await generateToken({
        envSecret: VALID_ENV_SECRET,
        authSecret: AUTH_SECRET,
        token: pat,
        renderingId: '99',
      });

      const decoded = jsonwebtoken.verify(token, AUTH_SECRET) as Record<string, unknown>;
      expect(decoded).toEqual(
        expect.objectContaining({
          id: 200,
          email: 'jane@example.com',
          firstName: 'Jane',
          lastName: 'Smith',
          renderingId: 99,
          serverToken: pat,
          scopes: ['mcp:read', 'mcp:write', 'mcp:action'],
        }),
      );
    });

    it('should throw if application token has no email in attributes', async () => {
      const pat = jsonwebtoken.sign(
        {
          isApplicationToken: true,
          data: {
            data: { type: 'users', id: '200', attributes: { first_name: 'Jane', last_name: 'S' } },
          },
        },
        'pat-secret',
        { expiresIn: 3600 },
      );

      await expect(
        generateToken({
          envSecret: VALID_ENV_SECRET,
          authSecret: AUTH_SECRET,
          token: pat,
          renderingId: '99',
        }),
      ).rejects.toThrow('Token does not contain valid user attributes.');
    });

    it('should throw if application token has no user ID', async () => {
      const pat = jsonwebtoken.sign(
        {
          isApplicationToken: true,
          data: {
            data: {
              type: 'users',
              attributes: { first_name: 'J', last_name: 'S', email: 'j@x.com' },
            },
          },
        },
        'pat-secret',
        { expiresIn: 3600 },
      );

      await expect(
        generateToken({
          envSecret: VALID_ENV_SECRET,
          authSecret: AUTH_SECRET,
          token: pat,
          renderingId: '99',
        }),
      ).rejects.toThrow('Token does not contain a valid user ID.');
    });

    it('should not call the Forest Admin API', async () => {
      const pat = createApplicationToken();

      await generateToken({
        envSecret: VALID_ENV_SECRET,
        authSecret: AUTH_SECRET,
        token: pat,
        renderingId: '99',
      });

      expect(mockServer.fetch).not.toHaveBeenCalled();
    });
  });

  describe('Forest Admin API errors', () => {
    it('should throw on 401 response', async () => {
      const pat = createOAuthToken();
      mockServer.get(/\/liana\/v2\/renderings\//, {}, 401);

      await expect(
        generateToken({ envSecret: VALID_ENV_SECRET, authSecret: AUTH_SECRET, token: pat }),
      ).rejects.toThrow('Authentication failed. Check your env secret and token.');
    });

    it('should throw on 404 response', async () => {
      const pat = createOAuthToken();
      mockServer.get(/\/liana\/v2\/renderings\//, {}, 404);

      await expect(
        generateToken({ envSecret: VALID_ENV_SECRET, authSecret: AUTH_SECRET, token: pat }),
      ).rejects.toThrow('Could not find rendering. Check that your token matches the environment.');
    });

    it('should throw on other API errors', async () => {
      const pat = createOAuthToken();
      mockServer.get(/\/liana\/v2\/renderings\//, {}, 500);

      await expect(
        generateToken({ envSecret: VALID_ENV_SECRET, authSecret: AUTH_SECRET, token: pat }),
      ).rejects.toThrow('Forest Admin API error (HTTP 500)');
    });

    it('should throw on unexpected API response structure', async () => {
      const pat = createOAuthToken();
      mockServer.get(/\/liana\/v2\/renderings\//, { data: { id: '100' } });

      await expect(
        generateToken({ envSecret: VALID_ENV_SECRET, authSecret: AUTH_SECRET, token: pat }),
      ).rejects.toThrow(
        'Unexpected API response structure. This may indicate an API version mismatch.',
      );
    });

    it('should throw if API response is missing user email', async () => {
      const pat = createOAuthToken();
      const response = createUserInfoResponse();
      delete (response.data.attributes as Record<string, unknown>).email;
      mockServer.get(/\/liana\/v2\/renderings\//, response);

      await expect(
        generateToken({ envSecret: VALID_ENV_SECRET, authSecret: AUTH_SECRET, token: pat }),
      ).rejects.toThrow('API response is missing the user email.');
    });

    it('should throw if API response has invalid user ID', async () => {
      const pat = createOAuthToken();
      const response = createUserInfoResponse();
      (response.data as Record<string, unknown>).id = undefined;
      mockServer.get(/\/liana\/v2\/renderings\//, response);

      await expect(
        generateToken({ envSecret: VALID_ENV_SECRET, authSecret: AUTH_SECRET, token: pat }),
      ).rejects.toThrow('API response contains an invalid user ID');
    });

    it('should throw on network errors with a clear message', async () => {
      const pat = createOAuthToken();
      global.fetch = jest.fn().mockRejectedValue(new Error('getaddrinfo ENOTFOUND'));

      await expect(
        generateToken({ envSecret: VALID_ENV_SECRET, authSecret: AUTH_SECRET, token: pat }),
      ).rejects.toThrow('Failed to connect to Forest Admin API');
    });

    it('should throw on malformed JSON response', async () => {
      const pat = createOAuthToken();

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.reject(new SyntaxError('Unexpected token <')),
      });

      await expect(
        generateToken({ envSecret: VALID_ENV_SECRET, authSecret: AUTH_SECRET, token: pat }),
      ).rejects.toThrow('Failed to parse Forest Admin API response');
    });
  });

  describe('expiration and options', () => {
    it('should respect expiresIn in the generated token', async () => {
      const pat = createOAuthToken({}, 7200);
      mockServer.get(/\/liana\/v2\/renderings\//, createUserInfoResponse());

      const { token } = await generateToken({
        envSecret: VALID_ENV_SECRET,
        authSecret: AUTH_SECRET,
        token: pat,
        expiresIn: '2h',
      });

      const decoded = jsonwebtoken.verify(token, AUTH_SECRET) as { exp: number; iat: number };
      expect(decoded.exp - decoded.iat).toBe(7200);
    });

    it('should use custom forestServerUrl', async () => {
      const pat = createOAuthToken();
      mockServer.get(/\/liana\/v2\/renderings\//, createUserInfoResponse());

      await generateToken({
        envSecret: VALID_ENV_SECRET,
        authSecret: AUTH_SECRET,
        token: pat,
        forestServerUrl: 'https://custom.forestadmin.com',
      });

      expect(mockServer.fetch).toHaveBeenCalledWith(
        expect.stringContaining('https://custom.forestadmin.com/liana/v2/renderings/'),
        expect.anything(),
      );
    });

    it('should default expiresIn to 1h', async () => {
      const pat = createOAuthToken();
      mockServer.get(/\/liana\/v2\/renderings\//, createUserInfoResponse());

      const { token } = await generateToken({
        envSecret: VALID_ENV_SECRET,
        authSecret: AUTH_SECRET,
        token: pat,
      });

      const decoded = jsonwebtoken.verify(token, AUTH_SECRET) as { exp: number; iat: number };
      expect(decoded.exp - decoded.iat).toBe(3600);
    });

    it('should cap expiresIn to 60 days and emit a warning', async () => {
      const pat = createOAuthToken({}, 90 * 86400);
      mockServer.get(/\/liana\/v2\/renderings\//, createUserInfoResponse());

      const { token, warnings } = await generateToken({
        envSecret: VALID_ENV_SECRET,
        authSecret: AUTH_SECRET,
        token: pat,
        expiresIn: '90d',
      });

      const decoded = jsonwebtoken.verify(token, AUTH_SECRET) as { exp: number; iat: number };
      expect(decoded.exp - decoded.iat).toBe(60 * 86400);
      expect(warnings).toEqual(
        expect.arrayContaining([expect.stringContaining('exceeds maximum of 60 days')]),
      );
    });
  });

  describe('warnings', () => {
    it('should warn if expiresIn exceeds PAT remaining lifetime', async () => {
      const pat = createOAuthToken({}, 1800);
      mockServer.get(/\/liana\/v2\/renderings\//, createUserInfoResponse());

      const { warnings } = await generateToken({
        envSecret: VALID_ENV_SECRET,
        authSecret: AUTH_SECRET,
        token: pat,
        expiresIn: '2h',
      });

      expect(warnings).toEqual(
        expect.arrayContaining([
          expect.stringContaining(
            'requested token lifetime exceeds the remaining lifetime of your personal access token',
          ),
        ]),
      );
    });

    it('should always include a security warning about embedded PAT', async () => {
      const pat = createOAuthToken();
      mockServer.get(/\/liana\/v2\/renderings\//, createUserInfoResponse());

      const { warnings } = await generateToken({
        envSecret: VALID_ENV_SECRET,
        authSecret: AUTH_SECRET,
        token: pat,
      });

      expect(warnings).toEqual(
        expect.arrayContaining([
          expect.stringContaining('personal access token is embedded in the generated JWT'),
        ]),
      );
    });

    it('should not warn about PAT lifetime when PAT has no exp claim', async () => {
      const pat = createOAuthToken({}, null);
      mockServer.get(/\/liana\/v2\/renderings\//, createUserInfoResponse());

      const { warnings } = await generateToken({
        envSecret: VALID_ENV_SECRET,
        authSecret: AUTH_SECRET,
        token: pat,
        expiresIn: '2h',
      });

      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('personal access token is embedded');
    });
  });

  describe('expiresIn parsing', () => {
    it('should reject negative expiresIn with unit suffix', async () => {
      const pat = createOAuthToken();

      await expect(
        generateToken({
          envSecret: VALID_ENV_SECRET,
          authSecret: AUTH_SECRET,
          token: pat,
          expiresIn: '-5h',
        }),
      ).rejects.toThrow('Invalid --expires-in value');
    });

    it('should accept seconds notation', async () => {
      const pat = createOAuthToken();
      mockServer.get(/\/liana\/v2\/renderings\//, createUserInfoResponse());

      const { token } = await generateToken({
        envSecret: VALID_ENV_SECRET,
        authSecret: AUTH_SECRET,
        token: pat,
        expiresIn: '300s',
      });

      const decoded = jsonwebtoken.verify(token, AUTH_SECRET) as { exp: number; iat: number };
      expect(decoded.exp - decoded.iat).toBe(300);
    });

    it('should accept minutes notation', async () => {
      const pat = createOAuthToken();
      mockServer.get(/\/liana\/v2\/renderings\//, createUserInfoResponse());

      const { token } = await generateToken({
        envSecret: VALID_ENV_SECRET,
        authSecret: AUTH_SECRET,
        token: pat,
        expiresIn: '30m',
      });

      const decoded = jsonwebtoken.verify(token, AUTH_SECRET) as { exp: number; iat: number };
      expect(decoded.exp - decoded.iat).toBe(1800);
    });

    it('should accept days notation', async () => {
      const pat = createOAuthToken({}, 10 * 86400);
      mockServer.get(/\/liana\/v2\/renderings\//, createUserInfoResponse());

      const { token } = await generateToken({
        envSecret: VALID_ENV_SECRET,
        authSecret: AUTH_SECRET,
        token: pat,
        expiresIn: '7d',
      });

      const decoded = jsonwebtoken.verify(token, AUTH_SECRET) as { exp: number; iat: number };
      expect(decoded.exp - decoded.iat).toBe(7 * 86400);
    });

    it('should accept plain number as seconds', async () => {
      const pat = createOAuthToken();
      mockServer.get(/\/liana\/v2\/renderings\//, createUserInfoResponse());

      const { token } = await generateToken({
        envSecret: VALID_ENV_SECRET,
        authSecret: AUTH_SECRET,
        token: pat,
        expiresIn: '600',
      });

      const decoded = jsonwebtoken.verify(token, AUTH_SECRET) as { exp: number; iat: number };
      expect(decoded.exp - decoded.iat).toBe(600);
    });

    it('should reject invalid expiresIn format', async () => {
      const pat = createOAuthToken();

      await expect(
        generateToken({
          envSecret: VALID_ENV_SECRET,
          authSecret: AUTH_SECRET,
          token: pat,
          expiresIn: 'invalid',
        }),
      ).rejects.toThrow('Invalid --expires-in value');
    });

    it('should reject zero expiresIn', async () => {
      const pat = createOAuthToken();

      await expect(
        generateToken({
          envSecret: VALID_ENV_SECRET,
          authSecret: AUTH_SECRET,
          token: pat,
          expiresIn: '0',
        }),
      ).rejects.toThrow('--expires-in must be a positive duration.');
    });

    it('should reject negative expiresIn', async () => {
      const pat = createOAuthToken();

      await expect(
        generateToken({
          envSecret: VALID_ENV_SECRET,
          authSecret: AUTH_SECRET,
          token: pat,
          expiresIn: '-1',
        }),
      ).rejects.toThrow('--expires-in must be a positive duration.');
    });

    it('should reject zero duration with unit', async () => {
      const pat = createOAuthToken();

      await expect(
        generateToken({
          envSecret: VALID_ENV_SECRET,
          authSecret: AUTH_SECRET,
          token: pat,
          expiresIn: '0h',
        }),
      ).rejects.toThrow('--expires-in must be a positive duration.');
    });
  });
});

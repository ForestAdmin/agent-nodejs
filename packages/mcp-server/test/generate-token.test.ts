import jsonwebtoken from 'jsonwebtoken';

import { generateToken } from '../src/generate-token';

const VALID_ENV_SECRET = 'a'.repeat(64);
const AUTH_SECRET = 'my-auth-secret';

function createPat(
  overrides: Record<string, unknown> = {},
  expiresIn: number | null = 3600,
): string {
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
    ...overrides,
  };

  if (expiresIn === null) {
    return jsonwebtoken.sign(payload, 'pat-secret');
  }

  return jsonwebtoken.sign(payload, 'pat-secret', { expiresIn });
}

describe('generateToken', () => {
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

    it('should throw if token is not a PAT (missing isApplicationToken)', async () => {
      const token = jsonwebtoken.sign({ foo: 'bar' }, 'secret', { expiresIn: '1h' });

      await expect(
        generateToken({ envSecret: VALID_ENV_SECRET, authSecret: AUTH_SECRET, token }),
      ).rejects.toThrow(
        'Token is not a Forest Admin personal access token (missing isApplicationToken flag).',
      );
    });

    it('should throw if token has expired', async () => {
      const pat = createPat({}, -1);

      await expect(
        generateToken({
          envSecret: VALID_ENV_SECRET,
          authSecret: AUTH_SECRET,
          token: pat,
          renderingId: '99',
        }),
      ).rejects.toThrow('Token has expired. Please generate a new personal access token.');
    });
  });

  describe('PAT user info extraction', () => {
    it('should generate a valid MCP token with correct user info', async () => {
      const pat = createPat();

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

    it('should throw if --rendering-id is missing', async () => {
      const pat = createPat();

      await expect(
        generateToken({
          envSecret: VALID_ENV_SECRET,
          authSecret: AUTH_SECRET,
          token: pat,
        }),
      ).rejects.toThrow('--rendering-id is required.');
    });

    it('should throw if --rendering-id is not a number', async () => {
      const pat = createPat();

      await expect(
        generateToken({
          envSecret: VALID_ENV_SECRET,
          authSecret: AUTH_SECRET,
          token: pat,
          renderingId: 'abc',
        }),
      ).rejects.toThrow('--rendering-id is required.');
    });

    it('should throw if PAT has no email in attributes', async () => {
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

    it('should throw if PAT has no user ID', async () => {
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
  });

  describe('expiration and options', () => {
    it('should respect expiresIn in the generated token', async () => {
      const pat = createPat({}, 7200);

      const { token } = await generateToken({
        envSecret: VALID_ENV_SECRET,
        authSecret: AUTH_SECRET,
        token: pat,
        expiresIn: '2h',
        renderingId: '99',
      });

      const decoded = jsonwebtoken.verify(token, AUTH_SECRET) as { exp: number; iat: number };
      expect(decoded.exp - decoded.iat).toBe(7200);
    });

    it('should default expiresIn to 1h', async () => {
      const pat = createPat();

      const { token } = await generateToken({
        envSecret: VALID_ENV_SECRET,
        authSecret: AUTH_SECRET,
        token: pat,
        renderingId: '99',
      });

      const decoded = jsonwebtoken.verify(token, AUTH_SECRET) as { exp: number; iat: number };
      expect(decoded.exp - decoded.iat).toBe(3600);
    });

    it('should cap expiresIn to 60 days and emit a warning', async () => {
      const pat = createPat({}, 90 * 86400);

      const { token, warnings } = await generateToken({
        envSecret: VALID_ENV_SECRET,
        authSecret: AUTH_SECRET,
        token: pat,
        expiresIn: '90d',
        renderingId: '99',
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
      const pat = createPat({}, 1800);

      const { warnings } = await generateToken({
        envSecret: VALID_ENV_SECRET,
        authSecret: AUTH_SECRET,
        token: pat,
        expiresIn: '2h',
        renderingId: '99',
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
      const pat = createPat();

      const { warnings } = await generateToken({
        envSecret: VALID_ENV_SECRET,
        authSecret: AUTH_SECRET,
        token: pat,
        renderingId: '99',
      });

      expect(warnings).toEqual(
        expect.arrayContaining([
          expect.stringContaining('personal access token is embedded in the generated JWT'),
        ]),
      );
    });

    it('should not warn about PAT lifetime when PAT has no exp claim', async () => {
      const pat = createPat({}, null);

      const { warnings } = await generateToken({
        envSecret: VALID_ENV_SECRET,
        authSecret: AUTH_SECRET,
        token: pat,
        expiresIn: '2h',
        renderingId: '99',
      });

      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('personal access token is embedded');
    });
  });

  describe('expiresIn parsing', () => {
    it('should reject negative expiresIn with unit suffix', async () => {
      const pat = createPat();

      await expect(
        generateToken({
          envSecret: VALID_ENV_SECRET,
          authSecret: AUTH_SECRET,
          token: pat,
          expiresIn: '-5h',
          renderingId: '99',
        }),
      ).rejects.toThrow('Invalid --expires-in value');
    });

    it('should accept seconds notation', async () => {
      const pat = createPat();

      const { token } = await generateToken({
        envSecret: VALID_ENV_SECRET,
        authSecret: AUTH_SECRET,
        token: pat,
        expiresIn: '300s',
        renderingId: '99',
      });

      const decoded = jsonwebtoken.verify(token, AUTH_SECRET) as { exp: number; iat: number };
      expect(decoded.exp - decoded.iat).toBe(300);
    });

    it('should accept minutes notation', async () => {
      const pat = createPat();

      const { token } = await generateToken({
        envSecret: VALID_ENV_SECRET,
        authSecret: AUTH_SECRET,
        token: pat,
        expiresIn: '30m',
        renderingId: '99',
      });

      const decoded = jsonwebtoken.verify(token, AUTH_SECRET) as { exp: number; iat: number };
      expect(decoded.exp - decoded.iat).toBe(1800);
    });

    it('should accept days notation', async () => {
      const pat = createPat({}, 10 * 86400);

      const { token } = await generateToken({
        envSecret: VALID_ENV_SECRET,
        authSecret: AUTH_SECRET,
        token: pat,
        expiresIn: '7d',
        renderingId: '99',
      });

      const decoded = jsonwebtoken.verify(token, AUTH_SECRET) as { exp: number; iat: number };
      expect(decoded.exp - decoded.iat).toBe(7 * 86400);
    });

    it('should accept plain number as seconds', async () => {
      const pat = createPat();

      const { token } = await generateToken({
        envSecret: VALID_ENV_SECRET,
        authSecret: AUTH_SECRET,
        token: pat,
        expiresIn: '600',
        renderingId: '99',
      });

      const decoded = jsonwebtoken.verify(token, AUTH_SECRET) as { exp: number; iat: number };
      expect(decoded.exp - decoded.iat).toBe(600);
    });

    it('should reject invalid expiresIn format', async () => {
      const pat = createPat();

      await expect(
        generateToken({
          envSecret: VALID_ENV_SECRET,
          authSecret: AUTH_SECRET,
          token: pat,
          expiresIn: 'invalid',
          renderingId: '99',
        }),
      ).rejects.toThrow('Invalid --expires-in value');
    });

    it('should reject zero expiresIn', async () => {
      const pat = createPat();

      await expect(
        generateToken({
          envSecret: VALID_ENV_SECRET,
          authSecret: AUTH_SECRET,
          token: pat,
          expiresIn: '0',
          renderingId: '99',
        }),
      ).rejects.toThrow('--expires-in must be a positive duration.');
    });

    it('should reject negative expiresIn', async () => {
      const pat = createPat();

      await expect(
        generateToken({
          envSecret: VALID_ENV_SECRET,
          authSecret: AUTH_SECRET,
          token: pat,
          expiresIn: '-1',
          renderingId: '99',
        }),
      ).rejects.toThrow('--expires-in must be a positive duration.');
    });

    it('should reject zero duration with unit', async () => {
      const pat = createPat();

      await expect(
        generateToken({
          envSecret: VALID_ENV_SECRET,
          authSecret: AUTH_SECRET,
          token: pat,
          expiresIn: '0h',
          renderingId: '99',
        }),
      ).rejects.toThrow('--expires-in must be a positive duration.');
    });
  });
});

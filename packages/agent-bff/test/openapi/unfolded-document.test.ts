import jsonwebtoken from 'jsonwebtoken';

import { issueOpenApiAgentToken } from '../../src/openapi/unfolded-document';

describe('issueOpenApiAgentToken', () => {
  const AUTH_SECRET = 'auth-secret';

  function decode(token: string): Record<string, unknown> {
    return jsonwebtoken.verify(token, AUTH_SECRET) as Record<string, unknown>;
  }

  it('should sign a token the agent accepts, since the signature is all it verifies', () => {
    expect(() => decode(issueOpenApiAgentToken(AUTH_SECRET))).not.toThrow();
  });

  it('should reject verification under another secret, so the token is not portable', () => {
    expect(() => jsonwebtoken.verify(issueOpenApiAgentToken(AUTH_SECRET), 'other')).toThrow();
  });

  it('should carry an inert identity, since it never reads or writes a record', () => {
    expect(decode(issueOpenApiAgentToken(AUTH_SECRET))).toEqual(
      expect.objectContaining({
        id: 0,
        email: 'openapi@agent-bff.forestadmin.com',
        renderingId: 0,
        team: 'Operations',
      }),
    );
  });

  it('should carry the snake_case aliases the Ruby and Python agents read', () => {
    expect(decode(issueOpenApiAgentToken(AUTH_SECRET))).toEqual(
      expect.objectContaining({
        first_name: 'Forest',
        last_name: 'BFF',
        rendering_id: 0,
        permission_level: 'admin',
      }),
    );
  });

  it('should expire, so a leaked export token is not a lasting credential', () => {
    const { exp, iat } = decode(issueOpenApiAgentToken(AUTH_SECRET)) as {
      exp: number;
      iat: number;
    };

    expect(exp - iat).toBe(5 * 60);
  });
});

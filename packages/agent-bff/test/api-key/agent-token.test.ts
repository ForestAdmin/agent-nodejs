import type { ResolvedApiKeyIdentity } from '../../src/api-key/api-key-client';
import type { BffAccessTokenPayload } from '../../src/oauth/bff-token';

import jsonwebtoken from 'jsonwebtoken';

import { issueAgentToken, issueAgentTokenFromPrincipal } from '../../src/api-key/agent-token';

const AUTH_SECRET = 'auth-secret';

const PRINCIPAL: BffAccessTokenPayload = {
  type: 'bff_access',
  sid: 'session-1',
  id: 42,
  email: 'ada@example.com',
  first_name: 'Ada',
  last_name: 'Lovelace',
  team: 'Support',
  rendering_id: '17',
  permission_level: 'admin',
  role: 'Support agent',
  tags: { region: 'eu' },
};

const IDENTITY: ResolvedApiKeyIdentity = {
  user: {
    id: 42,
    email: 'ada@example.com',
    firstName: 'Ada',
    lastName: 'Lovelace',
    team: 'Support',
    tags: [{ key: 'region', value: 'eu' }],
    permissionLevel: 'admin',
  },
  renderingId: 17,
  allowedOrigins: [],
};

describe('issueAgentToken', () => {
  it('should mint a JWT verifiable with the auth secret', () => {
    const token = issueAgentToken({ identity: IDENTITY, authSecret: AUTH_SECRET });

    expect(() => jsonwebtoken.verify(token, AUTH_SECRET)).not.toThrow();
  });

  it('should expire 5 minutes after issuance', () => {
    const token = issueAgentToken({ identity: IDENTITY, authSecret: AUTH_SECRET });
    const decoded = jsonwebtoken.decode(token) as { iat: number; exp: number };

    expect(decoded.exp - decoded.iat).toBe(300);
  });

  it('should include camelCase Caller claims from the resolved identity', () => {
    const token = issueAgentToken({ identity: IDENTITY, authSecret: AUTH_SECRET });

    expect(jsonwebtoken.verify(token, AUTH_SECRET)).toMatchObject({
      id: 42,
      email: 'ada@example.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
      team: 'Support',
      renderingId: 17,
      permissionLevel: 'admin',
      tags: { region: 'eu' },
    });
  });

  it('should include snake_case aliases for non-Node agents', () => {
    const token = issueAgentToken({ identity: IDENTITY, authSecret: AUTH_SECRET });

    expect(jsonwebtoken.verify(token, AUTH_SECRET)).toMatchObject({
      first_name: 'Ada',
      last_name: 'Lovelace',
      rendering_id: 17,
      permission_level: 'admin',
    });
  });

  it('should coerce null first/last name to empty strings', () => {
    const token = issueAgentToken({
      identity: { ...IDENTITY, user: { ...IDENTITY.user, firstName: null, lastName: null } },
      authSecret: AUTH_SECRET,
    });

    expect(jsonwebtoken.verify(token, AUTH_SECRET)).toMatchObject({
      firstName: '',
      lastName: '',
      first_name: '',
      last_name: '',
    });
  });
});

describe('issueAgentTokenFromPrincipal', () => {
  it('should expire 5 minutes after issuance, like the api-key path', () => {
    const token = issueAgentTokenFromPrincipal({ principal: PRINCIPAL, authSecret: AUTH_SECRET });
    const decoded = jsonwebtoken.decode(token) as { iat: number; exp: number };

    expect(decoded.exp - decoded.iat).toBe(300);
  });

  it('should send rendering_id as a number, since Caller.renderingId is numeric', () => {
    const token = issueAgentTokenFromPrincipal({ principal: PRINCIPAL, authSecret: AUTH_SECRET });

    expect(jsonwebtoken.verify(token, AUTH_SECRET)).toMatchObject({
      renderingId: 17,
      rendering_id: 17,
    });
  });

  it('should emit the api-key claims plus the OAuth role', () => {
    const fromKey = jsonwebtoken.verify(
      issueAgentToken({ identity: IDENTITY, authSecret: AUTH_SECRET }),
      AUTH_SECRET,
    ) as Record<string, unknown>;
    const fromPrincipal = jsonwebtoken.verify(
      issueAgentTokenFromPrincipal({ principal: PRINCIPAL, authSecret: AUTH_SECRET }),
      AUTH_SECRET,
    ) as Record<string, unknown>;

    const claimNames = (claims: Record<string, unknown>) =>
      Object.keys(claims)
        .filter(name => name !== 'iat' && name !== 'exp')
        .sort();

    expect(claimNames(fromPrincipal)).toEqual([...claimNames(fromKey), 'role'].sort());
    expect(fromPrincipal.role).toBe('Support agent');
  });

  it('should never forward the session-only type and sid claims', () => {
    const claims = jsonwebtoken.verify(
      issueAgentTokenFromPrincipal({ principal: PRINCIPAL, authSecret: AUTH_SECRET }),
      AUTH_SECRET,
    ) as Record<string, unknown>;

    expect(claims.type).toBeUndefined();
    expect(claims.sid).toBeUndefined();
  });

  it('should fail closed when rendering_id is not a usable integer', () => {
    expect(() =>
      issueAgentTokenFromPrincipal({
        principal: { ...PRINCIPAL, rendering_id: 'not-a-number' },
        authSecret: AUTH_SECRET,
      }),
    ).toThrow(expect.objectContaining({ status: 401, type: 'unauthorized' }));
  });

  it('should coerce missing names and tags rather than emitting undefined', () => {
    const token = issueAgentTokenFromPrincipal({
      principal: {
        ...PRINCIPAL,
        first_name: undefined as unknown as string,
        last_name: undefined as unknown as string,
        tags: undefined as unknown as Record<string, string>,
      },
      authSecret: AUTH_SECRET,
    });

    expect(jsonwebtoken.verify(token, AUTH_SECRET)).toMatchObject({
      firstName: '',
      lastName: '',
      first_name: '',
      last_name: '',
      tags: {},
    });
  });
});

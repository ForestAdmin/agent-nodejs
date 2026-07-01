import type { ResolvedApiKeyIdentity } from '../../src/api-key/api-key-client';

import jsonwebtoken from 'jsonwebtoken';

import { issueAgentToken } from '../../src/api-key/agent-token';

const AUTH_SECRET = 'auth-secret';

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

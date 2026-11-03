import type { BffAccessTokenPayload } from '../../src/oauth/bff-token';

import jsonwebtoken from 'jsonwebtoken';

import resolveServerAccess from '../../src/oauth/server-access';
import createSessionTokenCodec from '../../src/oauth/session-token';
import createTokenCipher from '../../src/oauth/token-cipher';

const sessionTokens = createSessionTokenCodec(
  createTokenCipher(Buffer.alloc(32, 3).toString('base64')),
  { now: () => Date.now(), sessionTtlSeconds: 3600, logger: () => undefined },
);

const BINDING = { sid: 'sid-1', userId: 42, renderingId: 17 };

function saasAccessToken(expSecondsFromNow: number): string {
  return jsonwebtoken.sign(
    { exp: Math.floor(Date.now() / 1000) + expSecondsFromNow },
    'irrelevant',
  );
}

function principalOf(serverAccess: string | undefined): BffAccessTokenPayload {
  return {
    type: 'bff_access',
    sid: BINDING.sid,
    server_access: serverAccess,
    id: BINDING.userId,
    email: 'jane@example.com',
    first_name: 'Jane',
    last_name: 'Doe',
    team: 'Ops',
    rendering_id: String(BINDING.renderingId),
    permission_level: 'admin',
    tags: {},
  };
}

describe('resolveServerAccess', () => {
  it('should return the Forest server access sealed for this principal', () => {
    const token = saasAccessToken(600);
    const principal = principalOf(sessionTokens.sealServerAccess(BINDING, token));

    expect(resolveServerAccess(principal, sessionTokens)).toBe(token);
  });

  it('should refuse with session_expired when the principal carries no server access', () => {
    expect(() => resolveServerAccess(principalOf(undefined), sessionTokens)).toThrow(
      expect.objectContaining({ status: 401, type: 'session_expired' }),
    );
  });

  it('should refuse a server access sealed for another user', () => {
    const sealed = sessionTokens.sealServerAccess({ ...BINDING, userId: 99 }, saasAccessToken(600));

    expect(() => resolveServerAccess(principalOf(sealed), sessionTokens)).toThrow(
      expect.objectContaining({ status: 401, type: 'session_expired' }),
    );
  });

  it('should accept an opaque server access, whose lifetime the access token already bounds', () => {
    const principal = principalOf(sessionTokens.sealServerAccess(BINDING, 'opaque-access'));

    expect(resolveServerAccess(principal, sessionTokens)).toBe('opaque-access');
  });

  it('should refuse with session_expired when the sealed access expired', () => {
    const principal = principalOf(sessionTokens.sealServerAccess(BINDING, saasAccessToken(-1)));

    expect(() => resolveServerAccess(principal, sessionTokens)).toThrow(
      expect.objectContaining({ status: 401, type: 'session_expired' }),
    );
  });
});

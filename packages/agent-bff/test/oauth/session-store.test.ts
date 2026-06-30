import type { TokenCipher } from '../../src/oauth/token-cipher';

import createInMemorySessionStore from '../../src/oauth/session-store';
import createTokenCipher from '../../src/oauth/token-cipher';

const KEY = Buffer.alloc(32, 3).toString('base64');

function buildStore(cipher: TokenCipher = createTokenCipher(KEY), now = () => 1_000_000) {
  return createInMemorySessionStore({ cipher, now, sessionTtlSeconds: 3600 });
}

const SESSION_INPUT = {
  saasAccessToken: 'SAAS-ACCESS-SENTINEL',
  saasRefreshToken: 'SAAS-REFRESH-SENTINEL',
  renderingId: 17,
  userId: 42,
};

describe('session-store', () => {
  describe('when creating a session', () => {
    it('should return a sid and the raw opaque refresh token once', () => {
      const store = buildStore();

      const { sid, refreshToken } = store.create(SESSION_INPUT);

      expect(typeof sid).toBe('string');
      expect(refreshToken.length).toBeGreaterThanOrEqual(32);
      expect(store.get(sid)?.userId).toBe(42);
    });

    it('should never persist the raw opaque refresh token (hash only)', () => {
      const store = buildStore();

      const { sid, refreshToken } = store.create(SESSION_INPUT);
      const stored = store.get(sid);

      expect(JSON.stringify(stored)).not.toContain(refreshToken);
    });

    it('should encrypt the SaaS refresh token at rest (blob, not plaintext)', () => {
      const store = buildStore();

      const { sid } = store.create(SESSION_INPUT);
      const stored = store.get(sid);

      expect(JSON.stringify(stored)).not.toContain('SAAS-REFRESH-SENTINEL');
    });

    it('should expose the decrypted SaaS refresh token via getSaasRefreshToken', () => {
      const store = buildStore();

      const { sid } = store.create(SESSION_INPUT);

      expect(store.getSaasRefreshToken(sid)).toBe('SAAS-REFRESH-SENTINEL');
    });
  });

  describe('when claiming an authorization code', () => {
    it('should return true the first time and false on replay', () => {
      const store = buildStore();

      expect(store.claimAuthorizationCode('code-1')).toBe(true);
      expect(store.claimAuthorizationCode('code-1')).toBe(false);
    });

    it('should claim distinct codes independently', () => {
      const store = buildStore();

      expect(store.claimAuthorizationCode('code-a')).toBe(true);
      expect(store.claimAuthorizationCode('code-b')).toBe(true);
    });

    it('should reject new claims at the cap without evicting live entries (replay guard)', () => {
      let clock = 1_000_000;
      const store = createInMemorySessionStore({
        cipher: createTokenCipher(KEY),
        now: () => clock,
        sessionTtlSeconds: 3600,
        authCodeTtlSeconds: 60,
        maxPendingCodes: 2,
      });

      expect(store.claimAuthorizationCode('c1')).toBe(true);
      clock += 1;
      expect(store.claimAuthorizationCode('c2')).toBe(true);
      clock += 1;
      expect(store.claimAuthorizationCode('c3')).toBe(false);

      expect(store.claimAuthorizationCode('c1')).toBe(false);
      expect(store.claimAuthorizationCode('c2')).toBe(false);
    });

    it('should reject every claim when maxPendingCodes is 0 (strict zero cap)', () => {
      const store = createInMemorySessionStore({
        cipher: createTokenCipher(KEY),
        now: () => 1_000_000,
        sessionTtlSeconds: 3600,
        maxPendingCodes: 0,
      });

      expect(store.claimAuthorizationCode('c1')).toBe(false);
      expect(store.pendingClaimCount()).toBe(0);
    });

    it('should free a slot once a capped claim expires, accepting a new code', () => {
      let clock = 1_000_000;
      const store = createInMemorySessionStore({
        cipher: createTokenCipher(KEY),
        now: () => clock,
        sessionTtlSeconds: 3600,
        authCodeTtlSeconds: 60,
        maxPendingCodes: 2,
      });

      expect(store.claimAuthorizationCode('c1')).toBe(true);
      expect(store.claimAuthorizationCode('c2')).toBe(true);
      expect(store.claimAuthorizationCode('c3')).toBe(false);

      clock += 60 * 1000;
      expect(store.claimAuthorizationCode('c3')).toBe(true);
    });

    it('should drop a claimed code after its TTL so the store does not grow unbounded', () => {
      let clock = 1_000_000;
      const store = createInMemorySessionStore({
        cipher: createTokenCipher(KEY),
        now: () => clock,
        sessionTtlSeconds: 3600,
        authCodeTtlSeconds: 60,
      });

      expect(store.claimAuthorizationCode('code-x')).toBe(true);
      expect(store.claimAuthorizationCode('code-x')).toBe(false);

      clock += 61 * 1000;

      expect(store.pendingClaimCount()).toBe(0);
    });
  });

  describe('when a session has a TTL', () => {
    it('should not return an expired session', () => {
      let clock = 1_000_000;
      const store = createInMemorySessionStore({
        cipher: createTokenCipher(KEY),
        now: () => clock,
        sessionTtlSeconds: 60,
      });

      const { sid } = store.create(SESSION_INPUT);
      expect(store.get(sid)).toBeDefined();

      clock += 61 * 1000;
      expect(store.get(sid)).toBeUndefined();
    });
  });

  describe('when creating a session after older sessions have expired', () => {
    it('should purge the expired session during create', () => {
      let clock = 1_000_000;
      const store = createInMemorySessionStore({
        cipher: createTokenCipher(KEY),
        now: () => clock,
        sessionTtlSeconds: 60,
      });

      const { sid: firstSid } = store.create(SESSION_INPUT);

      clock += 61 * 1000;
      const { sid: secondSid } = store.create(SESSION_INPUT);

      expect(store.get(firstSid)).toBeUndefined();
      expect(store.get(secondSid)).toBeDefined();
    });
  });

  describe('when updating the stored SaaS tokens after a refresh', () => {
    it('should persist the rotated tokens and re-encrypt the new refresh', () => {
      const store = buildStore();
      const { sid } = store.create(SESSION_INPUT);

      store.updateSaasTokens(sid, {
        saasAccessToken: 'NEW-ACCESS',
        saasRefreshToken: 'NEW-REFRESH',
      });

      expect(store.get(sid)?.saasAccessToken).toBe('NEW-ACCESS');
      expect(store.getSaasRefreshToken(sid)).toBe('NEW-REFRESH');
      expect(JSON.stringify(store.get(sid))).not.toContain('NEW-REFRESH');
    });
  });

  function rotate(store: ReturnType<typeof buildStore>, presented: string) {
    const prepared = store.prepareRotation(presented);
    if (prepared.outcome !== 'ready') return prepared;

    store.commitRotation(presented, prepared.newRefreshToken);

    return prepared;
  }

  describe('when preparing a rotation for a valid refresh token', () => {
    it('should return a fresh opaque token distinct from the presented one for the same session', () => {
      const store = buildStore();
      const { sid, refreshToken } = store.create(SESSION_INPUT);

      const result = store.prepareRotation(refreshToken);

      expect(result.outcome).toBe('ready');
      if (result.outcome !== 'ready') throw new Error('unreachable');
      expect(result.sid).toBe(sid);
      expect(result.newRefreshToken).not.toBe(refreshToken);
      expect(result.newRefreshToken.length).toBeGreaterThanOrEqual(32);
    });

    it('should not mutate the store: the presented token stays valid until commit', () => {
      const store = buildStore();
      const { refreshToken } = store.create(SESSION_INPUT);

      store.prepareRotation(refreshToken);
      store.prepareRotation(refreshToken);

      expect(store.prepareRotation(refreshToken).outcome).toBe('ready');
    });
  });

  describe('when committing a prepared rotation', () => {
    it('should accept the new token and flag the old one as reuse afterwards', () => {
      const store = buildStore();
      const { refreshToken } = store.create(SESSION_INPUT);

      const first = rotate(store, refreshToken);
      if (first.outcome !== 'ready') throw new Error('unreachable');

      expect(store.prepareRotation(refreshToken).outcome).toBe('reuse');
      expect(store.prepareRotation(first.newRefreshToken).outcome).toBe('ready');
    });

    it('should never persist the raw rotated token (hash only)', () => {
      const store = buildStore();
      const { sid, refreshToken } = store.create(SESSION_INPUT);

      const result = rotate(store, refreshToken);
      if (result.outcome !== 'ready') throw new Error('unreachable');

      expect(JSON.stringify(store.get(sid))).not.toContain(result.newRefreshToken);
    });

    it('should return false when committing a token the store no longer tracks as active', () => {
      const store = buildStore();
      const { refreshToken } = store.create(SESSION_INPUT);

      const prepared = store.prepareRotation(refreshToken);
      if (prepared.outcome !== 'ready') throw new Error('unreachable');

      store.commitRotation(refreshToken, prepared.newRefreshToken);

      expect(store.commitRotation(refreshToken, prepared.newRefreshToken)).toBe(false);
    });

    it('should return false when the session expires between prepare and commit', () => {
      let clock = 1_000_000;
      const store = createInMemorySessionStore({
        cipher: createTokenCipher(KEY),
        now: () => clock,
        sessionTtlSeconds: 60,
      });
      const { refreshToken } = store.create(SESSION_INPUT);

      const prepared = store.prepareRotation(refreshToken);
      if (prepared.outcome !== 'ready') throw new Error('unreachable');

      clock += 61 * 1000;

      expect(store.commitRotation(refreshToken, prepared.newRefreshToken)).toBe(false);
    });
  });

  describe('when an unknown refresh token is presented', () => {
    it('should return unknown for a token that was never issued', () => {
      const store = buildStore();
      store.create(SESSION_INPUT);

      expect(store.prepareRotation('never-issued-token').outcome).toBe('unknown');
    });
  });

  describe('when a rotated-out refresh token is replayed', () => {
    it('should flag reuse only after a committed rotation, identifying the session', () => {
      const store = buildStore();
      const { sid, refreshToken } = store.create(SESSION_INPUT);

      rotate(store, refreshToken);
      const reuse = store.prepareRotation(refreshToken);

      expect(reuse.outcome).toBe('reuse');
      if (reuse.outcome !== 'reuse') throw new Error('unreachable');
      expect(reuse.sid).toBe(sid);
    });

    it('should only retain the most recently rotated-out token for reuse detection', () => {
      const store = buildStore();
      const { refreshToken } = store.create(SESSION_INPUT);

      const r1 = refreshToken;
      const first = rotate(store, r1);
      if (first.outcome !== 'ready') throw new Error('unreachable');
      const r2 = first.newRefreshToken;
      rotate(store, r2);

      expect(store.prepareRotation(r2).outcome).toBe('reuse');
      expect(store.prepareRotation(r1).outcome).toBe('unknown');
    });

    it('should treat a replay against an expired session as unknown, not reuse', () => {
      let clock = 1_000_000;
      const store = createInMemorySessionStore({
        cipher: createTokenCipher(KEY),
        now: () => clock,
        sessionTtlSeconds: 60,
      });
      const { refreshToken } = store.create(SESSION_INPUT);

      rotate(store, refreshToken);
      clock += 61 * 1000;

      expect(store.prepareRotation(refreshToken).outcome).toBe('unknown');
    });
  });

  describe('when destroying a session', () => {
    it('should remove the session and reject its current refresh token as unknown', () => {
      const store = buildStore();
      const { sid, refreshToken } = store.create(SESSION_INPUT);

      store.destroy(sid);

      expect(store.get(sid)).toBeUndefined();
      expect(store.prepareRotation(refreshToken).outcome).toBe('unknown');
    });

    it('should drop a rotated-out token after destroy so a later replay is no longer flagged as reuse', () => {
      const store = buildStore();
      const { sid, refreshToken } = store.create(SESSION_INPUT);

      rotate(store, refreshToken);
      store.destroy(sid);

      expect(store.prepareRotation(refreshToken).outcome).toBe('unknown');
    });
  });

  describe('when a session expires', () => {
    it('should reject a rotation against the expired session as unknown', () => {
      let clock = 1_000_000;
      const store = createInMemorySessionStore({
        cipher: createTokenCipher(KEY),
        now: () => clock,
        sessionTtlSeconds: 60,
      });
      const { refreshToken } = store.create(SESSION_INPUT);

      clock += 61 * 1000;

      expect(store.prepareRotation(refreshToken).outcome).toBe('unknown');
    });
  });
});

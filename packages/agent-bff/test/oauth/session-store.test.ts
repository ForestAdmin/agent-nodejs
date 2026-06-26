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

    it('should reject a new claim once the pending-claim cap is reached (DoS guard)', () => {
      const store = createInMemorySessionStore({
        cipher: createTokenCipher(KEY),
        now: () => 1_000_000,
        sessionTtlSeconds: 3600,
        maxPendingCodes: 2,
      });

      expect(store.claimAuthorizationCode('c1')).toBe(true);
      expect(store.claimAuthorizationCode('c2')).toBe(true);
      expect(store.claimAuthorizationCode('c3')).toBe(false);
    });

    it('should accept a new claim again after expired claims free up capacity', () => {
      let clock = 1_000_000;
      const store = createInMemorySessionStore({
        cipher: createTokenCipher(KEY),
        now: () => clock,
        sessionTtlSeconds: 3600,
        authCodeTtlSeconds: 60,
        maxPendingCodes: 1,
      });

      expect(store.claimAuthorizationCode('c1')).toBe(true);
      expect(store.claimAuthorizationCode('c2')).toBe(false);

      clock += 61 * 1000;

      expect(store.claimAuthorizationCode('c2')).toBe(true);
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
});

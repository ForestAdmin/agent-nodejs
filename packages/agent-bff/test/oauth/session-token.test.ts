import type { SessionState } from '../../src/oauth/session-token';

import createSessionTokenCodec, { createSid } from '../../src/oauth/session-token';
import createTokenCipher from '../../src/oauth/token-cipher';

const KEY = Buffer.alloc(32, 3).toString('base64');
const OTHER_KEY = Buffer.alloc(32, 4).toString('base64');
const NOW = 1_000_000;

const STATE: SessionState = {
  sid: 'sid-1',
  saasRefreshToken: 'SAAS-REFRESH-SENTINEL',
  renderingId: 17,
  userId: 42,
  clientId: 'client-1',
  expiresAt: NOW + 3600 * 1000,
};

const BINDING = { sid: 'sid-1', userId: 42, renderingId: 17 };

function codec(key = KEY, now = () => NOW) {
  return createSessionTokenCodec(createTokenCipher(key), now);
}

function flipLastCiphertextChar(token: string): string {
  const blob = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
  const last = blob.ciphertext.at(-2) === 'A' ? 'B' : 'A';
  blob.ciphertext = `${blob.ciphertext.slice(0, -2)}${last}${blob.ciphertext.at(-1)}`;

  return Buffer.from(JSON.stringify(blob)).toString('base64url');
}

describe('session token codec', () => {
  describe('refresh token', () => {
    it('should open what it sealed, on another codec sharing the key', () => {
      const token = codec().sealRefreshToken(STATE);

      expect(codec().openRefreshToken(token)).toEqual(STATE);
    });

    it('should never expose the Forest server refresh token in clear', () => {
      const token = codec().sealRefreshToken(STATE);

      expect(Buffer.from(token, 'base64url').toString('utf8')).not.toContain(
        STATE.saasRefreshToken,
      );
    });

    it('should seal the same state into distinct tokens', () => {
      expect(codec().sealRefreshToken(STATE)).not.toBe(codec().sealRefreshToken(STATE));
    });

    it('should reject a token sealed with another key', () => {
      const token = codec(OTHER_KEY).sealRefreshToken(STATE);

      expect(codec().openRefreshToken(token)).toBeUndefined();
    });

    it('should reject a tampered token', () => {
      const token = codec().sealRefreshToken(STATE);

      expect(codec().openRefreshToken(flipLastCiphertextChar(token))).toBeUndefined();
    });

    it.each(['', 'garbage', Buffer.from('{"iv":1}').toString('base64url')])(
      'should reject the malformed token %p',
      token => {
        expect(codec().openRefreshToken(token)).toBeUndefined();
      },
    );

    it('should reject a sealed server access presented as a refresh token', () => {
      const sealed = codec().sealServerAccess(BINDING, 'SAAS-ACCESS');

      expect(codec().openRefreshToken(sealed)).toBeUndefined();
    });

    it('should reject a state missing a field', () => {
      const { clientId, ...partial } = STATE;
      const token = codec().sealRefreshToken(partial as SessionState);

      expect(clientId).toBe('client-1');
      expect(codec().openRefreshToken(token)).toBeUndefined();
    });

    it('should accept a token until its session expires, then reject it', () => {
      const token = codec().sealRefreshToken(STATE);

      expect(codec(KEY, () => STATE.expiresAt - 1).openRefreshToken(token)).toEqual(STATE);
      expect(codec(KEY, () => STATE.expiresAt).openRefreshToken(token)).toBeUndefined();
    });
  });

  describe('server access', () => {
    it('should open what it sealed for the same binding', () => {
      const sealed = codec().sealServerAccess(BINDING, 'SAAS-ACCESS');

      expect(codec().openServerAccess(sealed, BINDING)).toBe('SAAS-ACCESS');
    });

    it.each([
      ['sid', { ...BINDING, sid: 'sid-2' }],
      ['user', { ...BINDING, userId: 43 }],
      ['rendering', { ...BINDING, renderingId: 18 }],
    ])('should reject it under another %s', (_, binding) => {
      const sealed = codec().sealServerAccess(BINDING, 'SAAS-ACCESS');

      expect(codec().openServerAccess(sealed, binding)).toBeUndefined();
    });

    it('should reject a refresh token presented as a server access', () => {
      const token = codec().sealRefreshToken(STATE);

      expect(codec().openServerAccess(token, BINDING)).toBeUndefined();
    });

    it('should reject a server access sealed with another key', () => {
      const sealed = codec(OTHER_KEY).sealServerAccess(BINDING, 'SAAS-ACCESS');

      expect(codec().openServerAccess(sealed, BINDING)).toBeUndefined();
    });
  });

  it('should create distinct url-safe session ids', () => {
    const sid = createSid();

    expect(sid).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(createSid()).not.toBe(sid);
  });
});

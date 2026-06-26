import crypto from 'crypto';

import { challengeFromVerifier, createPkcePair, createVerifier } from '../../src/oauth/pkce';

describe('pkce', () => {
  describe('when creating a verifier', () => {
    it('should produce a url-safe string with no padding', () => {
      const verifier = createVerifier();

      expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('should produce a different verifier on each call', () => {
      expect(createVerifier()).not.toEqual(createVerifier());
    });
  });

  describe('when deriving the challenge from a verifier', () => {
    it('should equal base64url(sha256(verifier))', () => {
      const verifier = createVerifier();
      const expected = crypto.createHash('sha256').update(verifier).digest('base64url');

      expect(challengeFromVerifier(verifier)).toEqual(expected);
    });

    it('should round-trip a generated pair so the challenge matches the verifier', () => {
      const pair = createPkcePair();

      expect(challengeFromVerifier(pair.codeVerifier)).toEqual(pair.codeChallenge);
    });
  });
});

import createAuthorizationCodeClaims from '../../src/oauth/authorization-code-claims';

describe('authorization code claims', () => {
  it('should return true the first time and false on replay', () => {
    const claims = createAuthorizationCodeClaims({ now: () => 1_000_000 });

    expect(claims.claim('code-1')).toBe(true);
    expect(claims.claim('code-1')).toBe(false);
  });

  it('should claim distinct codes independently', () => {
    const claims = createAuthorizationCodeClaims({ now: () => 1_000_000 });

    expect(claims.claim('code-a')).toBe(true);
    expect(claims.claim('code-b')).toBe(true);
  });

  it('should accept a released code again', () => {
    const claims = createAuthorizationCodeClaims({ now: () => 1_000_000 });

    claims.claim('code-1');
    claims.release('code-1');

    expect(claims.claim('code-1')).toBe(true);
  });

  it('should reject new claims at the cap without evicting live entries (replay guard)', () => {
    let clock = 1_000_000;
    const claims = createAuthorizationCodeClaims({
      now: () => clock,
      ttlSeconds: 60,
      maxPending: 2,
    });

    expect(claims.claim('c1')).toBe(true);
    clock += 1;
    expect(claims.claim('c2')).toBe(true);
    clock += 1;
    expect(claims.claim('c3')).toBe(false);

    expect(claims.claim('c1')).toBe(false);
    expect(claims.claim('c2')).toBe(false);
  });

  it('should reject every claim when maxPending is 0 (strict zero cap)', () => {
    const claims = createAuthorizationCodeClaims({ now: () => 1_000_000, maxPending: 0 });

    expect(claims.claim('c1')).toBe(false);
  });

  it('should free a slot once a capped claim expires, accepting a new code', () => {
    let clock = 1_000_000;
    const claims = createAuthorizationCodeClaims({
      now: () => clock,
      ttlSeconds: 60,
      maxPending: 2,
    });

    expect(claims.claim('c1')).toBe(true);
    expect(claims.claim('c2')).toBe(true);
    expect(claims.claim('c3')).toBe(false);

    clock += 60 * 1000;
    expect(claims.claim('c3')).toBe(true);
  });

  it('should accept a claimed code again once its TTL elapsed', () => {
    let clock = 1_000_000;
    const claims = createAuthorizationCodeClaims({ now: () => clock, ttlSeconds: 60 });

    expect(claims.claim('code-x')).toBe(true);
    clock += 59 * 1000;
    expect(claims.claim('code-x')).toBe(false);

    clock += 2 * 1000;
    expect(claims.claim('code-x')).toBe(true);
  });
});

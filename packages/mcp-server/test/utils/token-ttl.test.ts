import normalizeTokenTtl, {
  MIN_TOKEN_TTL_SECONDS,
  capAccessTokenTtl,
  capRefreshTokenTtl,
} from '../../src/utils/token-ttl';

describe('normalizeTokenTtl', () => {
  let logger: jest.Mock;

  beforeEach(() => {
    logger = jest.fn();
  });

  it.each([undefined, {}])('returns undefined for %p so nothing is capped', input => {
    expect(normalizeTokenTtl(input, logger)).toBeUndefined();
    expect(logger).not.toHaveBeenCalled();
  });

  it('returns valid values unchanged', () => {
    expect(
      normalizeTokenTtl({ accessTokenSeconds: 900, refreshTokenSeconds: 86400 }, logger),
    ).toEqual({ accessTokenSeconds: 900, refreshTokenSeconds: 86400 });
    expect(logger).not.toHaveBeenCalled();
  });

  it('accepts a value far above the Forest lifetime, which the cap neutralizes', () => {
    expect(normalizeTokenTtl({ accessTokenSeconds: 1e12 }, logger)).toEqual({
      accessTokenSeconds: 1e12,
      refreshTokenSeconds: undefined,
    });
    expect(logger).not.toHaveBeenCalled();
  });

  it.each([0, -1, -3600, 3600.5, NaN, Infinity, -Infinity, '900' as unknown as number, null])(
    'throws for accessTokenSeconds %p',
    value => {
      expect(() => normalizeTokenTtl({ accessTokenSeconds: value }, logger)).toThrow(
        /Invalid tokenTtl\.accessTokenSeconds/,
      );
    },
  );

  it.each([0, -1, -3600, 3600.5, NaN, Infinity, -Infinity, '900' as unknown as number, null])(
    'throws for refreshTokenSeconds %p',
    value => {
      expect(() => normalizeTokenTtl({ refreshTokenSeconds: value }, logger)).toThrow(
        /Invalid tokenTtl\.refreshTokenSeconds/,
      );
    },
  );

  it('clamps a value below the minimum and warns', () => {
    expect(normalizeTokenTtl({ accessTokenSeconds: 30 }, logger)).toEqual({
      accessTokenSeconds: MIN_TOKEN_TTL_SECONDS,
      refreshTokenSeconds: undefined,
    });
    expect(logger).toHaveBeenCalledWith(
      'Warn',
      `ignoring tokenTtl.accessTokenSeconds: minimum value is ${MIN_TOKEN_TTL_SECONDS} seconds`,
    );
  });

  it('clamps at the boundary but leaves the minimum itself alone', () => {
    expect(normalizeTokenTtl({ accessTokenSeconds: 59 }, logger)?.accessTokenSeconds).toBe(60);
    expect(normalizeTokenTtl({ accessTokenSeconds: 60 }, logger)?.accessTokenSeconds).toBe(60);
    expect(logger).toHaveBeenCalledTimes(1);
  });
});

describe('capAccessTokenTtl', () => {
  it('returns the Forest lifetime when no cap is configured', () => {
    expect(capAccessTokenTtl(3600)).toBe(3600);
  });

  it('shortens the lifetime to the cap', () => {
    expect(capAccessTokenTtl(3600, 900)).toBe(900);
  });

  it('never extends beyond the Forest lifetime', () => {
    expect(capAccessTokenTtl(900, 3600)).toBe(900);
  });

  it.each([0, -5])('does not rescue an already-expired Forest lifetime of %p', upstream => {
    expect(capAccessTokenTtl(upstream, 900)).toBe(upstream);
  });
});

describe('capRefreshTokenTtl', () => {
  const nowInSeconds = 1_000_000;

  it('returns the Forest lifetime when no cap is configured', () => {
    expect(
      capRefreshTokenTtl({
        upstreamTtlSeconds: 604800,
        sessionStartedAt: nowInSeconds,
        nowInSeconds,
      }),
    ).toBe(604800);
  });

  it('grants the full cap at the start of the session', () => {
    expect(
      capRefreshTokenTtl({
        upstreamTtlSeconds: 604800,
        capSeconds: 86400,
        sessionStartedAt: nowInSeconds,
        nowInSeconds,
      }),
    ).toBe(86400);
  });

  it('shrinks as the session ages instead of sliding', () => {
    expect(
      capRefreshTokenTtl({
        upstreamTtlSeconds: 604800,
        capSeconds: 86400,
        sessionStartedAt: nowInSeconds - 80000,
        nowInSeconds,
      }),
    ).toBe(6400);
  });

  it('never extends beyond the Forest lifetime', () => {
    expect(
      capRefreshTokenTtl({
        upstreamTtlSeconds: 3600,
        capSeconds: 86400,
        sessionStartedAt: nowInSeconds,
        nowInSeconds,
      }),
    ).toBe(3600);
  });
});

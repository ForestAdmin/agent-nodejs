import normalizeTokenTtl, {
  MIN_TOKEN_TTL_SECONDS,
  capTtl,
  sessionRemainingSeconds,
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
      `raising tokenTtl.accessTokenSeconds from 30 to the ${MIN_TOKEN_TTL_SECONDS}s minimum`,
    );
  });

  it('warns when the session is shorter than one access token, the classic swap', () => {
    expect(
      normalizeTokenTtl({ accessTokenSeconds: 3600, refreshTokenSeconds: 60 }, logger),
    ).toEqual({ accessTokenSeconds: 3600, refreshTokenSeconds: 60 });
    expect(logger).toHaveBeenCalledWith('Warn', expect.stringContaining('Did you swap the two'));
  });

  it('stays silent when the session is longer than the access token', () => {
    normalizeTokenTtl({ accessTokenSeconds: 900, refreshTokenSeconds: 86400 }, logger);
    expect(logger).not.toHaveBeenCalled();
  });

  it('clamps at the boundary but leaves the minimum itself alone', () => {
    expect(normalizeTokenTtl({ accessTokenSeconds: 59 }, logger)?.accessTokenSeconds).toBe(60);
    expect(normalizeTokenTtl({ accessTokenSeconds: 60 }, logger)?.accessTokenSeconds).toBe(60);
    expect(logger).toHaveBeenCalledTimes(1);
  });
});

describe('capTtl', () => {
  it('returns the Forest lifetime when no cap is configured', () => {
    expect(capTtl(3600)).toBe(3600);
  });

  it('shortens the lifetime to the cap', () => {
    expect(capTtl(3600, 900)).toBe(900);
  });

  it('never extends beyond the Forest lifetime', () => {
    expect(capTtl(900, 3600)).toBe(900);
  });

  it.each([0, -5])('does not rescue an already-expired Forest lifetime of %p', upstream => {
    expect(capTtl(upstream, 900)).toBe(upstream);
  });
});

describe('sessionRemainingSeconds', () => {
  const nowInSeconds = 1_000_000;

  it('is unbounded when no refresh cap is configured', () => {
    expect(sessionRemainingSeconds({ sessionStartedAt: nowInSeconds, nowInSeconds })).toBe(
      Infinity,
    );
  });

  it('is the full cap at the start of the session', () => {
    expect(
      sessionRemainingSeconds({
        refreshTokenSeconds: 86400,
        sessionStartedAt: nowInSeconds,
        nowInSeconds,
      }),
    ).toBe(86400);
  });

  it('shrinks as the session ages instead of sliding', () => {
    expect(
      sessionRemainingSeconds({
        refreshTokenSeconds: 86400,
        sessionStartedAt: nowInSeconds - 80000,
        nowInSeconds,
      }),
    ).toBe(6400);
  });

  it('goes non-positive once the session is over', () => {
    expect(
      sessionRemainingSeconds({
        refreshTokenSeconds: 86400,
        sessionStartedAt: nowInSeconds - 90000,
        nowInSeconds,
      }),
    ).toBe(-3600);
  });
});

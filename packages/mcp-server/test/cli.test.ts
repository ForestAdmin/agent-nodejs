import parseTokenTtl from '../src/utils/parse-token-ttl';
import parseToolList from '../src/utils/parse-tool-list';

describe('parseToolList', () => {
  it('should return undefined when env value is undefined', () => {
    expect(parseToolList(undefined)).toBeUndefined();
  });

  it('should return undefined when env value is empty string', () => {
    expect(parseToolList('')).toBeUndefined();
  });

  it('should parse comma-separated tool names', () => {
    expect(parseToolList('create,update,delete')).toEqual(['create', 'update', 'delete']);
  });

  it('should trim whitespace around tool names', () => {
    expect(parseToolList(' create , update , delete ')).toEqual(['create', 'update', 'delete']);
  });

  it('should filter out empty entries from trailing commas', () => {
    expect(parseToolList('create,,delete,')).toEqual(['create', 'delete']);
  });

  it('should handle a single tool name', () => {
    expect(parseToolList('delete')).toEqual(['delete']);
  });
});

describe('parseTokenTtl', () => {
  it('returns undefined when neither variable is set, so nothing is capped', () => {
    expect(parseTokenTtl({})).toBeUndefined();
  });

  it.each([
    [{ accessTokenSeconds: '900' }, { accessTokenSeconds: 900, refreshTokenSeconds: undefined }],
    [
      { refreshTokenSeconds: '86400' },
      { accessTokenSeconds: undefined, refreshTokenSeconds: 86400 },
    ],
    [
      { accessTokenSeconds: '900', refreshTokenSeconds: '86400' },
      { accessTokenSeconds: 900, refreshTokenSeconds: 86400 },
    ],
    [{ accessTokenSeconds: ' 900 ' }, { accessTokenSeconds: 900, refreshTokenSeconds: undefined }],
  ])('parses %p to seconds', (env, expected) => {
    expect(parseTokenTtl(env)).toEqual(expected);
  });

  // An unrendered template or a missing ConfigMap key must not silently leave a token uncapped.
  it.each(['', '   ', 'abc', '15m'])('yields NaN for %p so the normalizer rejects it', value => {
    expect(parseTokenTtl({ accessTokenSeconds: value })?.accessTokenSeconds).toBeNaN();
  });

  it('rejects an empty variable even when the other one is valid', () => {
    expect(parseTokenTtl({ accessTokenSeconds: '900', refreshTokenSeconds: '' })).toEqual({
      accessTokenSeconds: 900,
      refreshTokenSeconds: NaN,
    });
  });
});

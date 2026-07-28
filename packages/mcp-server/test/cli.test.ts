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
  it.each([
    [undefined, undefined],
    ['', ''],
  ])('returns undefined for (%p, %p) so nothing is capped', (access, refresh) => {
    expect(parseTokenTtl(access, refresh)).toBeUndefined();
  });

  it.each([
    ['900', undefined, { accessTokenSeconds: 900, refreshTokenSeconds: undefined }],
    [undefined, '86400', { accessTokenSeconds: undefined, refreshTokenSeconds: 86400 }],
    ['900', '86400', { accessTokenSeconds: 900, refreshTokenSeconds: 86400 }],
  ])('parses (%p, %p) to seconds', (access, refresh, expected) => {
    expect(parseTokenTtl(access, refresh)).toEqual(expected);
  });

  it('leaves a non-numeric value as NaN for the normalizer to reject', () => {
    expect(parseTokenTtl('abc')?.accessTokenSeconds).toBeNaN();
  });
});

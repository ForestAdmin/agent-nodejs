import { isBffRoute, stripBffPrefix } from '../src/bff-routes';

describe('isBffRoute', () => {
  it.each(['/bff', '/bff/health', '/bff/agent/v1/books/list', '/bff?x=1', '/bff/health?x=1'])(
    'should claim %s',
    url => {
      expect(isBffRoute(url)).toBe(true);
    },
  );

  it.each(['/bffalo', '/bff-server/health', '/forest', '/', '/mcp'])(
    'should leave %s to the host',
    url => {
      expect(isBffRoute(url)).toBe(false);
    },
  );
});

describe('stripBffPrefix', () => {
  it.each([
    ['/bff', '/'],
    ['/bff/', '/'],
    ['/bff/health', '/health'],
    ['/bff/agent/v1/books/list', '/agent/v1/books/list'],
    ['/bff?x=1', '/?x=1'],
    ['/bff/health?x=1', '/health?x=1'],
  ])('should turn %s into %s', (url, expected) => {
    expect(stripBffPrefix(url)).toBe(expected);
  });

  it('should never yield an empty url, which Koa would read as malformed', () => {
    expect(stripBffPrefix('/bff')).not.toBe('');
  });
});

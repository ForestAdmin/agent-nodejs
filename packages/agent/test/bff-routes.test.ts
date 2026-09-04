import { collidesWithBff, isBffRoute, stripBffPrefix } from '../src/bff-routes';

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

describe('collidesWithBff', () => {
  it.each(['/bff', '/bff/', '//bff//', 'bff', ' /bff ', '/bff/ai'])(
    'should reject %s, which the MCP server normalizes onto a path the BFF answers',
    basePath => {
      expect(collidesWithBff(basePath)).toBe(true);
    },
  );

  it.each([undefined, '', '/', '/ai', '/bffalo', '/bff-server'])(
    'should accept %s, which lands outside /bff',
    basePath => {
      expect(collidesWithBff(basePath)).toBe(false);
    },
  );
});

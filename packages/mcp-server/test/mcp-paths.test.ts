import {
  MCP_PATHS,
  buildMcpPaths,
  isMcpRoute,
  makeIsMcpRoute,
  normalizeMountPath,
} from '../src/mcp-paths';

describe('mcp-paths', () => {
  describe('normalizeMountPath', () => {
    it.each([undefined, '', '/', '  '])('returns "" for %p (root default)', input => {
      expect(normalizeMountPath(input)).toBe('');
    });

    it.each([
      ['mcp', '/mcp'],
      ['/mcp', '/mcp'],
      ['/mcp/', '/mcp'],
      ['//mcp//', '/mcp'],
      ['/api/mcp', '/api/mcp'],
    ])('normalizes %p to %p', (input, expected) => {
      expect(normalizeMountPath(input)).toBe(expected);
    });

    it.each([
      '/m?cp',
      '/m#cp',
      '/m cp',
      '/mcp\\admin',
      '/a/../mcp',
      '/mcp*',
      '/tenant/:id',
      '/m%20cp',
    ])('throws for %p (would desync routes from advertised metadata)', input => {
      expect(() => normalizeMountPath(input)).toThrow(/Invalid MCP mount path/);
    });
  });

  describe('buildMcpPaths', () => {
    it('claims the root well-known namespace by default', () => {
      expect(buildMcpPaths('')).toEqual(['/.well-known/', '/oauth/', '/mcp']);
    });

    it('claims prefix-suffixed well-known paths under a prefix', () => {
      expect(buildMcpPaths('/mcp')).toEqual([
        '/.well-known/oauth-authorization-server/mcp',
        '/.well-known/oauth-protected-resource/mcp',
        '/mcp/oauth/',
        '/mcp/mcp',
      ]);
    });

    it('claims nested prefix paths', () => {
      expect(buildMcpPaths('/api/mcp')).toEqual([
        '/.well-known/oauth-authorization-server/api/mcp',
        '/.well-known/oauth-protected-resource/api/mcp',
        '/api/mcp/oauth/',
        '/api/mcp/mcp',
      ]);
    });

    it('normalizes a raw (un-normalized) prefix on entry', () => {
      expect(buildMcpPaths('mcp/')).toEqual(buildMcpPaths('/mcp'));
    });
  });

  describe('default exports (root)', () => {
    it('MCP_PATHS matches the historical root paths', () => {
      expect(MCP_PATHS).toEqual(['/.well-known/', '/oauth/', '/mcp']);
    });

    it.each(['/.well-known/oauth-authorization-server', '/oauth/token', '/mcp'])(
      'isMcpRoute claims %p',
      url => {
        expect(isMcpRoute(url)).toBe(true);
      },
    );

    it('isMcpRoute passes through unrelated routes', () => {
      expect(isMcpRoute('/api/other')).toBe(false);
    });
  });

  describe('makeIsMcpRoute with prefix /mcp', () => {
    const matches = makeIsMcpRoute('/mcp');

    it.each([
      '/mcp/mcp',
      '/mcp/oauth/authorize',
      '/mcp/oauth/token',
      '/.well-known/oauth-authorization-server/mcp',
      '/.well-known/oauth-protected-resource/mcp/mcp',
    ])('claims prefixed route %p', url => {
      expect(matches(url)).toBe(true);
    });

    it.each([
      '/oauth/token',
      '/mcp',
      '/.well-known/oauth-authorization-server',
      '/.well-known/oauth-protected-resource',
      '/api/other',
    ])('passes through host route %p', url => {
      expect(matches(url)).toBe(false);
    });
  });
});

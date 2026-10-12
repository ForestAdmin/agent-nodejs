import { buildMcpPaths, isMcpRoute, makeIsMcpRoute, normalizeMountPath } from '../src/mcp-paths';

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
      '/foo[bar]',
      '/a!b',
      '/m|b',
      '/m^b',
    ])('throws for %p (would desync routes from advertised metadata)', input => {
      expect(() => normalizeMountPath(input)).toThrow(/Invalid MCP mount path/);
    });

    it('names the caller option in the error when given a label', () => {
      expect(() => normalizeMountPath('/a/../b', 'basePath')).toThrow(
        'Invalid basePath "/a/../b": use a plain path prefix',
      );
    });
  });

  describe('buildMcpPaths', () => {
    it('claims only the RFC 8414/9728 discovery documents at the root', () => {
      expect(buildMcpPaths('')).toEqual([
        '/.well-known/oauth-authorization-server',
        '/.well-known/oauth-protected-resource/mcp',
        '/oauth/',
        '/mcp',
      ]);
    });

    it('claims prefix-suffixed well-known documents under a prefix', () => {
      expect(buildMcpPaths('/mcp')).toEqual([
        '/.well-known/oauth-authorization-server/mcp',
        '/.well-known/oauth-protected-resource/mcp/mcp',
        '/mcp/oauth/',
        '/mcp/mcp',
      ]);
    });

    it('claims nested prefix paths', () => {
      expect(buildMcpPaths('/api/mcp')).toEqual([
        '/.well-known/oauth-authorization-server/api/mcp',
        '/.well-known/oauth-protected-resource/api/mcp/mcp',
        '/api/mcp/oauth/',
        '/api/mcp/mcp',
      ]);
    });

    it('normalizes a raw (un-normalized) prefix on entry', () => {
      expect(buildMcpPaths('mcp/')).toEqual(buildMcpPaths('/mcp'));
    });
  });

  describe('default exports (root)', () => {
    it.each(['/oauth/token', '/mcp', '/mcp?foo=1'])('isMcpRoute claims %p', url => {
      expect(isMcpRoute(url)).toBe(true);
    });

    it.each(['/api/other', '/mcp-dashboard'])('isMcpRoute passes through %p', url => {
      expect(isMcpRoute(url)).toBe(false);
    });
  });

  describe.each(['', '/ai'])('.well-known claims with prefix %p', P => {
    const matches = makeIsMcpRoute(P);

    it.each([
      `/.well-known/oauth-authorization-server${P}`,
      `/.well-known/oauth-authorization-server${P}/`,
      `/.well-known/oauth-authorization-server${P}?x=1`,
      `/.well-known/oauth-protected-resource${P}/mcp`,
      `/.well-known/oauth-protected-resource${P}/mcp/`,
    ])('claims the MCP discovery document %p', url => {
      expect(matches(url)).toBe(true);
    });

    it.each([
      '/.well-known/acme-challenge/tok123',
      '/.well-known/security.txt',
      '/.well-known/openid-configuration',
      '/.well-known/oauth-protected-resource',
      `/.well-known/oauth-protected-resource${P}`,
      `/.well-known/oauth-protected-resource${P}/extra`,
      `/.well-known/oauth-protected-resource${P}/mcp/extra`,
      `/.well-known/oauth-protected-resource${P}/mcp//`,
      `/.well-known/oauth-authorization-server${P}/extra`,
      `/.well-known/oauth-authorization-server${P}-x`,
    ])('leaves %p to the host', url => {
      expect(matches(url)).toBe(false);
    });
  });

  describe('makeIsMcpRoute with prefix /mcp', () => {
    const matches = makeIsMcpRoute('/mcp');

    it.each([
      '/mcp/mcp',
      '/mcp/mcp?x=1',
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
      '/mcp/mcp-dashboard',
      '/.well-known/oauth-protected-resource/mcp-dashboard',
    ])('passes through host route %p', url => {
      expect(matches(url)).toBe(false);
    });
  });
});

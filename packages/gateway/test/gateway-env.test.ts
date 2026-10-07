import parseGatewayEnv, { parseOpenApiEnv, parseServices } from '../src/gateway-env';

describe('parseServices', () => {
  it.each([
    ['mcp', ['mcp']],
    ['api', ['api']],
    ['mcp,api', ['mcp', 'api']],
    [' api , mcp ', ['api', 'mcp']],
    ['mcp,mcp', ['mcp']],
  ])('should read "%s"', (raw, expected) => {
    expect([...parseServices(raw)]).toEqual(expected);
  });

  it.each([undefined, '', ' , ', 'mcp,foo', 'MCP'])(
    'should reject %p listing the known services',
    raw => {
      expect(() => parseServices(raw)).toThrow(/FOREST_GATEWAY_SERVICES.*"mcp", "api"/);
    },
  );
});

describe('parseGatewayEnv', () => {
  it.each([
    ['mcp', 3931],
    ['mcp,api', 3931],
    ['api', 3450],
  ])('should default the port of "%s" to %d', (services, port) => {
    expect(parseGatewayEnv({ FOREST_GATEWAY_SERVICES: services }).port).toBe(port);
  });

  it('should read PORT', () => {
    expect(parseGatewayEnv({ FOREST_GATEWAY_SERVICES: 'api', PORT: '8080' }).port).toBe(8080);
  });

  it.each(['-1', '65536', '80a', '1.5'])('should reject PORT=%s', port => {
    expect(() => parseGatewayEnv({ FOREST_GATEWAY_SERVICES: 'api', PORT: port })).toThrow(
      `Invalid PORT "${port}"`,
    );
  });

  it.each(['mcp', 'mcp,api'])(
    'should refuse PORT=0 without FOREST_GATEWAY_URL when serving "%s", naming both',
    services => {
      expect(() => parseGatewayEnv({ FOREST_GATEWAY_SERVICES: services, PORT: '0' })).toThrow(
        /PORT=0.*FOREST_GATEWAY_URL/s,
      );
    },
  );

  it('should accept PORT=0 with FOREST_GATEWAY_URL', () => {
    expect(
      parseGatewayEnv({
        FOREST_GATEWAY_SERVICES: 'mcp',
        PORT: '0',
        FOREST_GATEWAY_URL: 'https://gateway.example.com',
      }),
    ).toEqual(expect.objectContaining({ port: 0, publicUrl: 'https://gateway.example.com' }));
  });

  it('should accept PORT=0 for the API alone', () => {
    expect(parseGatewayEnv({ FOREST_GATEWAY_SERVICES: 'api', PORT: '0' }).port).toBe(0);
  });

  it.each([
    'gateway.example.com',
    'ftp://gateway.example.com',
    'https://gateway.example.com/ai',
    'https://gateway.example.com?x=1',
    'https://user:pass@gateway.example.com',
  ])('should reject FOREST_GATEWAY_URL=%s', url => {
    expect(() =>
      parseGatewayEnv({ FOREST_GATEWAY_SERVICES: 'mcp', FOREST_GATEWAY_URL: url }),
    ).toThrow('Invalid FOREST_GATEWAY_URL');
  });

  it.each([
    [undefined, ''],
    ['/', ''],
    ['ai', '/ai'],
    ['/ai/', '/ai'],
  ])('should normalize FOREST_GATEWAY_BASE_PATH=%p to "%s"', (raw, basePath) => {
    expect(
      parseGatewayEnv({ FOREST_GATEWAY_SERVICES: 'api', FOREST_GATEWAY_BASE_PATH: raw }).basePath,
    ).toBe(basePath);
  });

  it('should reject a base path that is not a plain prefix', () => {
    expect(() =>
      parseGatewayEnv({ FOREST_GATEWAY_SERVICES: 'api', FOREST_GATEWAY_BASE_PATH: '/a b' }),
    ).toThrow('Invalid FOREST_GATEWAY_BASE_PATH');
  });
});

const SECRET = 'do-not-print-me';

describe('parseGatewayEnv aliases', () => {
  describe('port', () => {
    it.each(['MCP_SERVER_PORT', 'HTTP_PORT'])('should read %s with one warning', key => {
      const gateway = parseGatewayEnv({ FOREST_GATEWAY_SERVICES: 'api', [key]: '8080' });

      expect(gateway.port).toBe(8080);
      expect(gateway.warnings).toEqual([`${key} is a legacy name: use PORT instead`]);
    });

    it('should fail naming both legacy ports when they disagree', () => {
      expect(() =>
        parseGatewayEnv({
          FOREST_GATEWAY_SERVICES: 'api',
          HTTP_PORT: '8080',
          MCP_SERVER_PORT: '3931',
        }),
      ).toThrow(/MCP_SERVER_PORT and HTTP_PORT disagree/);
    });

    it('should listen on PORT and warn about each shadowed legacy port', () => {
      const gateway = parseGatewayEnv({
        FOREST_GATEWAY_SERVICES: 'api',
        PORT: '8080',
        HTTP_PORT: 'abc',
        MCP_SERVER_PORT: 'abc',
      });

      expect(gateway.port).toBe(8080);
      expect(gateway.warnings).toEqual([
        'MCP_SERVER_PORT is ignored: PORT is set',
        'HTTP_PORT is ignored: PORT is set',
      ]);
    });

    it('should name the legacy key of an invalid port', () => {
      expect(() => parseGatewayEnv({ FOREST_GATEWAY_SERVICES: 'api', HTTP_PORT: 'abc' })).toThrow(
        'Invalid HTTP_PORT "abc"',
      );
    });

    it('should never hand a port to the parsers', () => {
      const gateway = parseGatewayEnv({
        FOREST_GATEWAY_SERVICES: 'mcp,api',
        PORT: '8080',
        HTTP_PORT: '8080',
        MCP_SERVER_PORT: '8080',
      });

      expect(gateway.api?.env.HTTP_PORT).toBeUndefined();
      expect(gateway.mcp?.env.MCP_SERVER_PORT).toBeUndefined();
    });
  });

  describe('gateway url', () => {
    it('should let FOREST_MCP_SERVER_URL win over an empty FOREST_GATEWAY_URL', () => {
      const gateway = parseGatewayEnv({
        FOREST_GATEWAY_SERVICES: 'mcp',
        FOREST_GATEWAY_URL: '',
        FOREST_MCP_SERVER_URL: 'https://mcp.example.com',
      });

      expect(gateway.publicUrl).toBe('https://mcp.example.com');
      expect(gateway.warnings).toEqual([
        'FOREST_MCP_SERVER_URL is a legacy name: use FOREST_GATEWAY_URL instead',
      ]);
    });

    it('should name FOREST_MCP_SERVER_URL when it is invalid', () => {
      expect(() =>
        parseGatewayEnv({
          FOREST_GATEWAY_SERVICES: 'mcp',
          FOREST_MCP_SERVER_URL: 'https://mcp.example.com/path',
        }),
      ).toThrow('Invalid FOREST_MCP_SERVER_URL');
    });

    it('should warn naming FOREST_GATEWAY_URL when the MCP has none', () => {
      const gateway = parseGatewayEnv({ FOREST_GATEWAY_SERVICES: 'mcp', PORT: '4000' });

      expect(gateway.warnings).toEqual([
        'FOREST_GATEWAY_URL is not set: MCP clients are told http://localhost:4000',
      ]);
    });

    it.each(['FOREST_GATEWAY_URL', 'FOREST_MCP_SERVER_URL'])(
      'should ignore %s with a warning when only the API is on',
      key => {
        const gateway = parseGatewayEnv({
          FOREST_GATEWAY_SERVICES: 'api',
          [key]: 'not a url',
        });

        expect(gateway.publicUrl).toBeUndefined();
        expect(gateway.warnings).toEqual([
          `${key} is ignored: the mcp service is off: the API reads FOREST_GATEWAY_API_PUBLIC_URL`,
        ]);
      },
    );

    it('should not hand the gateway url to the API', () => {
      const gateway = parseGatewayEnv({
        FOREST_GATEWAY_SERVICES: 'mcp,api',
        FOREST_GATEWAY_URL: 'https://gateway.example.com',
      });

      expect(gateway.api?.env.BFF_PUBLIC_URL).toBeUndefined();
    });
  });

  describe('agent url', () => {
    it('should feed FOREST_AGENT_URL to both services', () => {
      const gateway = parseGatewayEnv({
        FOREST_GATEWAY_SERVICES: 'mcp,api',
        FOREST_AGENT_URL: 'https://agent.example.com',
      });

      expect(gateway.api?.env.AGENT_URL).toBe('https://agent.example.com');
      expect(gateway.mcp?.env.FOREST_AGENT_URL).toBe('https://agent.example.com');
    });

    it('should feed AGENT_URL to both services when it is the only one set', () => {
      const gateway = parseGatewayEnv({
        FOREST_GATEWAY_SERVICES: 'mcp,api',
        AGENT_URL: 'https://agent.example.com',
      });

      expect(gateway.api?.env.AGENT_URL).toBe('https://agent.example.com');
      expect(gateway.mcp?.env.FOREST_AGENT_URL).toBe('https://agent.example.com');
      expect(gateway.api?.labels.AGENT_URL).toBe('AGENT_URL');
      expect(gateway.mcp?.labels.agentUrl).toBe('AGENT_URL');
    });

    it('should prefer FOREST_AGENT_URL over a different AGENT_URL, naming AGENT_URL once', () => {
      const gateway = parseGatewayEnv({
        FOREST_GATEWAY_SERVICES: 'mcp,api',
        FOREST_GATEWAY_URL: 'https://gateway.example.com',
        FOREST_AGENT_URL: 'https://agent.example.com',
        AGENT_URL: 'https://other.example.com',
      });

      expect(gateway.api?.env.AGENT_URL).toBe('https://agent.example.com');
      expect(gateway.mcp?.env.FOREST_AGENT_URL).toBe('https://agent.example.com');
      expect(gateway.warnings).toEqual(['AGENT_URL is ignored: FOREST_AGENT_URL is set']);
    });

    it('should ignore AGENT_URL with a warning when the API is off', () => {
      const gateway = parseGatewayEnv({
        FOREST_GATEWAY_SERVICES: 'mcp',
        FOREST_GATEWAY_URL: 'https://gateway.example.com',
        AGENT_URL: 'https://agent.example.com',
      });

      expect(gateway.mcp?.env.FOREST_AGENT_URL).toBeUndefined();
      expect(gateway.warnings).toEqual([
        'AGENT_URL is ignored: the api service is off: use FOREST_AGENT_URL',
      ]);
    });

    it.each([
      ['a query string', `https://agent.example.com?token=${SECRET}`],
      ['a fragment', `https://agent.example.com#${SECRET}`],
      ['no scheme', `agent.example.com/${SECRET}`],
      ['a non-http scheme', `ftp://agent.example.com/${SECRET}`],
    ])('should fail on an agent url with %s, naming the key without its value', (_, url) => {
      const parse = () =>
        parseGatewayEnv({ FOREST_GATEWAY_SERVICES: 'mcp,api', FOREST_AGENT_URL: url });

      expect(parse).toThrow(
        'Invalid FOREST_AGENT_URL: expected an absolute http(s) URL with no query string or fragment.',
      );
      expect(parse).not.toThrow(SECRET);
    });
  });

  describe('API variables', () => {
    it.each([
      ['FOREST_GATEWAY_API_TOKEN_ENCRYPTION_KEY', 'BFF_TOKEN_ENCRYPTION_KEY'],
      ['FOREST_GATEWAY_API_ALLOWED_ORIGINS', 'BFF_ALLOWED_ORIGINS'],
      ['FOREST_GATEWAY_API_DEFAULT_TIMEZONE', 'BFF_DEFAULT_TIMEZONE'],
      ['FOREST_GATEWAY_API_AGENT_TIMEOUT_MS', 'BFF_AGENT_TIMEOUT_MS'],
      ['FOREST_GATEWAY_API_AI_TIMEOUT_MS', 'BFF_AI_TIMEOUT_MS'],
      ['FOREST_GATEWAY_API_OPENAPI_ENABLED', 'BFF_OPENAPI_ENABLED'],
      ['FOREST_GATEWAY_API_RATE_LIMIT_MAX_REQUESTS', 'BFF_RATE_LIMIT_MAX_REQUESTS'],
      ['FOREST_GATEWAY_API_RATE_LIMIT_WINDOW_MS', 'BFF_RATE_LIMIT_WINDOW_MS'],
      ['FOREST_GATEWAY_API_PUBLIC_URL', 'BFF_PUBLIC_URL'],
    ])('should hand %s to the API as %s, labelled by its own name', (name, bffKey) => {
      const value = bffKey === 'BFF_PUBLIC_URL' ? 'https://corp.example/api' : 'x';
      const gateway = parseGatewayEnv({ FOREST_GATEWAY_SERVICES: 'api', [name]: value });

      expect(gateway.api?.env[bffKey]).toBe(value);
      expect(gateway.api?.labels[bffKey]).toBe(name);
      expect(gateway.warnings).toEqual([]);
    });

    it('should read a BFF_ alias, labelled by its legacy name, with one warning', () => {
      const gateway = parseGatewayEnv({
        FOREST_GATEWAY_SERVICES: 'api',
        BFF_TOKEN_ENCRYPTION_KEY: SECRET,
      });

      expect(gateway.api?.env.BFF_TOKEN_ENCRYPTION_KEY).toBe(SECRET);
      expect(gateway.api?.labels.BFF_TOKEN_ENCRYPTION_KEY).toBe('BFF_TOKEN_ENCRYPTION_KEY');
      expect(gateway.warnings).toEqual([
        'BFF_TOKEN_ENCRYPTION_KEY is a legacy name: use FOREST_GATEWAY_API_TOKEN_ENCRYPTION_KEY instead',
      ]);
    });

    it('should label an unset key by its new name', () => {
      const gateway = parseGatewayEnv({ FOREST_GATEWAY_SERVICES: 'api' });

      expect(gateway.api?.labels).toEqual(
        expect.objectContaining({
          AGENT_URL: 'FOREST_AGENT_URL',
          BFF_ALLOWED_ORIGINS: 'FOREST_GATEWAY_API_ALLOWED_ORIGINS',
          BFF_TOKEN_ENCRYPTION_KEY: 'FOREST_GATEWAY_API_TOKEN_ENCRYPTION_KEY',
        }),
      );
    });

    it('should not resolve API variables when the API is off', () => {
      const gateway = parseGatewayEnv({
        FOREST_GATEWAY_SERVICES: 'mcp',
        FOREST_GATEWAY_URL: 'https://gateway.example.com',
        BFF_PUBLIC_URL: 'https://corp.example',
      });

      expect(gateway.api).toBeUndefined();
      expect(gateway.warnings).toEqual([]);
    });
  });

  describe('API public url', () => {
    it.each([
      ['', 'https://corp.example/api'],
      ['', 'https://corp.example/proxy/api/'],
      ['/forest', 'https://corp.example/forest/api'],
    ])('should accept under base path "%s" the url %s', (basePath, url) => {
      expect(() =>
        parseGatewayEnv({
          FOREST_GATEWAY_SERVICES: 'api',
          FOREST_GATEWAY_BASE_PATH: basePath,
          FOREST_GATEWAY_API_PUBLIC_URL: url,
        }),
      ).not.toThrow();
    });

    it.each([
      ['BFF_PUBLIC_URL', '', 'https://corp.example', '/api'],
      ['FOREST_GATEWAY_API_PUBLIC_URL', '/forest', 'https://corp.example/api', '/forest/api'],
      ['FOREST_GATEWAY_API_PUBLIC_URL', '', 'https://corp.example/apis', '/api'],
    ])('should fail when %s under "%s" is %s, asking for %s', (key, basePath, url, suffix) => {
      expect(() =>
        parseGatewayEnv({
          FOREST_GATEWAY_SERVICES: 'api',
          FOREST_GATEWAY_BASE_PATH: basePath,
          [key]: url,
        }),
      ).toThrow(
        `Invalid configuration: ${key} must end with ${suffix}, where the Gateway serves the API.`,
      );
    });

    it('should name BFF_PUBLIC_URL when it is malformed', () => {
      expect(() =>
        parseGatewayEnv({ FOREST_GATEWAY_SERVICES: 'api', BFF_PUBLIC_URL: 'corp.example/api' }),
      ).toThrow('Invalid configuration: BFF_PUBLIC_URL must be a valid http(s) URL.');
    });

    it('should not validate a root BFF_PUBLIC_URL shadowed by the new name', () => {
      const gateway = parseGatewayEnv({
        FOREST_GATEWAY_SERVICES: 'api',
        FOREST_GATEWAY_API_PUBLIC_URL: 'https://corp.example/api',
        BFF_PUBLIC_URL: 'https://corp.example',
      });

      expect(gateway.api?.env.BFF_PUBLIC_URL).toBe('https://corp.example/api');
      expect(gateway.warnings).toEqual([
        'BFF_PUBLIC_URL is ignored: FOREST_GATEWAY_API_PUBLIC_URL is set',
      ]);
    });
  });

  describe('allowed OAuth clients', () => {
    it('should hand the legacy MCP allowlist to both services with one warning', () => {
      const gateway = parseGatewayEnv({
        FOREST_GATEWAY_SERVICES: 'mcp,api',
        FOREST_GATEWAY_URL: 'https://gateway.example.com',
        FOREST_MCP_ALLOWED_OAUTH_CLIENTS: 'claude.ai, Dust.tt',
      });

      expect(gateway.api?.allowedOAuthClients).toEqual(['claude.ai', 'dust.tt']);
      expect(gateway.mcp?.env.FOREST_MCP_ALLOWED_OAUTH_CLIENTS).toBe('claude.ai, Dust.tt');
      expect(gateway.warnings).toEqual([
        'FOREST_MCP_ALLOWED_OAUTH_CLIENTS is a legacy name: use FOREST_GATEWAY_ALLOWED_OAUTH_CLIENTS instead',
      ]);
    });

    it('should let the new name win in both services', () => {
      const gateway = parseGatewayEnv({
        FOREST_GATEWAY_SERVICES: 'mcp,api',
        FOREST_GATEWAY_URL: 'https://gateway.example.com',
        FOREST_GATEWAY_ALLOWED_OAUTH_CLIENTS: 'claude.ai',
        FOREST_MCP_ALLOWED_OAUTH_CLIENTS: 'dust.tt',
      });

      expect(gateway.api?.allowedOAuthClients).toEqual(['claude.ai']);
      expect(gateway.mcp?.env.FOREST_MCP_ALLOWED_OAUTH_CLIENTS).toBe('claude.ai');
    });

    it.each([
      ['FOREST_GATEWAY_ALLOWED_OAUTH_CLIENTS', 'https://claude.ai', /entry "https:\/\/claude.ai"/],
      ['FOREST_MCP_ALLOWED_OAUTH_CLIENTS', ' , ', /no domains to allow/],
    ])('should fail naming %s when its list is invalid', (key, value, reason) => {
      const parse = () => parseGatewayEnv({ FOREST_GATEWAY_SERVICES: 'api', [key]: value });

      expect(parse).toThrow(`Invalid ${key}`);
      expect(parse).toThrow(reason);
    });

    it('should leave the allowlist unset when no name is set', () => {
      const gateway = parseGatewayEnv({ FOREST_GATEWAY_SERVICES: 'api' });

      expect(gateway.api?.allowedOAuthClients).toBeUndefined();
    });
  });

  describe('MCP labels', () => {
    it('should name the MCP token TTLs by their env keys', () => {
      const gateway = parseGatewayEnv({
        FOREST_GATEWAY_SERVICES: 'mcp',
        FOREST_GATEWAY_URL: 'https://gateway.example.com',
      });

      expect(gateway.mcp?.labels).toEqual({
        accessTokenTtl: 'FOREST_MCP_ACCESS_TOKEN_TTL_SECONDS',
        refreshTokenTtl: 'FOREST_MCP_REFRESH_TOKEN_TTL_SECONDS',
        agentUrl: 'FOREST_AGENT_URL',
      });
    });
  });

  it('should take a forest-bff configuration with one warning per alias', () => {
    const gateway = parseGatewayEnv({
      FOREST_GATEWAY_SERVICES: 'api',
      AGENT_URL: 'https://agent.example.com',
      HTTP_PORT: '8080',
      BFF_PUBLIC_URL: 'https://corp.example/api',
      BFF_TOKEN_ENCRYPTION_KEY: SECRET,
      BFF_ALLOWED_ORIGINS: 'https://app.example.com',
    });

    expect(gateway.port).toBe(8080);
    expect(gateway.warnings).toEqual([
      'HTTP_PORT is a legacy name: use PORT instead',
      'AGENT_URL is a legacy name: use FOREST_AGENT_URL instead',
      'BFF_PUBLIC_URL is a legacy name: use FOREST_GATEWAY_API_PUBLIC_URL instead',
      'BFF_TOKEN_ENCRYPTION_KEY is a legacy name: use FOREST_GATEWAY_API_TOKEN_ENCRYPTION_KEY instead',
      'BFF_ALLOWED_ORIGINS is a legacy name: use FOREST_GATEWAY_API_ALLOWED_ORIGINS instead',
    ]);
    expect(gateway.warnings.join('\n')).not.toContain(SECRET);
  });
});

describe('parseOpenApiEnv', () => {
  it('should resolve the API variables without FOREST_GATEWAY_SERVICES', () => {
    const { basePath, api, warnings } = parseOpenApiEnv({
      FOREST_GATEWAY_BASE_PATH: '/ai',
      AGENT_URL: 'https://agent.example.com',
      FOREST_GATEWAY_API_PUBLIC_URL: 'https://corp.example/ai/api',
    });

    expect(basePath).toBe('/ai');
    expect(api.env).toEqual(
      expect.objectContaining({
        AGENT_URL: 'https://agent.example.com',
        BFF_PUBLIC_URL: 'https://corp.example/ai/api',
      }),
    );
    expect(api.labels.BFF_PUBLIC_URL).toBe('FOREST_GATEWAY_API_PUBLIC_URL');
    expect(warnings).toEqual(['AGENT_URL is a legacy name: use FOREST_AGENT_URL instead']);
  });

  it('should refuse an API public url outside the base path', () => {
    expect(() =>
      parseOpenApiEnv({
        FOREST_GATEWAY_BASE_PATH: '/ai',
        FOREST_GATEWAY_API_PUBLIC_URL: 'https://corp.example/api',
      }),
    ).toThrow('FOREST_GATEWAY_API_PUBLIC_URL must end with /ai/api');
  });
});

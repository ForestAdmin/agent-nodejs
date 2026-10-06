import parseGatewayEnv, {
  parseServices,
  toBffEnv,
  toMcpEnv,
  warnLegacyVars,
} from '../src/gateway-env';

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
      parseGatewayEnv({ FOREST_GATEWAY_SERVICES: 'api', FOREST_GATEWAY_URL: url }),
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

describe('toBffEnv', () => {
  it('should publish the API under the gateway url, base path and /api', () => {
    expect(
      toBffEnv(
        { HTTP_PORT: '1', BFF_PUBLIC_URL: 'https://old.example.com', AGENT_URL: 'https://a.io' },
        { basePath: '/ai', publicUrl: 'https://gateway.example.com' },
      ),
    ).toEqual({
      HTTP_PORT: undefined,
      BFF_PUBLIC_URL: 'https://gateway.example.com/ai/api',
      AGENT_URL: 'https://a.io',
    });
  });

  it('should leave the API url relative without a gateway url', () => {
    expect(toBffEnv({ BFF_PUBLIC_URL: 'https://old.example.com' }, { basePath: '' })).toEqual({
      HTTP_PORT: undefined,
      BFF_PUBLIC_URL: undefined,
    });
  });
});

describe('toMcpEnv', () => {
  it('should drop the MCP listener variables', () => {
    expect(
      toMcpEnv({ MCP_SERVER_PORT: '1', FOREST_MCP_SERVER_URL: 'x', FOREST_ENV_SECRET: 's' }),
    ).toEqual({
      MCP_SERVER_PORT: undefined,
      FOREST_MCP_SERVER_URL: undefined,
      FOREST_ENV_SECRET: 's',
    });
  });
});

describe('warnLegacyVars', () => {
  it('should warn once per legacy variable set, naming its replacement', () => {
    const logger = jest.fn();

    warnLegacyVars(
      { MCP_SERVER_PORT: '1', HTTP_PORT: '2', FOREST_MCP_SERVER_URL: 'x', BFF_PUBLIC_URL: 'y' },
      logger,
    );

    expect(logger.mock.calls).toEqual([
      ['Warn', 'MCP_SERVER_PORT is ignored by forest-gateway: use PORT instead'],
      ['Warn', 'HTTP_PORT is ignored by forest-gateway: use PORT instead'],
      [
        'Warn',
        'FOREST_MCP_SERVER_URL is ignored by forest-gateway: use FOREST_GATEWAY_URL instead',
      ],
      ['Warn', 'BFF_PUBLIC_URL is ignored by forest-gateway: use FOREST_GATEWAY_URL instead'],
    ]);
  });

  it('should stay silent on empty legacy variables', () => {
    const logger = jest.fn();

    warnLegacyVars({ MCP_SERVER_PORT: ' ' }, logger);

    expect(logger).not.toHaveBeenCalled();
  });
});

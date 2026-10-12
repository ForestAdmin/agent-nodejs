import parseMcpEnv, { parseMcpListenerEnv } from '../src/mcp-env';

describe('parseMcpEnv', () => {
  it('returns the defaults when the env is empty', () => {
    expect(parseMcpEnv({})).toEqual({
      options: {
        forestServerUrl: 'https://api.forestadmin.com',
        forestAppUrl: 'https://app.forestadmin.com',
        envSecret: undefined,
        authSecret: undefined,
        enabledTools: undefined,
        allowedOAuthClients: undefined,
        agentUrl: undefined,
        tokenTtl: { accessTokenSeconds: undefined, refreshTokenSeconds: undefined },
      },
      listener: { port: undefined, publicUrl: undefined },
      uploadStorageModule: undefined,
    });
  });

  it('maps every variable to its option, listener setting or module path', () => {
    expect(
      parseMcpEnv({
        FOREST_SERVER_URL: 'https://api.example.com',
        FOREST_APP_URL: 'https://app.example.com',
        FOREST_ENV_SECRET: 'env-secret',
        FOREST_AUTH_SECRET: 'auth-secret',
        FOREST_MCP_ENABLED_TOOLS: 'list, describeCollection',
        FOREST_MCP_ALLOWED_OAUTH_CLIENTS: 'claude.ai, chatgpt.com',
        FOREST_AGENT_URL: 'https://agent.example.com/',
        FOREST_MCP_ACCESS_TOKEN_TTL_SECONDS: '30',
        FOREST_MCP_REFRESH_TOKEN_TTL_SECONDS: '7200',
        FOREST_MCP_FILE_UPLOADS: 'true',
        FOREST_MCP_UPLOAD_STORAGE_MODULE: './storage.js',
        MCP_SERVER_PORT: '0',
        FOREST_MCP_SERVER_URL: 'https://mcp.example.com',
      }),
    ).toEqual({
      options: {
        forestServerUrl: 'https://api.example.com',
        forestAppUrl: 'https://app.example.com',
        envSecret: 'env-secret',
        authSecret: 'auth-secret',
        enabledTools: ['list', 'describeCollection'],
        allowedOAuthClients: ['claude.ai', 'chatgpt.com'],
        agentUrl: 'https://agent.example.com/',
        tokenTtl: { accessTokenSeconds: 30, refreshTokenSeconds: 7200 },
      },
      listener: { port: 0, publicUrl: 'https://mcp.example.com' },
      uploadStorageModule: './storage.js',
    });
  });

  it("turns uploads off and drops the module path on FOREST_MCP_FILE_UPLOADS='false'", () => {
    const parsed = parseMcpEnv({
      FOREST_MCP_FILE_UPLOADS: 'false',
      FOREST_MCP_UPLOAD_STORAGE_MODULE: './storage.js',
    });

    expect(parsed.options.fileUploads).toBe(false);
    expect(parsed.uploadStorageModule).toBeUndefined();
  });

  it.each(['', 'FALSE', '0'])('rejects FOREST_MCP_FILE_UPLOADS=%j', value => {
    expect(() => parseMcpEnv({ FOREST_MCP_FILE_UPLOADS: value })).toThrow(
      `Invalid FOREST_MCP_FILE_UPLOADS "${value}": use 'false' to turn action file uploads off. ` +
        'They are on by default.',
    );
  });

  it.each([
    ['FOREST_MCP_ACCESS_TOKEN_TTL_SECONDS', 'accessTokenSeconds', '', '0'],
    ['FOREST_MCP_ACCESS_TOKEN_TTL_SECONDS', 'accessTokenSeconds', 'abc', 'NaN'],
    ['FOREST_MCP_REFRESH_TOKEN_TTL_SECONDS', 'refreshTokenSeconds', '', '0'],
    ['FOREST_MCP_REFRESH_TOKEN_TTL_SECONDS', 'refreshTokenSeconds', '-5', '-5'],
  ])('rejects %s=%j with the constructor message', (variable, field, value, shown) => {
    expect(() => parseMcpEnv({ [variable]: value })).toThrow(
      `Invalid tokenTtl.${field} "${shown}": it must be a positive integer number of seconds.`,
    );
  });

  it('leaves a TTL under the minimum to the constructor, which clamps it', () => {
    expect(parseMcpEnv({ FOREST_MCP_ACCESS_TOKEN_TTL_SECONDS: '1' }).options.tokenTtl).toEqual({
      accessTokenSeconds: 1,
      refreshTokenSeconds: undefined,
    });
  });

  it('rejects an invalid FOREST_AGENT_URL with the constructor message', () => {
    expect(() => parseMcpEnv({ FOREST_AGENT_URL: 'ftp://agent.example.com' })).toThrow(
      'Invalid agentUrl "ftp://agent.example.com": only http and https are supported.',
    );
  });

  it('names every variable through the label map', () => {
    const labels = {
      accessTokenTtl: 'ACCESS_TTL',
      refreshTokenTtl: 'REFRESH_TTL',
      fileUploads: 'UPLOADS',
      agentUrl: 'AGENT',
      port: 'PORT',
      publicUrl: 'PUBLIC_URL',
    };

    expect(() => parseMcpEnv({ FOREST_MCP_ACCESS_TOKEN_TTL_SECONDS: '' }, labels)).toThrow(
      'Invalid ACCESS_TTL "0"',
    );
    expect(() => parseMcpEnv({ FOREST_MCP_REFRESH_TOKEN_TTL_SECONDS: '' }, labels)).toThrow(
      'Invalid REFRESH_TTL "0"',
    );
    expect(() => parseMcpEnv({ FOREST_MCP_FILE_UPLOADS: 'no' }, labels)).toThrow(
      'Invalid UPLOADS "no"',
    );
    expect(() => parseMcpEnv({ FOREST_AGENT_URL: 'nope' }, labels)).toThrow('Invalid AGENT "nope"');
    expect(() => parseMcpEnv({ MCP_SERVER_PORT: 'x' }, labels)).toThrow('Invalid PORT "x"');
    expect(() => parseMcpEnv({ FOREST_MCP_SERVER_URL: 'mcp.example.com' }, labels)).toThrow(
      'Invalid PUBLIC_URL',
    );
  });

  it('falls back to the default label for an undefined entry', () => {
    const labels = { port: undefined, publicUrl: undefined, fileUploads: undefined };

    expect(() => parseMcpEnv({ FOREST_MCP_FILE_UPLOADS: 'no' }, labels)).toThrow(
      'Invalid FOREST_MCP_FILE_UPLOADS "no"',
    );
    expect(() => parseMcpEnv({ MCP_SERVER_PORT: 'x' }, labels)).toThrow(
      'Invalid MCP_SERVER_PORT "x"',
    );
    expect(() => parseMcpEnv({ FOREST_MCP_SERVER_URL: 'mcp.example.com' }, labels)).toThrow(
      'Invalid FOREST_MCP_SERVER_URL',
    );
  });

  it('logs nothing', () => {
    const spies = (['log', 'info', 'warn', 'error'] as const).map(method =>
      jest.spyOn(console, method).mockImplementation(),
    );

    parseMcpEnv({
      FOREST_MCP_ACCESS_TOKEN_TTL_SECONDS: '1',
      FOREST_MCP_REFRESH_TOKEN_TTL_SECONDS: '2',
    });

    spies.forEach(spy => {
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });
  });
});

describe('parseMcpListenerEnv', () => {
  it('returns no port and no url when they are unset or empty', () => {
    expect(parseMcpListenerEnv({})).toEqual({ port: undefined, publicUrl: undefined });
    expect(parseMcpListenerEnv({ MCP_SERVER_PORT: '', FOREST_MCP_SERVER_URL: '' })).toEqual({
      port: undefined,
      publicUrl: undefined,
    });
  });

  it('reads nothing but the listener variables', () => {
    expect(
      parseMcpListenerEnv({
        MCP_SERVER_PORT: '3931',
        FOREST_MCP_FILE_UPLOADS: 'invalid',
        FOREST_MCP_ACCESS_TOKEN_TTL_SECONDS: 'invalid',
        FOREST_AGENT_URL: 'invalid',
      }),
    ).toEqual({ port: 3931, publicUrl: undefined });
  });

  it.each(['abc', '-1', '65536', '1.5'])('rejects MCP_SERVER_PORT=%j', value => {
    expect(() => parseMcpListenerEnv({ MCP_SERVER_PORT: value })).toThrow(
      `Invalid MCP_SERVER_PORT "${value}": expected an integer between 0 and 65535.`,
    );
  });

  it('leaves the port-0 check to the caller owning the listener', () => {
    expect(parseMcpListenerEnv({ MCP_SERVER_PORT: '0' })).toEqual({
      port: 0,
      publicUrl: undefined,
    });
  });

  it.each([
    ['a path', 'https://mcp.example.com/mcp', 'https://mcp.example.com'],
    ['no scheme', 'mcp.example.com', 'mcp.example.com'],
    ['credentials', 'https://svc:p4ssw0rd@mcp.example.com', 'https://mcp.example.com'],
  ])('rejects a FOREST_MCP_SERVER_URL with %s', (_, value, shown) => {
    expect(() => parseMcpListenerEnv({ FOREST_MCP_SERVER_URL: value })).toThrow(
      `Invalid FOREST_MCP_SERVER_URL "${shown}": expected an http(s) origin with no path, ` +
        'query, fragment or credentials, e.g. https://mcp.example.com',
    );
  });

  it('keeps the configured url as given', () => {
    expect(parseMcpListenerEnv({ FOREST_MCP_SERVER_URL: 'https://mcp.example.com/' })).toEqual({
      port: undefined,
      publicUrl: 'https://mcp.example.com/',
    });
  });
});

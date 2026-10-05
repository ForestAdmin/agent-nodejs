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

describe('forest-mcp-server', () => {
  const savedEnv = process.env;

  afterEach(() => {
    process.env = savedEnv;
    jest.restoreAllMocks();
  });

  async function startCli(env: Record<string, string>) {
    process.env = { ...env };
    const exit = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    const consoleError = jest.spyOn(console, 'error').mockImplementation();
    let Server: jest.Mock = jest.fn();

    jest.isolateModules(() => {
      jest.doMock('../src/server', () => {
        const { default: RealServer } = jest.requireActual('../src/server');

        return {
          __esModule: true,
          default: jest.fn().mockImplementation(options => {
            const server = new RealServer(options);
            server.run = jest.fn().mockResolvedValue(undefined);

            return server;
          }),
        };
      });
      // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
      Server = require('../src/server').default;
      // eslint-disable-next-line global-require
      require('../src/cli');
    });

    await new Promise(resolve => {
      setImmediate(resolve);
    });

    return { Server, exit, consoleError };
  }

  it('builds the server with the options it built before parseMcpEnv', async () => {
    const { Server, exit } = await startCli({
      FOREST_SERVER_URL: 'https://api.example.com',
      FOREST_APP_URL: 'https://app.example.com',
      FOREST_ENV_SECRET: 'env-secret',
      FOREST_AUTH_SECRET: 'auth-secret',
      FOREST_MCP_ENABLED_TOOLS: 'list,describeCollection',
      FOREST_MCP_ALLOWED_OAUTH_CLIENTS: 'claude.ai',
      FOREST_AGENT_URL: 'https://agent.example.com/',
      FOREST_MCP_ACCESS_TOKEN_TTL_SECONDS: '600',
      FOREST_MCP_REFRESH_TOKEN_TTL_SECONDS: '7200',
      MCP_SERVER_PORT: '4000',
      FOREST_MCP_SERVER_URL: 'https://mcp.example.com',
    });

    expect(exit).not.toHaveBeenCalled();
    expect(Server).toHaveBeenCalledTimes(1);
    expect(Server).toHaveBeenCalledWith({
      forestServerUrl: 'https://api.example.com',
      forestAppUrl: 'https://app.example.com',
      envSecret: 'env-secret',
      authSecret: 'auth-secret',
      enabledTools: ['list', 'describeCollection'],
      allowedOAuthClients: ['claude.ai'],
      agentUrl: 'https://agent.example.com/',
      tokenTtl: { accessTokenSeconds: 600, refreshTokenSeconds: 7200 },
    });
    expect(Server.mock.results[0].value.run).toHaveBeenCalledWith();
  });

  it("passes fileUploads: false on FOREST_MCP_FILE_UPLOADS='false', module or not", async () => {
    const { Server } = await startCli({
      FOREST_MCP_FILE_UPLOADS: 'false',
      FOREST_MCP_UPLOAD_STORAGE_MODULE: './does-not-exist.js',
    });

    expect(Server).toHaveBeenCalledWith(expect.objectContaining({ fileUploads: false }));
  });

  it.each([
    [
      'FOREST_MCP_FILE_UPLOADS',
      '',
      `Invalid FOREST_MCP_FILE_UPLOADS "": use 'false' to turn action file uploads off.`,
    ],
    ['FOREST_MCP_FILE_UPLOADS', 'off', 'Invalid FOREST_MCP_FILE_UPLOADS "off"'],
    ['FOREST_MCP_ACCESS_TOKEN_TTL_SECONDS', '', 'Invalid tokenTtl.accessTokenSeconds "0"'],
    ['FOREST_MCP_REFRESH_TOKEN_TTL_SECONDS', '', 'Invalid tokenTtl.refreshTokenSeconds "0"'],
  ])('rejects %s=%j at startup', async (variable, value, message) => {
    const { exit, consoleError } = await startCli({
      FOREST_AUTH_SECRET: 'auth-secret',
      [variable]: value,
    });

    expect(consoleError).toHaveBeenCalledWith(
      '[FATAL] Server crashed:',
      expect.objectContaining({ message: expect.stringContaining(message) }),
    );
    expect(exit).toHaveBeenCalledWith(1);
  });
});

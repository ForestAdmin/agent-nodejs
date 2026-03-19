import dotenv from 'dotenv';

import { KNOWN_FLAGS, handleGenerateToken, parseArgs } from '../src/cli';
import { generateToken } from '../src/generate-token';

jest.mock('dotenv');
jest.mock('../src/generate-token');
jest.mock('../src/server', () =>
  jest.fn().mockImplementation(() => ({ run: jest.fn().mockResolvedValue(undefined) })),
);

const mockDotenvConfig = dotenv.config as jest.Mock;
const mockGenerateToken = generateToken as jest.Mock;

describe('parseArgs', () => {
  it('should parse --key value pairs', () => {
    expect(parseArgs(['--env-secret', 'abc', '--auth-secret', 'def'])).toEqual({
      'env-secret': 'abc',
      'auth-secret': 'def',
    });
  });

  it('should throw on unknown flags', () => {
    expect(() => parseArgs(['--unknown', 'val'])).toThrow('Unknown option: --unknown');
  });

  it('should throw on flag without value', () => {
    expect(() => parseArgs(['--env-secret'])).toThrow('Option --env-secret requires a value.');
  });

  it('should throw on flag followed by another flag', () => {
    expect(() => parseArgs(['--env-secret', '--auth-secret'])).toThrow(
      'Option --env-secret requires a value.',
    );
  });

  it('should throw on positional arguments', () => {
    expect(() => parseArgs(['some-arg'])).toThrow(
      'Unexpected argument: "some-arg". All options must use --flag value format.',
    );
  });

  it('should return empty object for empty args', () => {
    expect(parseArgs([])).toEqual({});
  });

  it('should accept all known flags', () => {
    const args: string[] = [];

    for (const flag of KNOWN_FLAGS) {
      args.push(`--${flag}`, 'val');
    }

    const result = parseArgs(args);
    expect(Object.keys(result)).toHaveLength(KNOWN_FLAGS.size);
  });
});

describe('handleGenerateToken', () => {
  const mockStdout = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  const mockStderr = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);

  beforeEach(() => {
    jest.clearAllMocks();
    mockDotenvConfig.mockReturnValue({});
  });

  afterAll(() => {
    mockStdout.mockRestore();
    mockStderr.mockRestore();
  });

  it('should call generateToken with parsed args', async () => {
    mockGenerateToken.mockResolvedValue({ token: 'mcp-token', warnings: [] });

    await handleGenerateToken(['--env-secret', 'abc', '--auth-secret', 'def', '--token', 'pat']);

    expect(mockGenerateToken).toHaveBeenCalledWith(
      expect.objectContaining({
        envSecret: 'abc',
        authSecret: 'def',
        token: 'pat',
      }),
    );
  });

  it('should write token to stdout', async () => {
    mockGenerateToken.mockResolvedValue({ token: 'my-token', warnings: [] });

    await handleGenerateToken(['--env-secret', 'a', '--auth-secret', 'b', '--token', 'c']);

    expect(mockStdout).toHaveBeenCalledWith('my-token\n');
  });

  it('should write warnings to stderr', async () => {
    mockGenerateToken.mockResolvedValue({ token: 'tok', warnings: ['warn1', 'warn2'] });

    await handleGenerateToken(['--env-secret', 'a', '--auth-secret', 'b', '--token', 'c']);

    expect(mockStderr).toHaveBeenCalledWith('warn1\n');
    expect(mockStderr).toHaveBeenCalledWith('warn2\n');
  });

  it('should load env file when --env-file is provided', async () => {
    mockDotenvConfig.mockReturnValue({ parsed: { FOREST_ENV_SECRET: 'x' } });
    mockGenerateToken.mockResolvedValue({ token: 'tok', warnings: [] });

    await handleGenerateToken(['--env-file', '/path/to/.env', '--token', 'pat']);

    expect(mockDotenvConfig).toHaveBeenCalledWith({ path: '/path/to/.env', override: true });
  });

  it('should throw if env file fails to load', async () => {
    mockDotenvConfig.mockReturnValue({ error: new Error('ENOENT: no such file') });

    await expect(handleGenerateToken(['--env-file', '/bad/path'])).rejects.toThrow(
      'Failed to load env file "/bad/path"',
    );
  });

  it('should not call dotenv.config when --env-file is not provided', async () => {
    mockGenerateToken.mockResolvedValue({ token: 'tok', warnings: [] });

    await handleGenerateToken(['--env-secret', 'a', '--auth-secret', 'b', '--token', 'c']);

    expect(mockDotenvConfig).not.toHaveBeenCalled();
  });

  it('should fall back to env vars when flags are not provided', async () => {
    const { env } = process;
    process.env = {
      ...env,
      FOREST_ENV_SECRET: 'env-secret',
      FOREST_AUTH_SECRET: 'env-auth',
      FOREST_PERSONAL_TOKEN: 'env-token',
      FOREST_RENDERING_ID: '42',
    };
    mockGenerateToken.mockResolvedValue({ token: 'tok', warnings: [] });

    await handleGenerateToken([]);

    expect(mockGenerateToken).toHaveBeenCalledWith(
      expect.objectContaining({
        envSecret: 'env-secret',
        authSecret: 'env-auth',
        token: 'env-token',
        renderingId: '42',
      }),
    );
    process.env = env;
  });

  it('should prefer CLI flags over env vars', async () => {
    const { env } = process;
    process.env = { ...env, FOREST_ENV_SECRET: 'from-env' };
    mockGenerateToken.mockResolvedValue({ token: 'tok', warnings: [] });

    await handleGenerateToken(['--env-secret', 'from-flag', '--auth-secret', 'b', '--token', 'c']);

    expect(mockGenerateToken).toHaveBeenCalledWith(
      expect.objectContaining({ envSecret: 'from-flag' }),
    );
    process.env = env;
  });
});

/* eslint-disable global-require */
describe('CLI top-level routing', () => {
  const originalArgv = process.argv;
  let mockStderr: jest.SpyInstance;
  let mockExit: jest.SpyInstance;

  beforeEach(() => {
    jest.resetModules();
    mockStderr = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    mockExit = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    process.argv = originalArgv;
    mockStderr.mockRestore();
    mockExit.mockRestore();
    jest.resetModules();
  });

  it('should reject unknown subcommands', () => {
    process.argv = ['node', 'cli.js', 'bad-command'];

    jest.doMock('../src/server', () => ({
      __esModule: true,
      default: jest.fn().mockImplementation(() => ({ run: jest.fn() })),
    }));
    jest.doMock('../src/generate-token', () => ({ generateToken: jest.fn() }));
    jest.doMock('dotenv', () => ({ config: jest.fn() }));

    require('../src/cli');

    expect(mockStderr).toHaveBeenCalledWith(
      expect.stringContaining('Unknown command: "bad-command"'),
    );
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('should start the server when no subcommand is given', () => {
    process.argv = ['node', 'cli.js'];

    const mockRun = jest.fn().mockResolvedValue(undefined);
    const MockServer = jest.fn().mockImplementation(() => ({ run: mockRun }));

    jest.doMock('../src/server', () => ({ __esModule: true, default: MockServer }));
    jest.doMock('../src/generate-token', () => ({ generateToken: jest.fn() }));
    jest.doMock('dotenv', () => ({ config: jest.fn() }));

    require('../src/cli');

    expect(MockServer).toHaveBeenCalled();
    expect(mockRun).toHaveBeenCalled();
  });

  it('should handle generate-token errors and exit with code 1', async () => {
    process.argv = ['node', 'cli.js', 'generate-token', '--env-secret', 'bad'];

    jest.doMock('../src/generate-token', () => ({
      generateToken: jest.fn().mockRejectedValue(new Error('test error')),
    }));
    jest.doMock('../src/server', () => ({
      __esModule: true,
      default: jest.fn().mockImplementation(() => ({ run: jest.fn() })),
    }));
    jest.doMock('dotenv', () => ({ config: jest.fn().mockReturnValue({}) }));

    require('../src/cli');

    await new Promise(resolve => {
      setTimeout(resolve, 50);
    });

    expect(mockStderr).toHaveBeenCalledWith('Error: test error\n');
    expect(mockExit).toHaveBeenCalledWith(1);
  });
});

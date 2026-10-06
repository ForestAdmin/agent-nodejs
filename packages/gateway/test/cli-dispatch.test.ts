import { mkdtempSync, readFileSync, rmSync } from 'fs';
import os from 'os';
import path from 'path';

import dispatchCli, { USAGE } from '../src/cli-dispatch';
import version from '../src/version';

const noopLogger = () => undefined;

describe('dispatchCli', () => {
  let stdout: jest.SpyInstance;
  let stderr: jest.SpyInstance;

  beforeEach(() => {
    stdout = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderr = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function writtenDocument(): { servers: { url: string }[] } {
    return JSON.parse(stdout.mock.calls.map(([chunk]) => chunk).join(''));
  }

  it.each([
    [{}, '/api'],
    [{ FOREST_GATEWAY_BASE_PATH: '/ai' }, '/ai/api'],
    [{ FOREST_GATEWAY_URL: 'https://gateway.example.com' }, 'https://gateway.example.com/api'],
    [
      { FOREST_GATEWAY_URL: 'https://gateway.example.com', FOREST_GATEWAY_BASE_PATH: '/ai' },
      'https://gateway.example.com/ai/api',
    ],
  ])('should announce the API server of %p as %s', async (env, url) => {
    const outcome = await dispatchCli(['openapi'], env, noopLogger);

    expect(outcome).toEqual({ exitCode: 0 });
    expect(writtenDocument().servers[0].url).toBe(url);
  });

  it('should ignore BFF_PUBLIC_URL in the document', async () => {
    await dispatchCli(['openapi'], { BFF_PUBLIC_URL: 'https://old.example.com' }, noopLogger);

    expect(writtenDocument().servers[0].url).toBe('/api');
  });

  it('should write the document to the --output file', async () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'gateway-openapi-'));
    const file = path.join(directory, 'doc.json');

    try {
      const outcome = await dispatchCli(['openapi', '--output', file], {}, noopLogger);

      expect(outcome).toEqual({ exitCode: 0 });
      expect(JSON.parse(readFileSync(file, 'utf8')).servers[0].url).toBe('/api');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('should print the usage on --help', async () => {
    expect(await dispatchCli(['--help'], {})).toEqual({ exitCode: 0 });
    expect(stdout).toHaveBeenCalledWith(`${USAGE}\n`);
  });

  it('should print the version on --version', async () => {
    expect(await dispatchCli(['--version'], {})).toEqual({ exitCode: 0 });
    expect(stdout).toHaveBeenCalledWith(`${version}\n`);
  });

  it('should reject an unknown command', async () => {
    expect(await dispatchCli(['serve'], {})).toEqual({ exitCode: 1 });
    expect(stderr).toHaveBeenCalledWith(
      "Unknown command: serve\nRun 'forest-gateway --help' for usage.\n",
    );
  });

  it('should reject extra openapi arguments', async () => {
    expect(await dispatchCli(['openapi', 'extra'], {})).toEqual({ exitCode: 1 });
    expect(stderr).toHaveBeenCalledWith(
      'openapi accepts only --output, got: "extra"\nRun \'forest-gateway --help\' for usage.\n',
    );
  });

  it('should refuse to start without FOREST_GATEWAY_SERVICES', async () => {
    await expect(dispatchCli([], {})).rejects.toThrow(/FOREST_GATEWAY_SERVICES.*"mcp", "api"/);
  });
});

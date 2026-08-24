import type BFFHttpServer from '../../src/http/bff-http-server';
import type { Logger } from '../../src/ports/logger-port';

import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'fs';
import http from 'http';
import jsonwebtoken from 'jsonwebtoken';
import { tmpdir } from 'os';
import path from 'path';
import request from 'supertest';

import dispatchCli, {
  DEFAULT_OUTPUT_FILE,
  HINT,
  USAGE,
  renderOpenApi,
} from '../../src/cli-dispatch';
import { issueBffAccessToken } from '../../src/oauth/bff-token';
import { OPENAPI_PATH } from '../../src/openapi/openapi-routes';
import version from '../../src/version';
import { action, collection, column, relation } from '../read-model/fixtures';

const SCHEMA = [
  collection(
    'users',
    [column('id'), column('email'), relation('orders', 'HasMany', 'orders.userId')],
    [action('Mark as paid', '/forest/users/actions/mark-as-paid')],
  ),
  collection('orders', [column('id')]),
];

const CAPABILITIES = { fields: [{ name: 'id', type: 'Number', operators: ['equal'] }] };

const fetchSchema = jest.fn().mockResolvedValue(SCHEMA);
const fetchCapabilities = jest.fn().mockResolvedValue(CAPABILITIES);
const mintedTokens: string[] = [];

jest.mock('../../src/read-model/forest-schema-client', () => ({
  __esModule: true,
  default: class {
    // eslint-disable-next-line class-methods-use-this
    fetchSchema() {
      return fetchSchema();
    }
  },
}));

// The token is resolved here rather than ignored, because the CLI is expected to hand over a factory
// that signs one per fetch — a single 5-minute token cannot cover a long fan-out.
jest.mock('../../src/read-model/agent-capabilities-fetcher', () => ({
  __esModule: true,
  default: ({ token }: { token: string | (() => string) }) => {
    mintedTokens.push(typeof token === 'function' ? token() : token);

    return fetchCapabilities;
  },
}));

const VALID_ENV = {
  FOREST_AUTH_SECRET: 'auth-secret',
  FOREST_ENV_SECRET: 'env-secret',
  FOREST_SERVER_URL: 'https://api.forestadmin.com',
  FOREST_APP_URL: 'https://app.forestadmin.com',
  AGENT_URL: 'https://agent.example.com',
  HTTP_PORT: '0',
} satisfies NodeJS.ProcessEnv;

const noopLogger: Logger = () => undefined;

describe('renderOpenApi', () => {
  beforeEach(() => {
    fetchSchema.mockReset().mockResolvedValue(SCHEMA);
    fetchCapabilities.mockReset().mockResolvedValue(CAPABILITIES);
    mintedTokens.length = 0;
  });

  it('should sign its own agent token, since a CLI has no caller to borrow one from', async () => {
    await renderOpenApi(VALID_ENV, noopLogger);

    expect(mintedTokens).toHaveLength(1);
    expect(jsonwebtoken.verify(mintedTokens[0], VALID_ENV.FOREST_AUTH_SECRET)).toEqual(
      expect.objectContaining({ email: 'openapi@agent-bff.forestadmin.com' }),
    );
  });

  it('should return a parseable OpenAPI 3.1 document', async () => {
    expect(JSON.parse(await renderOpenApi({}, noopLogger)).openapi).toBe('3.1.0');
  });

  it('should end with a newline, so the output pipes cleanly', async () => {
    expect((await renderOpenApi({}, noopLogger)).endsWith('\n')).toBe(true);
  });

  it('should emit the generic document when nothing is configured to unfold against', async () => {
    const document = JSON.parse(await renderOpenApi({}, noopLogger));

    expect(Object.keys(document.paths)).toHaveLength(7);
    expect(document.info.description).toContain('Paths are generic');
  });

  it('should omit the ai relay, since the export cannot know whether OAuth is configured', async () => {
    const document = JSON.parse(await renderOpenApi(VALID_ENV, noopLogger));

    expect(Object.keys(document.paths)).not.toContain('/agent/v1/ai/query');
  });

  it('should unfold when the deployment is configured, without borrowing a caller token', async () => {
    const document = JSON.parse(await renderOpenApi(VALID_ENV, noopLogger));

    expect(Object.keys(document.paths).sort()).toEqual([
      '/agent/v1/context',
      '/agent/v1/orders/count',
      '/agent/v1/orders/list',
      '/agent/v1/users/actions/Mark%20as%20paid/execute',
      '/agent/v1/users/actions/Mark%20as%20paid/form',
      '/agent/v1/users/count',
      '/agent/v1/users/list',
      '/agent/v1/users/relations/orders/count',
      '/agent/v1/users/relations/orders/list',
    ]);
    expect(document.info.description).toContain('Paths are unfolded');
  });

  it('should fail rather than degrade when a configured deployment cannot be read', async () => {
    fetchSchema.mockRejectedValueOnce(new Error('forest server is down'));

    await expect(renderOpenApi(VALID_ENV, noopLogger)).rejects.toThrow();
  });

  it('should fail when not one collection could be described, since CI has nothing to branch on', async () => {
    fetchCapabilities.mockRejectedValue(new Error('agent is down'));

    await expect(renderOpenApi(VALID_ENV, noopLogger)).rejects.toThrow(
      /No collection could be described/,
    );
  });

  it('should still emit the document when only one collection is degraded', async () => {
    fetchCapabilities.mockImplementation(async (name: string) => {
      if (name === 'orders') throw new Error('agent is down');

      return { fields: [{ name: 'id', type: 'Number', operators: ['equal'] }] };
    });

    const document = JSON.parse(await renderOpenApi(VALID_ENV, noopLogger));

    expect(Object.keys(document.paths)).toContain('/agent/v1/orders/list');
    expect(document.components.schemas.Fields_users).toBeDefined();
  });

  it('should stay generic when the auth secret is there but the agent url is not', async () => {
    const document = JSON.parse(
      await renderOpenApi({ ...VALID_ENV, AGENT_URL: undefined }, noopLogger),
    );

    expect(Object.keys(document.paths)).toHaveLength(7);
    expect(fetchSchema).not.toHaveBeenCalled();
  });

  it('should ignore a broken server-only setting, which the export does not use', async () => {
    const document = JSON.parse(await renderOpenApi({ HTTP_PORT: 'nope' }, noopLogger));

    expect(Object.keys(document.paths)).toHaveLength(7);
  });

  it('should still reject a broken setting once the deployment asks to be unfolded', async () => {
    await expect(renderOpenApi({ ...VALID_ENV, HTTP_PORT: 'nope' }, noopLogger)).rejects.toThrow(
      /HTTP_PORT/,
    );
  });
});

describe('dispatchCli', () => {
  describe('when the openapi subcommand is given', () => {
    it('should emit the document, exit 0, and never bind a socket', async () => {
      const stdout = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
      const listen = jest.spyOn(http.Server.prototype, 'listen');

      try {
        const outcome = await dispatchCli(['openapi'], {}, noopLogger);

        expect(outcome).toEqual({ exitCode: 0 });
        expect(JSON.parse(stdout.mock.calls[0][0] as string).openapi).toBe('3.1.0');
        expect(listen).not.toHaveBeenCalled();
      } finally {
        listen.mockRestore();
        stdout.mockRestore();
      }
    });

    it('should fall back to the console logger when the caller passes none, as the bin does', async () => {
      const stdout = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
      const stderr = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
      // Silenced because jest buffers console output and flushes it to process.stdout, which the spy
      // would otherwise pick up ahead of the document.
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

      try {
        const outcome = await dispatchCli(['openapi'], {});

        expect(outcome).toEqual({ exitCode: 0 });
        expect(JSON.parse(stdout.mock.calls[0][0] as string).openapi).toBe('3.1.0');
        expect(warn).toHaveBeenCalled();
      } finally {
        stdout.mockRestore();
        stderr.mockRestore();
        warn.mockRestore();
      }
    });

    // The redirected form is the one that breaks: `console.info` writes to the same stream as the
    // document, so a single Info log makes `> openapi.json` produce a file JSON.parse rejects. Runs
    // with the REAL console logger on purpose — passing a noop one is what hid this.
    it('should leave stdout parseable when unfolding, whatever it logs on the way', async () => {
      const written: string[] = [];
      const stdout = jest
        .spyOn(process.stdout, 'write')
        .mockImplementation(chunk => written.push(String(chunk)) > 0);
      const stderr = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);

      try {
        const outcome = await dispatchCli(['openapi'], VALID_ENV);

        expect(outcome).toEqual({ exitCode: 0 });
        expect(() => JSON.parse(written.join(''))).not.toThrow();
        expect(JSON.parse(written.join('')).info.description).toContain('Paths are unfolded');
      } finally {
        stdout.mockRestore();
        stderr.mockRestore();
      }
    });

    it('should emit the document with no configuration at all, since export needs none', async () => {
      const stdout = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

      try {
        await dispatchCli(['openapi'], {}, noopLogger);

        const document = JSON.parse(stdout.mock.calls[0][0] as string);

        expect(Object.keys(document.paths)).toHaveLength(7);
      } finally {
        stdout.mockRestore();
      }
    });

    it('should still emit the document when BFF_OPENAPI_ENABLED is false, since the flag only gates HTTP', async () => {
      const stdout = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

      try {
        const outcome = await dispatchCli(
          ['openapi'],
          { BFF_OPENAPI_ENABLED: 'false' },
          noopLogger,
        );

        expect(outcome).toEqual({ exitCode: 0 });
        expect(JSON.parse(stdout.mock.calls[0][0] as string).openapi).toBe('3.1.0');
      } finally {
        stdout.mockRestore();
      }
    });
  });

  describe('when the export is piped to a file or another tool', () => {
    it('should write nothing to stdout but the document, since console.info also targets stdout', async () => {
      const stdout = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
      const info = jest.spyOn(console, 'info').mockImplementation(() => undefined);

      try {
        await dispatchCli(['openapi'], {}, noopLogger);

        expect(info).not.toHaveBeenCalled();
        expect(stdout).toHaveBeenCalledTimes(1);
      } finally {
        stdout.mockRestore();
        info.mockRestore();
      }
    });
  });

  describe('when no subcommand is given', () => {
    it('should boot the server, preserving the packaged bin behavior', async () => {
      const outcome = await dispatchCli([], VALID_ENV, noopLogger);

      try {
        expect(outcome.exitCode).toBe(0);
        expect(outcome.server).toBeDefined();
      } finally {
        await outcome.server?.stop();
      }
    });
  });

  describe.each([
    ['--help', '--help'],
    ['-h', '-h'],
  ])('when %s is given', (_, flag) => {
    it('should print usage on stdout and exit 0, as POSIX expects for a help request', async () => {
      const stdout = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
      const stderr = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);

      try {
        const outcome = await dispatchCli([flag], {}, noopLogger);

        expect(outcome).toEqual({ exitCode: 0 });
        expect(stdout.mock.calls.map(call => call[0]).join('')).toBe(`${USAGE}\n`);
        expect(stderr).not.toHaveBeenCalled();
      } finally {
        stdout.mockRestore();
        stderr.mockRestore();
      }
    });
  });

  describe.each([
    ['--version', '--version'],
    ['-v', '-v'],
  ])('when %s is given', (_, flag) => {
    it('should print the bare version on stdout and exit 0', async () => {
      const stdout = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

      try {
        const outcome = await dispatchCli([flag], {}, noopLogger);
        const printed = stdout.mock.calls.map(call => call[0]).join('');

        expect(outcome).toEqual({ exitCode: 0 });
        expect(printed).toBe(`${version}\n`);
      } finally {
        stdout.mockRestore();
      }
    });
  });

  describe('when a command fails', () => {
    it('should point at --help rather than dump the whole usage on stderr', async () => {
      const stderr = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);

      try {
        await dispatchCli(['bogus'], {}, noopLogger);
        const written = stderr.mock.calls.map(call => call[0]).join('');

        expect(written).toBe(`Unknown command: bogus\n${HINT}\n`);
        expect(written.split('\n')).toHaveLength(3);
      } finally {
        stderr.mockRestore();
      }
    });
  });

  describe('when openapi is given extra arguments', () => {
    it('should name the extra arguments rather than echo the whole command line', async () => {
      const stderr = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
      const stdout = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

      try {
        const outcome = await dispatchCli(['openapi', 'extra', 'more'], {}, noopLogger);

        expect(outcome).toEqual({ exitCode: 1 });
        expect(stderr.mock.calls.map(call => call[0]).join('')).toBe(
          `openapi accepts only --output, got: "extra" "more"\n${HINT}\n`,
        );
        expect(stdout).not.toHaveBeenCalled();
      } finally {
        stderr.mockRestore();
        stdout.mockRestore();
      }
    });
  });

  describe.each([
    ['--help', '--help'],
    ['--version', '--version'],
  ])('when %s is given an extra argument', (_, flag) => {
    it('should still answer and exit 0, since GNU tools ignore what follows a help request', async () => {
      const stdout = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
      const stderr = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);

      try {
        const outcome = await dispatchCli([flag, 'extra'], {}, noopLogger);

        expect(outcome).toEqual({ exitCode: 0 });
        expect(stdout).toHaveBeenCalled();
        expect(stderr).not.toHaveBeenCalled();
      } finally {
        stdout.mockRestore();
        stderr.mockRestore();
      }
    });
  });

  describe('when an unknown subcommand is given', () => {
    it('should exit non-zero with the usage line on stderr', async () => {
      const stderr = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);

      try {
        const outcome = await dispatchCli(['bogus'], {}, noopLogger);

        expect(outcome).toEqual({ exitCode: 1 });
        expect(stderr.mock.calls.map(call => call[0]).join('')).toBe(
          `Unknown command: bogus\n${HINT}\n`,
        );
      } finally {
        stderr.mockRestore();
      }
    });

    it('should report it as unknown even with extra arguments, not as taking none', async () => {
      const stderr = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);

      try {
        const outcome = await dispatchCli(['bogus', 'extra'], {}, noopLogger);

        expect(outcome).toEqual({ exitCode: 1 });
        expect(stderr.mock.calls.map(call => call[0]).join('')).toBe(
          `Unknown command: bogus\n${HINT}\n`,
        );
      } finally {
        stderr.mockRestore();
      }
    });

    it('should not emit a document, so a typo never looks like a successful export', async () => {
      const stdout = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
      const stderr = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);

      try {
        await dispatchCli(['bogus'], {}, noopLogger);

        expect(stdout).not.toHaveBeenCalled();
      } finally {
        stdout.mockRestore();
        stderr.mockRestore();
      }
    });
  });
});

describe('dispatchCli --output', () => {
  let directory: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    directory = realpathSync(mkdtempSync(path.join(tmpdir(), 'bff-output-')));
    process.chdir(directory);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(directory, { recursive: true, force: true });
  });

  function expectedDocument(): Promise<string> {
    return renderOpenApi({}, noopLogger);
  }

  async function exportQuietly(argv: string[]) {
    const stderr = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);

    try {
      return await dispatchCli(argv, {}, noopLogger);
    } finally {
      stderr.mockRestore();
    }
  }

  describe('when --output is given with no value', () => {
    it(`should write ${DEFAULT_OUTPUT_FILE} in the current directory and keep stdout empty`, async () => {
      const stdout = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
      const stderr = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);

      try {
        const outcome = await dispatchCli(['openapi', '--output'], {}, noopLogger);

        expect(outcome).toEqual({ exitCode: 0 });
        expect(readFileSync(path.join(directory, DEFAULT_OUTPUT_FILE), 'utf8')).toBe(
          await expectedDocument(),
        );
        expect(stdout).not.toHaveBeenCalled();
      } finally {
        stdout.mockRestore();
        stderr.mockRestore();
      }
    });

    it('should confirm on stderr where the document landed, keeping stdout pipeable', async () => {
      const stdout = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
      const stderr = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);

      try {
        await dispatchCli(['openapi', '--output'], {}, noopLogger);

        expect(stderr.mock.calls.map(call => call[0]).join('')).toBe(
          `Wrote the OpenAPI document to ${path.join(directory, DEFAULT_OUTPUT_FILE)}\n`,
        );
        expect(stdout).not.toHaveBeenCalled();
      } finally {
        stdout.mockRestore();
        stderr.mockRestore();
      }
    });
  });

  describe('when --output is given a path', () => {
    it('should write the document there rather than to the default name', async () => {
      const target = path.join(directory, 'nested-name.json');

      const outcome = await dispatchCli(['openapi', '--output', target], {}, noopLogger);

      expect(outcome).toEqual({ exitCode: 0 });
      expect(readFileSync(target, 'utf8')).toBe(await expectedDocument());
    });

    it(`should treat a trailing slash as a directory and write ${DEFAULT_OUTPUT_FILE} inside it`, async () => {
      const outcome = await exportQuietly(['openapi', '--output', 'build/']);

      expect(outcome).toEqual({ exitCode: 0 });
      expect(readFileSync(path.join(directory, 'build', DEFAULT_OUTPUT_FILE), 'utf8')).toBe(
        await expectedDocument(),
      );
    });

    it('should create a missing parent directory, so a CI path needs no mkdir first', async () => {
      const target = path.join(directory, 'docs', 'nested', 'api.json');

      const outcome = await exportQuietly(['openapi', '--output', target]);

      expect(outcome).toEqual({ exitCode: 0 });
      expect(readFileSync(target, 'utf8')).toBe(await expectedDocument());
    });

    it('should resolve a relative path against the current directory', async () => {
      const outcome = await exportQuietly(['openapi', '--output', 'relative.json']);

      expect(outcome).toEqual({ exitCode: 0 });
      expect(readFileSync(path.join(directory, 'relative.json'), 'utf8')).toBe(
        await expectedDocument(),
      );
    });
  });

  describe('when the destination already holds a file', () => {
    it('should overwrite it, since an export is expected to refresh the document', async () => {
      const target = path.join(directory, 'stale.json');
      writeFileSync(target, '{"openapi":"stale"}');

      const outcome = await exportQuietly(['openapi', '--output', target]);

      expect(outcome).toEqual({ exitCode: 0 });
      expect(readFileSync(target, 'utf8')).toBe(await expectedDocument());
    });
  });

  describe('when the token after --output starts with a dash', () => {
    it('should reject it as an extra and write nothing, never a file named after a flag', async () => {
      const stderr = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);

      try {
        const outcome = await dispatchCli(['openapi', '--output', '--help'], {}, noopLogger);

        expect(outcome).toEqual({ exitCode: 1 });
        expect(stderr.mock.calls.map(call => call[0]).join('')).toBe(
          `openapi accepts only --output, got: "--help"\n${HINT}\n`,
        );
        expect(() => readFileSync(path.join(directory, '--help'))).toThrow();
        expect(() => readFileSync(path.join(directory, DEFAULT_OUTPUT_FILE))).toThrow();
      } finally {
        stderr.mockRestore();
      }
    });
  });

  describe.each([
    ['an equals form', ['openapi', '--output=out.json'], '--output=out.json'],
    ['a doubled flag', ['openapi', '--output', 'a.json', '--output'], '--output'],
    ['an empty destination', ['openapi', '--output', ''], ''],
  ])('when %s is used', (_, argv, reported) => {
    it('should reject it, since the parser accepts one --output with a plain value', async () => {
      const stderr = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);

      try {
        const outcome = await dispatchCli(argv, {}, noopLogger);

        expect(outcome).toEqual({ exitCode: 1 });
        expect(stderr.mock.calls.map(call => call[0]).join('')).toBe(
          `openapi accepts only --output, got: ${JSON.stringify(reported)}\n${HINT}\n`,
        );
      } finally {
        stderr.mockRestore();
      }
    });
  });

  describe('when the destination cannot be written', () => {
    it('should name the path and exit 1 without leaking a stack trace', async () => {
      const stderr = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);

      try {
        const outcome = await dispatchCli(['openapi', '--output', directory], {}, noopLogger);
        const written = stderr.mock.calls.map(call => call[0]).join('');

        expect(outcome).toEqual({ exitCode: 1 });
        expect(written).toContain(`Cannot write ${directory}: `);
        expect(written).not.toContain('at ');
        expect(written).not.toContain(HINT);
      } finally {
        stderr.mockRestore();
      }
    });
  });

  describe('when --output is used as the command itself', () => {
    it('should say it belongs to openapi rather than report an unknown command', async () => {
      const stderr = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);

      try {
        const outcome = await dispatchCli(['--output'], {}, noopLogger);

        expect(outcome).toEqual({ exitCode: 1 });
        expect(stderr.mock.calls.map(call => call[0]).join('')).toBe(
          `--output only applies to the openapi command\n${HINT}\n`,
        );
        expect(() => readFileSync(path.join(directory, DEFAULT_OUTPUT_FILE))).toThrow();
      } finally {
        stderr.mockRestore();
      }
    });
  });

  describe('when no --output is given', () => {
    it('should keep writing to stdout and create no file', async () => {
      const stdout = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

      try {
        const outcome = await dispatchCli(['openapi'], {}, noopLogger);

        expect(outcome).toEqual({ exitCode: 0 });
        expect(stdout).toHaveBeenCalledTimes(1);
        expect(() => readFileSync(path.join(directory, DEFAULT_OUTPUT_FILE))).toThrow();
      } finally {
        stdout.mockRestore();
      }
    });
  });
});

describe('the CLI export and the HTTP route', () => {
  it('should produce the same document, since both use one generator', async () => {
    const exported = await renderOpenApi(VALID_ENV, noopLogger);

    const outcome = await dispatchCli([], VALID_ENV, noopLogger);

    expect(outcome.server).toBeDefined();

    try {
      const response = await request((outcome.server as BFFHttpServer).callback)
        .get(OPENAPI_PATH)
        .set(
          'Authorization',
          `Bearer ${issueBffAccessToken({
            sid: 'session-1',
            user: {
              id: 1,
              email: 'user@example.com',
              firstName: 'Ada',
              lastName: 'Lovelace',
              team: 'Operations',
              permissionLevel: 'admin',
              role: 'admin',
              tags: {},
              renderingId: 1,
            },
            renderingId: 1,
            authSecret: VALID_ENV.FOREST_AUTH_SECRET,
            expiresInSeconds: 900,
          })}`,
        );

      expect(exported).toBe(`${response.text}\n`);
    } finally {
      await outcome.server?.stop();
    }
  });
});

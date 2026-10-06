import type { FakeForestServer } from './helpers/fake-forest-server';
import type { ChildProcess } from 'child_process';

import { spawn } from 'child_process';
import net from 'net';
import path from 'path';

import startFakeForestServer from './helpers/fake-forest-server';
import { gatewayEnv, getAvailablePort } from './helpers/gateway-env';

const CLI = path.resolve(__dirname, '../src/cli.ts');
const SHUTDOWN_TIMEOUT_MS = 10_000;
const SLOW_TEST_TIMEOUT_MS = 30_000;
const TOKEN_BODY = 'grant_type=authorization_code';

interface SpawnedGateway {
  port: number;
  child: ChildProcess;
  output: () => string;
  exited: Promise<{ code: number | null; elapsedMs: number }>;
}

let forest: FakeForestServer;

beforeAll(async () => {
  forest = await startFakeForestServer();
});

afterAll(async () => {
  await forest.close();
});

async function spawnGateway(): Promise<SpawnedGateway> {
  const port = await getAvailablePort();
  const child = spawn(process.execPath, ['-r', 'ts-node/register/transpile-only', CLI], {
    env: { PATH: process.env.PATH, ...gatewayEnv(forest.url, port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  let signalledAt = 0;

  child.stdout?.on('data', chunk => {
    output += chunk;
  });
  child.stderr?.on('data', chunk => {
    output += chunk;
  });

  const originalKill = child.kill.bind(child);

  child.kill = (signal?: NodeJS.Signals | number) => {
    signalledAt ||= Date.now();

    return originalKill(signal);
  };

  const exited = new Promise<{ code: number | null; elapsedMs: number }>(resolve => {
    child.on('exit', code => resolve({ code, elapsedMs: Date.now() - signalledAt }));
  });

  await new Promise<void>((resolve, reject) => {
    const poll = setInterval(() => {
      if (output.includes('Forest Gateway started')) {
        clearInterval(poll);
        resolve();
      }
    }, 50);

    child.on('exit', code => {
      clearInterval(poll);
      reject(new Error(`The gateway exited before listening (${code}): ${output}`));
    });
  });

  return { port, child, output: () => output, exited };
}

function openTokenRequest(port: number): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const socket = net.connect(port, '127.0.0.1', () => {
      socket.write(
        'POST /oauth/token?service=api HTTP/1.1\r\n' +
          'Host: 127.0.0.1\r\n' +
          'Content-Type: application/x-www-form-urlencoded\r\n' +
          `Content-Length: ${TOKEN_BODY.length}\r\n` +
          'Connection: close\r\n\r\n' +
          `${TOKEN_BODY.slice(0, 5)}`,
      );
      resolve(socket);
    });

    socket.on('error', reject);
  });
}

function readResponse(socket: net.Socket): Promise<string> {
  return new Promise(resolve => {
    let response = '';

    socket.on('data', chunk => {
      response += chunk;
    });
    socket.on('close', () => resolve(response));
  });
}

function wait(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

describe('forest-gateway shutdown', () => {
  it.each(['SIGTERM', 'SIGINT'] as NodeJS.Signals[])(
    'should exit 0 on %s',
    async signal => {
      const gateway = await spawnGateway();

      gateway.child.kill(signal);
      const { code, elapsedMs } = await gateway.exited;

      expect(code).toBe(0);
      expect(elapsedMs).toBeLessThan(SHUTDOWN_TIMEOUT_MS);
    },
    SLOW_TEST_TIMEOUT_MS,
  );

  it.each([
    ['SIGTERM', 'SIGTERM'],
    ['SIGTERM', 'SIGINT'],
  ] as NodeJS.Signals[][])(
    'should stop once on %s then %s',
    async (first, second) => {
      const gateway = await spawnGateway();
      const socket = await openTokenRequest(gateway.port);

      await wait(200);
      gateway.child.kill(first);
      await wait(200);
      gateway.child.kill(second);
      await wait(200);
      socket.write(TOKEN_BODY.slice(5));
      const { code } = await gateway.exited;

      expect(code).toBe(0);
      expect(gateway.output().match(/Stopping the Forest Gateway/g)).toHaveLength(1);
      expect(gateway.output()).toContain(
        'Ignoring the signal: the Forest Gateway is already stopping',
      );
    },
    SLOW_TEST_TIMEOUT_MS,
  );

  it(
    'should let an in-flight API request finish before exiting',
    async () => {
      const gateway = await spawnGateway();
      const socket = await openTokenRequest(gateway.port);
      const response = readResponse(socket);

      await wait(200);
      gateway.child.kill('SIGTERM');
      await wait(200);
      socket.write(TOKEN_BODY.slice(5));

      expect(await response).toMatch(/^HTTP\/1\.1 400 /);
      expect((await gateway.exited).code).toBe(0);
    },
    SLOW_TEST_TIMEOUT_MS,
  );

  it(
    'should close a request still open past the shutdown deadline',
    async () => {
      const gateway = await spawnGateway();
      const socket = await openTokenRequest(gateway.port);
      const response = readResponse(socket);

      await wait(200);
      gateway.child.kill('SIGTERM');
      const { code, elapsedMs } = await gateway.exited;

      expect(code).toBe(0);
      expect(elapsedMs).toBeGreaterThanOrEqual(SHUTDOWN_TIMEOUT_MS);
      expect(await response).toBe('');
      expect(gateway.output()).toContain('Forcing the Forest Gateway shutdown');
    },
    SLOW_TEST_TIMEOUT_MS,
  );
});

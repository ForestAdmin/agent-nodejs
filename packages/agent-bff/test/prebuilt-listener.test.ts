import type { Logger } from '../src/index';

import http from 'http';
import request from 'supertest';

import {
  BFFHttpServer,
  buildBff,
  installShutdownHandlers,
  parseConfig,
  renderOpenApi,
  version,
} from '../src/index';
import { restoreFetchAfterEach, stubEnvironmentIdFetch } from './helpers/fetch-stub';

const VALID_ENV = {
  FOREST_AUTH_SECRET: 'auth-secret',
  FOREST_ENV_SECRET: 'env-secret',
  FOREST_SERVER_URL: 'https://api.forestadmin.com',
  FOREST_APP_URL: 'https://app.forestadmin.com',
  AGENT_URL: 'https://agent.example.com',
  BFF_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32).toString('base64'),
} satisfies NodeJS.ProcessEnv;

const GATEWAY_VERSION = '7.7.7';

const SIGNALS: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];

const noopLogger: Logger = () => undefined;

function requestAnything(port: number): Promise<{ status?: number; body: string }> {
  return new Promise((resolve, reject) => {
    http
      .get(`http://127.0.0.1:${port}/anything`, res => {
        let body = '';
        res.on('data', chunk => {
          body += chunk;
        });
        res.on('end', () => resolve({ status: res.statusCode, body }));
      })
      .on('error', reject);
  });
}

describe('prebuilt listener surface of the package entry point', () => {
  restoreFetchAfterEach();

  beforeEach(() => stubEnvironmentIdFetch());

  describe('BFFHttpServer with a prebuilt callback and no config', () => {
    let server: BFFHttpServer | undefined;

    afterEach(async () => {
      await server?.stop();
      server = undefined;
    });

    it('should listen and serve the callback', async () => {
      let port = 0;
      server = new BFFHttpServer({
        port: 0,
        logger: (_level, _message, context) => {
          port = Number(context?.port);
        },
        callback: (_req, res) => {
          res.statusCode = 418;
          res.end('teapot');
        },
      });

      await server.start();
      const response = await requestAnything(port);

      expect(response).toEqual({ status: 418, body: 'teapot' });
    });
  });

  describe('BFFHttpServer name', () => {
    async function startAndStop(name?: string): Promise<string[]> {
      const messages: string[] = [];

      const logger: Logger = (_level, message) => {
        messages.push(message);
      };

      const server = new BFFHttpServer({
        port: 0,
        logger,
        callback: (_req, res) => {
          res.end();
        },
        drainActivityLogs: async () => ['transition'],
        ...(name ? { name } : {}),
      });

      await server.start();
      await server.stop();

      return messages;
    }

    it('should log the given name when it starts and stops', async () => {
      const messages = await startAndStop('Forest Gateway');

      expect(messages).toEqual([
        'Forest Gateway started',
        'Stopped the Forest Gateway with activity logs still in flight',
      ]);
    });

    it('should log "Forest BFF" when no name is given, which the image smoke test greps', async () => {
      const messages = await startAndStop();

      expect(messages).toEqual([
        'Forest BFF started',
        'Stopped the Forest BFF with activity logs still in flight',
      ]);
    });
  });

  describe('buildBff health()', () => {
    it.each([
      ['healthy', VALID_ENV, 200],
      ['degraded', { ...VALID_ENV, AGENT_URL: undefined }, 503],
      ['key-only', { ...VALID_ENV, BFF_TOKEN_ENCRYPTION_KEY: undefined }, 200],
    ])(
      'should equal the status and configured of GET and HEAD /health on a %s config',
      async (_label, env, httpStatus) => {
        const bff = await buildBff({ config: parseConfig(env), logger: noopLogger });

        const get = await request(bff.callback).get('/health');
        const head = await request(bff.callback).head('/health');

        expect(bff.health()).toEqual({ status: get.body.status, configured: get.body.configured });
        expect(get.status).toBe(httpStatus);
        expect(head.status).toBe(httpStatus);
      },
    );
  });

  describe('buildBff health() result', () => {
    it('should not let a caller change what /health answers', async () => {
      const bff = await buildBff({ config: parseConfig(VALID_ENV), logger: noopLogger });

      const exposed = bff.health();
      exposed.status = 'degraded';
      exposed.configured.oauth = false;
      const response = await request(bff.callback).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(expect.objectContaining({ status: 'ok' }));
      expect(response.body.configured.oauth).toBe(true);
    });
  });

  describe('installShutdownHandlers', () => {
    let installed: { signal: NodeJS.Signals; handler: () => void }[] = [];

    function install(stop: () => Promise<void>, logger: Logger = noopLogger): void {
      installShutdownHandlers({ stop }, logger);
      installed = SIGNALS.map(signal => ({
        signal,
        handler: process.listeners(signal).at(-1) as () => void,
      }));
    }

    function send(signal: NodeJS.Signals): void {
      installed.find(entry => entry.signal === signal)?.handler();
    }

    afterEach(() => {
      for (const { signal, handler } of installed) process.removeListener(signal, handler);
      installed = [];
    });

    it.each([
      ['SIGTERM', 'SIGTERM'],
      ['SIGTERM', 'SIGINT'],
    ] as [NodeJS.Signals, NodeJS.Signals][])(
      'should call stop() once on %s then %s',
      (first, second) => {
        const stop = jest.fn(() => new Promise<void>(jest.fn()));

        install(stop);
        send(first);
        send(second);

        expect(stop).toHaveBeenCalledTimes(1);
      },
    );

    it('should still call stop() once when the second signal lands after it resolved', async () => {
      const stop = jest.fn(async () => undefined);

      install(stop);
      send('SIGTERM');
      await stop.mock.results[0].value;
      send('SIGINT');

      expect(stop).toHaveBeenCalledTimes(1);
    });

    it('should log a stop() that throws synchronously instead of letting it escape', async () => {
      const logger = jest.fn();

      install(() => {
        throw new Error('boom');
      }, logger as unknown as Logger);

      expect(() => send('SIGTERM')).not.toThrow();
      await new Promise(setImmediate);
      expect(logger).toHaveBeenCalledWith('Error', 'The Forest BFF did not stop cleanly', {
        cause: 'boom',
      });
    });

    it('should log the signal it ignores while stopping', () => {
      const logger = jest.fn();

      install(() => new Promise<void>(jest.fn()), logger as unknown as Logger);
      send('SIGTERM');
      send('SIGINT');

      expect(logger).toHaveBeenCalledWith(
        'Info',
        'Ignoring the signal: the Forest BFF is already stopping',
        { signal: 'SIGINT' },
      );
    });

    it('should log the given name', () => {
      const logger = jest.fn();

      installShutdownHandlers(
        { stop: () => new Promise<void>(jest.fn()) },
        logger as unknown as Logger,
        { name: 'Forest Gateway' },
      );
      installed = SIGNALS.map(signal => ({
        signal,
        handler: process.listeners(signal).at(-1) as () => void,
      }));
      send('SIGTERM');

      expect(logger).toHaveBeenCalledWith('Info', 'Stopping the Forest Gateway', {
        signal: 'SIGTERM',
      });
    });
  });

  describe('buildBff gatewayVersion', () => {
    it('should set X-Forest-Gateway-Version once and leave X-Forest-Bff-Version alone', async () => {
      const { callback } = await buildBff({
        config: parseConfig(VALID_ENV),
        logger: noopLogger,
        gatewayVersion: GATEWAY_VERSION,
      });

      for (const path of ['/health', '/unknown-path', '/agent/v1/companies/list']) {
        // eslint-disable-next-line no-await-in-loop
        const response = await request(callback).get(path);

        expect(response.headers['x-forest-gateway-version']).toBe(GATEWAY_VERSION);
        expect(response.headers['x-forest-bff-version']).toBe(version);
      }
    });

    it('should set no X-Forest-Gateway-Version for an empty gatewayVersion', async () => {
      const { callback } = await buildBff({
        config: parseConfig(VALID_ENV),
        logger: noopLogger,
        gatewayVersion: '',
      });

      const response = await request(callback).get('/health');

      expect(response.headers).not.toHaveProperty('x-forest-gateway-version');
    });

    it('should set no X-Forest-Gateway-Version without the option', async () => {
      const { callback } = await buildBff({ config: parseConfig(VALID_ENV), logger: noopLogger });

      const response = await request(callback).get('/health');

      expect(response.headers).not.toHaveProperty('x-forest-gateway-version');
      expect(response.headers['x-forest-bff-version']).toBe(version);
    });
  });

  describe('renderOpenApi', () => {
    it('should emit basePath as the relative server when no public url is set', async () => {
      const document = JSON.parse(await renderOpenApi({}, noopLogger, { basePath: '/api' }));

      expect(document.servers[0].url).toBe('/api');
    });

    it('should emit the root-relative server forest-bff openapi emits when given no option', async () => {
      const document = JSON.parse(await renderOpenApi({}, noopLogger));

      expect(document.servers).toEqual([
        {
          url: '/',
          description:
            'Resolved against the URL this document was fetched from. Set BFF_PUBLIC_URL on the ' +
            'deployment to publish its absolute base URL here instead, which a client generated ' +
            'from an offline export needs.',
        },
      ]);
    });
  });
});

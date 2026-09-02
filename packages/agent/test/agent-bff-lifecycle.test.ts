/* eslint-disable @typescript-eslint/no-explicit-any */
import type { IncomingMessage, ServerResponse } from 'http';

import { DataSourceCustomizer } from '@forestadmin/datasource-customizer';

import * as factories from './__factories__';
import Agent from '../src/agent';

const mockMakeRoutes = jest.fn();

jest.mock('../src/routes', () => ({
  __esModule: true,
  default: (...args) => mockMakeRoutes(...args),
}));

jest.mock('@forestadmin/datasource-customizer');

const mockBuildBff = jest.fn();
const mockParseConfig = jest.fn();
const mockInvalidate = jest.fn();
const mockBffCallback = jest.fn();

jest.mock('@forestadmin/agent-bff', () => ({
  __esModule: true,
  IN_PROCESS_AGENT_URL: 'http://in-process.agent',
  parseConfig: (env: unknown) => mockParseConfig(env),
  buildBff: (options: unknown) => mockBuildBff(options),
}));

function responseSpy() {
  const response = {
    statusCode: 200,
    setHeader: jest.fn(),
    end: jest.fn(),
  };

  return response as unknown as ServerResponse & { end: jest.Mock; statusCode: number };
}

function requestFor(url: string) {
  return { url } as unknown as IncomingMessage & { originalUrl?: string };
}

function bodyOf(response: { end: jest.Mock }) {
  return JSON.parse(response.end.mock.calls[0][0] as string);
}

function bffHandlerOf(agent: Agent) {
  return (agent as any).rootMiddleware.handlers.get('bff').callback;
}

beforeEach(() => {
  jest.clearAllMocks();

  mockMakeRoutes.mockReturnValue([{ setupRoutes: jest.fn(), bootstrap: jest.fn() }]);
  mockParseConfig.mockReturnValue({ agentTimeoutMs: 10_000 });
  mockBuildBff.mockResolvedValue({ callback: mockBffCallback, invalidate: mockInvalidate });
  jest
    .mocked(DataSourceCustomizer.prototype.getDataSource)
    .mockResolvedValue(factories.dataSource.build());
});

function buildAgent() {
  return new Agent(factories.forestAdminHttpDriverOptions.build({ skipSchemaUpdate: true }));
}

describe('the embedded BFF lifecycle', () => {
  describe('on restart', () => {
    it('should drop what the BFF read from the SaaS, since the customizations moved', async () => {
      const agent = buildAgent().addBff();
      await agent.start();

      await agent.restart();

      expect(mockInvalidate).toHaveBeenCalledTimes(1);
    });

    it('should leave the BFF serving, rather than rebuild it', async () => {
      const agent = buildAgent().addBff();
      await agent.start();

      await agent.restart();

      expect(mockBuildBff).toHaveBeenCalledTimes(1);
    });
  });

  describe('when the caller options are invalid', () => {
    it('should reject start() before anything is mounted or subscribed', async () => {
      mockParseConfig.mockImplementation(() => {
        throw new Error('Invalid configuration: BFF_TOKEN_ENCRYPTION_KEY must be 32 bytes.');
      });
      const options = factories.forestAdminHttpDriverOptions.build({ skipSchemaUpdate: true });
      const agent = new Agent(options).addBff({ tokenEncryptionKey: 'nope' });

      await expect(agent.start()).rejects.toThrow(
        'Invalid configuration: BFF_TOKEN_ENCRYPTION_KEY must be 32 bytes.',
      );
      expect(options.forestAdminClient.subscribeToServerEvents).not.toHaveBeenCalled();
      expect(mockMakeRoutes).not.toHaveBeenCalled();
    });
  });

  describe('before start()', () => {
    it('should answer 503 bff_not_started rather than fall through to the host 404', () => {
      const agent = buildAgent().addBff();
      const response = responseSpy();

      bffHandlerOf(agent)(requestFor('/bff/health'), response);

      expect(response.statusCode).toBe(503);
      expect(bodyOf(response).error).toEqual({
        type: 'bff_not_started',
        status: 503,
        message: 'The embedded BFF is not started yet.',
      });
    });
  });

  describe('after stop()', () => {
    it('should answer 503 bff_stopped, so a probe drains instead of waiting on a boot', async () => {
      const agent = buildAgent().addBff();
      await agent.start();
      await agent.stop();
      const response = responseSpy();

      bffHandlerOf(agent)(requestFor('/bff/health'), response);

      expect(response.statusCode).toBe(503);
      expect(bodyOf(response).error).toEqual({
        type: 'bff_stopped',
        status: 503,
        message: 'The embedded BFF was stopped with the agent.',
      });
    });
  });

  describe('while serving', () => {
    it('should hand the BFF the url without the prefix it knows nothing about', async () => {
      const agent = buildAgent().addBff();
      await agent.start();
      const request = requestFor('/bff/agent/v1/books/list');

      bffHandlerOf(agent)(request, responseSpy());

      expect(request.url).toBe('/agent/v1/books/list');
    });

    it('should keep the url the client asked for on originalUrl, for the host own logs', async () => {
      const agent = buildAgent().addBff();
      await agent.start();
      const request = requestFor('/bff/agent/v1/books/list');

      bffHandlerOf(agent)(request, responseSpy());

      expect(request.originalUrl).toBe('/bff/agent/v1/books/list');
    });

    it('should not overwrite an originalUrl the host already set', async () => {
      const agent = buildAgent().addBff();
      await agent.start();
      const request = requestFor('/bff/health');
      request.originalUrl = '/mounted/bff/health';

      bffHandlerOf(agent)(request, responseSpy());

      expect(request.originalUrl).toBe('/mounted/bff/health');
    });
  });

  describe('the metrics sink handed to the BFF', () => {
    it('should send counters to the host logs, since they only ever report a failure', async () => {
      const logger = jest.fn();
      const agent = new Agent(
        factories.forestAdminHttpDriverOptions.build({ skipSchemaUpdate: true, logger }),
      ).addBff();
      await agent.start();

      mockBuildBff.mock.calls[0][0].metrics.increment('schema_cache_refresh_error');

      expect(logger).toHaveBeenCalledWith('Warn', '[bff] metric schema_cache_refresh_error');
    });

    it('should drop gauges, which the default sink reports at Info on every read', async () => {
      const logger = jest.fn();
      const agent = new Agent(
        factories.forestAdminHttpDriverOptions.build({ skipSchemaUpdate: true, logger }),
      ).addBff();
      await agent.start();
      logger.mockClear();

      mockBuildBff.mock.calls[0][0].metrics.gauge('schema_cache_age_ms', 1);

      expect(logger).not.toHaveBeenCalled();
    });
  });

  describe('the logger handed to the BFF', () => {
    it('should keep an Error context readable instead of serializing it to {}', async () => {
      const logger = jest.fn();
      const agent = new Agent(
        factories.forestAdminHttpDriverOptions.build({ skipSchemaUpdate: true, logger }),
      ).addBff();
      await agent.start();

      mockBuildBff.mock.calls[0][0].logger('Warn', 'bundle unreadable', {
        error: new Error('EACCES'),
      });

      expect(logger).toHaveBeenCalledWith('Warn', expect.stringContaining('"message":"EACCES"'));
    });
  });
});

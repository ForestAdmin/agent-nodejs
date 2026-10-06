import type { AgentDispatcher, Bff, BuildBffOptions } from '@forestadmin/agent-bff';
import type { IncomingMessage, ServerResponse } from 'http';

import EmbeddedBff, { GATEWAY_API_CONFIG_LABELS } from '../../src/embedded-bff';
import * as factories from '../__factories__';

const mockBuildBff = jest.fn();

jest.mock('@forestadmin/agent-bff', () => {
  const actual = jest.requireActual('@forestadmin/agent-bff');

  return {
    __esModule: true,
    IN_PROCESS_AGENT_URL: actual.IN_PROCESS_AGENT_URL,
    parseConfig: actual.parseConfig,
    claimsBffPath: actual.claimsBffPath,
    buildBff: (options: BuildBffOptions) => mockBuildBff(options),
    get version() {
      return actual.version;
    },
  };
});

const AGENT_VERSION: string = jest.requireActual('../../package.json').version;

const INVALID_KEY = 'not-base64!!';

const INVALID_KEY_ERROR = 'must be base64-encoded and exactly 32 bytes (AES-256).';

function buildEmbedded(gateway: boolean, tokenEncryptionKey?: string): EmbeddedBff {
  return new EmbeddedBff(
    factories.forestAdminHttpDriverOptions.build(),
    { tokenEncryptionKey },
    gateway ? { prefix: '/api', name: 'The Gateway API', gateway: true } : { prefix: '/bff' },
  );
}

function answer503(embedded: EmbeddedBff): { type: string; status: number; message: string } {
  const res = {
    statusCode: 0,
    body: '',
    headers: {} as Record<string, string>,
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
    end(chunk?: string) {
      this.body = chunk ?? '';
    },
  };

  embedded.handle({} as IncomingMessage, res as unknown as ServerResponse);

  return JSON.parse(res.body).error;
}

describe('EmbeddedBff config labels', () => {
  beforeEach(() => {
    mockBuildBff.mockReset();
  });

  describe('under addGateway({ api })', () => {
    it('should name api.tokenEncryptionKey, not BFF_TOKEN_ENCRYPTION_KEY, on an invalid key', async () => {
      const embedded = buildEmbedded(true, INVALID_KEY);

      await expect(embedded.prepare()).rejects.toThrow(
        `Invalid configuration: api.tokenEncryptionKey ${INVALID_KEY_ERROR}`,
      );
    });

    it('should pass the gateway labels, the Gateway API name and the agent version to buildBff', async () => {
      const embedded = buildEmbedded(true);
      const bff = { callback: jest.fn(), invalidate: jest.fn() } as unknown as Bff;

      mockBuildBff.mockResolvedValueOnce(bff);

      await embedded.start(jest.fn() as unknown as AgentDispatcher);

      expect(mockBuildBff).toHaveBeenCalledWith(
        expect.objectContaining({
          gatewayVersion: AGENT_VERSION,
          labels: GATEWAY_API_CONFIG_LABELS,
          name: 'Gateway API',
        }),
      );
    });

    it('should answer the addGateway() 503s naming the Gateway API', async () => {
      const embedded = buildEmbedded(true);

      expect(answer503(embedded)).toEqual({
        type: 'bff_not_started',
        status: 503,
        message: 'The Gateway API is not started yet.',
      });

      await embedded.stop();

      expect(answer503(embedded)).toEqual({
        type: 'bff_stopped',
        status: 503,
        message: 'The Gateway API was stopped with the agent.',
      });
    });
  });

  describe('under addBff()', () => {
    it('should keep the BFF_TOKEN_ENCRYPTION_KEY message unchanged', async () => {
      const embedded = buildEmbedded(false, INVALID_KEY);

      await expect(embedded.prepare()).rejects.toThrow(
        `Invalid configuration: BFF_TOKEN_ENCRYPTION_KEY ${INVALID_KEY_ERROR}`,
      );
    });

    it('should answer the addBff() 503s naming the embedded BFF', async () => {
      const embedded = buildEmbedded(false);

      expect(answer503(embedded)).toEqual({
        type: 'bff_not_started',
        status: 503,
        message: 'The embedded BFF is not started yet.',
      });

      await embedded.stop();

      expect(answer503(embedded)).toEqual({
        type: 'bff_stopped',
        status: 503,
        message: 'The embedded BFF was stopped with the agent.',
      });
    });

    it('should pass the agent version but no labels and no name to buildBff', async () => {
      const embedded = buildEmbedded(false);
      const bff = { callback: jest.fn(), invalidate: jest.fn() } as unknown as Bff;

      mockBuildBff.mockResolvedValueOnce(bff);

      await embedded.start(jest.fn() as unknown as AgentDispatcher);

      const options = mockBuildBff.mock.calls[0][0];

      expect(options.gatewayVersion).toBe(AGENT_VERSION);
      expect('labels' in options).toBe(false);
      expect('name' in options).toBe(false);
    });
  });
});

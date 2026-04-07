import type { PendingStepExecution } from '../../src/types/execution';

import jsonwebtoken from 'jsonwebtoken';

import ServerAiAdapter from '../../src/adapters/server-ai-adapter';
import { StepType } from '../../src/types/step-definition';

jest.mock('@forestadmin/ai-proxy', () => ({
  AiClient: jest.fn().mockImplementation(() => ({
    loadRemoteTools: jest.fn().mockResolvedValue([]),
    closeConnections: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('@langchain/openai', () => ({
  ChatOpenAI: jest.fn().mockImplementation((opts: Record<string, unknown>) => ({
    mockOpts: opts,
  })),
}));

const ENV_SECRET = 'a'.repeat(64);

function makeStep(overrides: Partial<PendingStepExecution> = {}): PendingStepExecution {
  return {
    envId: 'env-42',
    runId: 'run-1',
    stepId: 'step-1',
    stepIndex: 0,
    baseRecordRef: { collectionName: 'customers', recordId: ['1'], stepIndex: 0 },
    stepDefinition: { type: StepType.ReadRecord },
    previousSteps: [],
    user: {
      id: 7,
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      team: 'admin',
      renderingId: 1,
      role: 'admin',
      permissionLevel: 'admin',
      tags: {},
    },
    ...overrides,
  };
}

describe('ServerAiAdapter', () => {
  const adapter = new ServerAiAdapter({
    forestServerUrl: 'https://api.forestadmin.com',
    envSecret: ENV_SECRET,
  });

  describe('getModel', () => {
    it('returns a ChatOpenAI with baseURL pointing to the FA server', () => {
      const model = adapter.getModel(makeStep()) as unknown as {
        mockOpts: Record<string, unknown>;
      };

      expect(model.mockOpts).toEqual(
        expect.objectContaining({
          model: 'gpt-4.1',
          maxRetries: 2,
          configuration: expect.objectContaining({
            fetch: expect.any(Function),
          }),
        }),
      );
    });

    it('forges a JWT signed with envSecret containing step context', () => {
      const step = makeStep({ envId: 'env-99', runId: 'run-abc', stepIndex: 3 });
      const model = adapter.getModel(step) as unknown as { mockOpts: Record<string, unknown> };

      const { apiKey } = model.mockOpts.configuration as { apiKey: string };
      const decoded = jsonwebtoken.verify(apiKey, ENV_SECRET) as Record<string, unknown>;

      expect(decoded).toEqual(
        expect.objectContaining({
          envId: 'env-99',
          userId: 7,
          runId: 'run-abc',
          stepIndex: 3,
        }),
      );
    });

    it('provides a fetch function that redirects to /liana/v1/ai-proxy', () => {
      const model = adapter.getModel(makeStep()) as unknown as {
        mockOpts: Record<string, unknown>;
      };

      const { fetch: customFetch } = model.mockOpts.configuration as {
        fetch: (url: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
      };

      const mockInit = { method: 'POST', body: '{}' } as RequestInit;
      const mockResponse = new Response('{}', { status: 200 });
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue(mockResponse);

      customFetch('https://ignored.com/chat/completions', mockInit);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.forestadmin.com/liana/v1/ai-proxy',
        mockInit,
      );

      global.fetch = originalFetch;
    });

    it('forges a new JWT per call (different tokens for different steps)', () => {
      const model1 = adapter.getModel(makeStep({ stepIndex: 0 })) as unknown as {
        mockOpts: Record<string, unknown>;
      };
      const model2 = adapter.getModel(makeStep({ stepIndex: 1 })) as unknown as {
        mockOpts: Record<string, unknown>;
      };

      const token1 = (model1.mockOpts.configuration as { apiKey: string }).apiKey;
      const token2 = (model2.mockOpts.configuration as { apiKey: string }).apiKey;

      expect(token1).not.toBe(token2);
    });
  });

  describe('loadRemoteTools', () => {
    it('delegates to internal AiClient', async () => {
      const result = await adapter.loadRemoteTools({ configs: {} });

      expect(result).toEqual([]);
    });
  });

  describe('closeConnections', () => {
    it('resolves without error', async () => {
      await expect(adapter.closeConnections()).resolves.toBeUndefined();
    });
  });
});

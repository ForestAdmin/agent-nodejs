import type { PendingStepExecution } from '../../src/types/execution';

import AiClientAdapter from '../../src/adapters/ai-client-adapter';
import { StepType } from '../../src/types/step-definition';

const mockGetModel = jest.fn().mockReturnValue({ invoke: jest.fn() });
const mockLoadRemoteTools = jest.fn().mockResolvedValue([]);
const mockCloseConnections = jest.fn().mockResolvedValue(undefined);

jest.mock('@forestadmin/ai-proxy', () => ({
  AiClient: jest.fn().mockImplementation(() => ({
    getModel: mockGetModel,
    loadRemoteTools: mockLoadRemoteTools,
    closeConnections: mockCloseConnections,
  })),
}));

function makeStep(overrides: Partial<PendingStepExecution> = {}): PendingStepExecution {
  return {
    envId: 'env-1',
    runId: 'run-1',
    stepId: 'step-1',
    stepIndex: 0,
    baseRecordRef: { collectionName: 'customers', recordId: ['1'], stepIndex: 0 },
    stepDefinition: { type: StepType.ReadRecord, aiConfigName: 'my-config' },
    previousSteps: [],
    user: {
      id: 1,
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

describe('AiClientAdapter', () => {
  beforeEach(() => jest.clearAllMocks());

  it('delegates getModel to AiClient with aiConfigName from step definition', () => {
    const adapter = new AiClientAdapter([
      { name: 'my-config', provider: 'openai' as const, model: 'gpt-4o', apiKey: 'sk-test' },
    ]);

    adapter.getModel(makeStep());

    expect(mockGetModel).toHaveBeenCalledWith('my-config');
  });

  it('delegates getModel without aiConfigName when not set', () => {
    const adapter = new AiClientAdapter([
      { name: 'default', provider: 'openai' as const, model: 'gpt-4o', apiKey: 'sk-test' },
    ]);

    adapter.getModel(makeStep({ stepDefinition: { type: StepType.ReadRecord } }));

    expect(mockGetModel).toHaveBeenCalledWith(undefined);
  });

  it('delegates loadRemoteTools to AiClient', async () => {
    const adapter = new AiClientAdapter([]);
    const config = { configs: {} };

    await adapter.loadRemoteTools(config);

    expect(mockLoadRemoteTools).toHaveBeenCalledWith(config);
  });

  it('delegates closeConnections to AiClient', async () => {
    const adapter = new AiClientAdapter([]);

    await adapter.closeConnections();

    expect(mockCloseConnections).toHaveBeenCalled();
  });
});

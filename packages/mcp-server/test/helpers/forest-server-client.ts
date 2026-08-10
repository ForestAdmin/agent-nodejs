import type { ForestServerClient } from '../../src/http-client';

export default function createMockForestServerClient(
  overrides: Partial<ForestServerClient> = {},
): jest.Mocked<ForestServerClient> {
  return {
    fetchSchema: jest.fn().mockResolvedValue([]),
    createActivityLog: jest.fn().mockResolvedValue({
      id: 'mock-log-id',
      attributes: { index: 'mock-index' },
    }),
    createMcpActivityLog: jest.fn().mockResolvedValue({
      id: 'mock-log-id',
      attributes: { index: 'mock-index' },
    }),
    updateActivityLogStatus: jest.fn().mockResolvedValue(undefined),
    listMcpEnabledWorkflows: jest.fn().mockResolvedValue([]),
    triggerMcpWorkflow: jest.fn().mockResolvedValue({ runId: '1', runState: 'loading' }),
    getMcpWorkflowRun: jest.fn().mockResolvedValue({
      runState: 'started',
      currentStep: null,
      waitingForHumanInput: false,
    }),
    ...overrides,
  } as jest.Mocked<ForestServerClient>;
}

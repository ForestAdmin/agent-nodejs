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
      id: 1,
      userId: 1,
      renderingId: 1,
      collectionId: 'orders',
      workflowId: 'wf-1',
      bpmnVersion: '1',
      selectedRecordId: '1',
      runState: 'started',
      engine: 'orchestrator',
      triggerType: 'mcp',
      lockedAt: null,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      workflowHistory: [],
    }),
    ...overrides,
  } as jest.Mocked<ForestServerClient>;
}

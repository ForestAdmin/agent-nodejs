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
    updateActivityLogStatus: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as jest.Mocked<ForestServerClient>;
}

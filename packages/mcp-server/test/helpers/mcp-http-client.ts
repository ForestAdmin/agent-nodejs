import type { McpHttpClient } from '../../src/http-client';

export default function createMockHttpClient(
  overrides: Partial<McpHttpClient> = {},
): jest.Mocked<McpHttpClient> {
  return {
    fetchSchema: jest.fn().mockResolvedValue([]),
    createActivityLog: jest.fn().mockResolvedValue({
      id: 'mock-log-id',
      attributes: { index: 'mock-index' },
    }),
    updateActivityLogStatus: jest.fn().mockResolvedValue({ ok: true, status: 200 }),
    ...overrides,
  } as jest.Mocked<McpHttpClient>;
}

import type { ActivityLogContext } from '@forestadmin/agent-client';
import type { ActivityLogsServiceInterface } from '@forestadmin/forestadmin-client';

export default function activityLogContext(): ActivityLogContext {
  return {
    service: {
      createActivityLog: jest.fn().mockResolvedValue({ id: 'log-1', attributes: { index: '0' } }),
      createMcpActivityLog: jest.fn(),
      updateActivityLogStatus: jest.fn().mockResolvedValue(undefined),
    } as ActivityLogsServiceInterface,
    credentials: () => ({ forestServerToken: 'forest-token', renderingId: 1 }),
    collectionIdOf: async collectionName => `${collectionName}-id`,
  };
}

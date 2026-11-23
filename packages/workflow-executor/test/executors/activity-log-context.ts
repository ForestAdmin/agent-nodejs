import type { ActivityLogConfig } from '@forestadmin/agent-client';

import { ActivityLogSource } from '@forestadmin/agent-client';

export default function activityLogContext(): ActivityLogConfig {
  return {
    forestServer: {
      serverUrl: 'https://api.forestadmin.com',
      serverToken: 'forest-token',
      renderingId: 1,
    },
    activityLog: {
      source: ActivityLogSource.WorkflowExecutor,
      collectionIdOf: async collectionName => `${collectionName}-id`,
    },
  };
}

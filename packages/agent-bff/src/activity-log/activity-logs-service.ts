import type {
  ActivityLogResponse,
  CreateActivityLogParams,
  UpdateActivityLogStatusParams,
} from '@forestadmin/forestadmin-client';

import { ActivityLogsService, ForestHttpApi } from '@forestadmin/forestadmin-client';

export const APPLICATION_SOURCE_HEADER = 'Forest-Application-Source';
export const BFF_APPLICATION_SOURCE = 'BFF';

/**
 * The slice of `ActivityLogsService` the BFF uses. Named so a fake can stand in for the two calls
 * without carrying the rest of the Forest client.
 */
export interface ActivityLogsWriter {
  createMcpActivityLog(params: CreateActivityLogParams): Promise<ActivityLogResponse>;
  updateActivityLogStatus(params: UpdateActivityLogStatusParams): Promise<void>;
}

/**
 * Its own instance rather than the client `oauth/forest-server-client.ts` already holds:
 * `ForestAdminClientOptions` carries no `headers`, so that one cannot tell the server which channel
 * wrote the log.
 */
export default function createBffActivityLogsService(forestServerUrl: string): ActivityLogsWriter {
  return new ActivityLogsService(new ForestHttpApi(), {
    forestServerUrl,
    headers: { [APPLICATION_SOURCE_HEADER]: BFF_APPLICATION_SOURCE },
  });
}

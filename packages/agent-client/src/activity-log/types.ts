import type { ActivityLogSource, ForestServerConnection } from '../forest-server';
import type {
  ActivityLogAction,
  ActivityLogResponse,
  ActivityLogWorkflow,
  ActivityLogsServiceInterface,
} from '@forestadmin/forestadmin-client';

export type ActivityLogLevel = 'Debug' | 'Info' | 'Warn' | 'Error';

export type ActivityLogLogger = (
  level: ActivityLogLevel,
  message: string,
  context?: Record<string, unknown>,
) => void;

export interface ActivityLogCredentials {
  forestServerToken: string;
  renderingId: string | number;
}

export interface ActivityLogOptions {
  source: ActivityLogSource;
  logger?: ActivityLogLogger;
  workflow?: ActivityLogWorkflow;
  collectionIdOf?: (collectionName: string) => Promise<string>;
  retryCreation?: boolean;
  /**
   * For a consumer whose audit credential is minted and cached for it: a 401 then means that
   * credential expired, not that the caller is refused, so a read runs and the consumer is told to
   * drop what it cached. Without it a 401 refuses the read like a 403.
   */
  onExpiredCredential?: () => void;
}

export interface ActivityLogConfig {
  forestServer: ForestServerConnection;
  activityLog: ActivityLogOptions;
}

export interface ActivityLogContext extends Omit<ActivityLogOptions, 'source'> {
  service: ActivityLogsServiceInterface;
  credentials: () => Promise<ActivityLogCredentials> | ActivityLogCredentials;
}

export interface ActivityLogEntry {
  action: ActivityLogAction;
  collectionName?: string;
  recordIds?: (string | number)[];
  label?: string;
}

export interface ActivityLogCallOptions {
  action?: ActivityLogAction;
  label?: string;
  beforeCall?: () => Promise<void>;
}

export type DerivedActivityLogEntry = Omit<ActivityLogEntry, 'action'> & {
  action?: ActivityLogAction;
};

export type ActivityLogStatus = 'completed' | 'failed' | 'canceled';

export interface PendingActivityLog {
  activityLog: ActivityLogResponse;
  forestServerToken: string;
}

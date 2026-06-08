import type { RecordId } from '../types/validated/collection';
import type { ActivityLogAction, ActivityLogType } from '@forestadmin/forestadmin-client';

export interface CreateActivityLogArgs {
  renderingId: number;
  action: ActivityLogAction;
  type: ActivityLogType;
  // Numeric Forest collection id; the adapter forwards it to the lib's `collectionName` param.
  collectionId: string;
  recordId?: RecordId;
  label?: string;
}

export interface ActivityLogHandle {
  id: string;
  index: string;
}

// Per-run scoped port: token baked into the adapter's constructor. markSucceeded/markFailed
// retry transient failures internally and are invoked with `void` from AgentWithLog.
export interface ActivityLogPort {
  createPending(args: CreateActivityLogArgs): Promise<ActivityLogHandle>;
  markSucceeded(handle: ActivityLogHandle): Promise<void>;
  markFailed(handle: ActivityLogHandle): Promise<void>;
}

// Produces per-run ActivityLogPort instances and exposes drain() at the process level so the
// Runner can wait for in-flight fire-and-forget transitions before shutting down.
export interface ActivityLogPortFactory {
  forRun(forestServerToken: string): ActivityLogPort;
  // Never rejects — individual transition failures are logged by the adapter.
  drain(): Promise<void>;
}

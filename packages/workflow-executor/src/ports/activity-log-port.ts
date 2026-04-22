export interface CreateActivityLogArgs {
  renderingId: number;
  action: string;
  type: 'read' | 'write';
  collectionName?: string;
  recordId?: string | number;
  label?: string;
}

export interface ActivityLogHandle {
  id: string;
  index: string;
}

// Per-run scoped port: token baked into the adapter's constructor. markSucceeded/markFailed
// retry transient failures internally and are invoked with `void` from base-step-executor.
export interface ActivityLogPort {
  createPending(args: CreateActivityLogArgs): Promise<ActivityLogHandle>;
  markSucceeded(handle: ActivityLogHandle): Promise<void>;
  markFailed(handle: ActivityLogHandle, errorMessage: string): Promise<void>;
}

// Produces per-run ActivityLogPort instances and exposes drain() at the process level so the
// Runner can wait for in-flight fire-and-forget transitions before shutting down.
export interface ActivityLogPortFactory {
  forRun(forestServerToken: string): ActivityLogPort;
  drain(): Promise<void>;
}

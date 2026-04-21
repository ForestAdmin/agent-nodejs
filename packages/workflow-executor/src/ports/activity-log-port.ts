export interface CreateActivityLogArgs {
  forestServerToken: string;
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

// markSucceeded/markFailed retry transient failures internally and are invoked with `void`
// from base-step-executor; the Runner must call drain() at shutdown to let them settle.
export interface ActivityLogPort {
  createPending(args: CreateActivityLogArgs): Promise<ActivityLogHandle>;
  markSucceeded(handle: ActivityLogHandle, forestServerToken: string): Promise<void>;
  markFailed(
    handle: ActivityLogHandle,
    forestServerToken: string,
    errorMessage: string,
  ): Promise<void>;
  drain(): Promise<void>;
}

// Per-run scoped view of ActivityLogPort with forestServerToken baked in. The Runner binds it
// so the token never traverses PendingStepExecution / ExecutionContext.
export interface RunActivityLogger {
  createPending(args: Omit<CreateActivityLogArgs, 'forestServerToken'>): Promise<ActivityLogHandle>;
  markSucceeded(handle: ActivityLogHandle): Promise<void>;
  markFailed(handle: ActivityLogHandle, errorMessage: string): Promise<void>;
}

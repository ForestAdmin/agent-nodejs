export interface CreateActivityLogArgs {
  forestServerToken: string;
  renderingId: number;
  /** Action identifier understood by Forest Admin backend. */
  action: string;
  type: 'read' | 'write';
  collectionName?: string;
  recordId?: string | number;
  label?: string;
}

/**
 * Opaque handle returned by `createPending`; caller passes it back to
 * `markSucceeded` / `markFailed` to transition the log status.
 */
export interface ActivityLogHandle {
  id: string;
  index: string;
}

/**
 * Port for emitting Forest Admin activity logs around each workflow step
 * whose action is executed by the executor itself.
 *
 * Lifecycle:
 *   1. `createPending` (blocking, retried) — throws ActivityLogCreationError
 *      if all retries fail; step must then fail in error.
 *   2. `markSucceeded` or `markFailed` (fire-and-forget, retried in background)
 *      transitions the log once the step is done.
 */
export interface ActivityLogPort {
  createPending(args: CreateActivityLogArgs): Promise<ActivityLogHandle>;
  markSucceeded(handle: ActivityLogHandle, forestServerToken: string): Promise<void>;
  markFailed(
    handle: ActivityLogHandle,
    forestServerToken: string,
    errorMessage: string,
  ): Promise<void>;
}

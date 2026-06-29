import type { ActivityLogPort, CreateActivityLogArgs } from '../ports/activity-log-port';
import type { StepUser } from '../types/execution-context';

// The activity-log target minus renderingId, which track() stamps centrally.
export type AuditTarget = Omit<CreateActivityLogArgs, 'renderingId'>;

export type TrackOptions<T> = {
  operation: () => Promise<T>;
  // Runs between createPending and the operation — the executor's write-ahead marker. Optional:
  // read operations have no marker to persist.
  beforeCall?: () => Promise<void>;
  // Errors that represent a controlled interruption (e.g. pausing for re-authentication) rather
  // than a failed action: the entry is closed as succeeded, not failed, and the error still throws.
  isNonFailure?: (error: unknown) => boolean;
};

// Runs an operation while recording an activity-log entry around it (pending → success/failed).
// It both executes `operation` and owns the activity-log transitions, so callers never touch the
// ActivityLogPort directly. `beforeCall` runs after createPending, just before the operation, so
// an audit-creation failure never leaves an orphan write-ahead marker.
export default class ActivityLog {
  private readonly activityLogPort: ActivityLogPort;

  private readonly user: StepUser;

  constructor(activityLogPort: ActivityLogPort, user: StepUser) {
    this.activityLogPort = activityLogPort;
    this.user = user;
  }

  async track<T>(
    target: AuditTarget,
    { operation, beforeCall, isNonFailure }: TrackOptions<T>,
  ): Promise<T> {
    const handle = await this.activityLogPort.createPending({
      renderingId: this.user.renderingId,
      ...target,
    });

    try {
      if (beforeCall) await beforeCall();
      const result = await operation();
      void this.activityLogPort.markSucceeded(handle);

      return result;
    } catch (err) {
      // The step error is logged/surfaced by base-step-executor when rethrown, so the audit
      // transition only needs the handle.
      if (isNonFailure?.(err)) void this.activityLogPort.markSucceeded(handle);
      else void this.activityLogPort.markFailed(handle);
      throw err;
    }
  }
}

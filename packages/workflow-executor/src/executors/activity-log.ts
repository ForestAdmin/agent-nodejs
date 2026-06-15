import type { ActivityLogPort, CreateActivityLogArgs } from '../ports/activity-log-port';
import type { StepUser } from '../types/execution-context';

// The activity-log target minus renderingId, which track() stamps centrally.
export type AuditTarget = Omit<CreateActivityLogArgs, 'renderingId'>;

export type TrackOptions<T> = {
  operation: () => Promise<T>;
};

// Runs an operation while recording an activity-log entry around it (pending → success/failed).
// Mutating callers must claim the step (write-ahead marker) BEFORE calling track, so a duplicate
// dispatch never reaches createPending.
export default class ActivityLog {
  private readonly activityLogPort: ActivityLogPort;

  private readonly user: StepUser;

  constructor(activityLogPort: ActivityLogPort, user: StepUser) {
    this.activityLogPort = activityLogPort;
    this.user = user;
  }

  async track<T>(target: AuditTarget, { operation }: TrackOptions<T>): Promise<T> {
    const handle = await this.activityLogPort.createPending({
      renderingId: this.user.renderingId,
      ...target,
    });

    try {
      const result = await operation();
      void this.activityLogPort.markSucceeded(handle);

      return result;
    } catch (err) {
      // The step error is logged/surfaced by base-step-executor when rethrown, so the audit
      // transition only needs the handle.
      void this.activityLogPort.markFailed(handle);
      throw err;
    }
  }
}

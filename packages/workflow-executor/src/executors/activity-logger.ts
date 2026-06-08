import type { ActivityLogPort, CreateActivityLogArgs } from '../ports/activity-log-port';
import type { StepUser } from '../types/execution-context';

// The activity-log target minus renderingId, which run() stamps centrally.
export type AuditTarget = Omit<CreateActivityLogArgs, 'renderingId'>;

export type AuditOptions = { beforeCall: () => Promise<void> };

// Emits an activity-log entry around an operation (pending → success/failed). Write operations
// pass a `beforeCall` thunk that runs between createPending and the side effect (the executor
// persists its write-ahead marker there), so the logger never reaches into run state.
export default class ActivityLogger {
  private readonly activityLogPort: ActivityLogPort;

  private readonly user: StepUser;

  constructor(activityLogPort: ActivityLogPort, user: StepUser) {
    this.activityLogPort = activityLogPort;
    this.user = user;
  }

  async run<T>(target: AuditTarget, operation: () => Promise<T>, opts?: AuditOptions): Promise<T> {
    const handle = await this.activityLogPort.createPending({
      renderingId: this.user.renderingId,
      ...target,
    });

    try {
      if (opts) await opts.beforeCall();
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

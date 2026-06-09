import type ActivityLogDrainer from './activity-log-drainer';
import type {
  ActivityLogHandle,
  ActivityLogPort,
  CreateActivityLogArgs,
} from '../ports/activity-log-port';
import type { Logger } from '../ports/logger-port';
import type { ActivityLogsServiceInterface } from '@forestadmin/forestadmin-client';

import { serializeRecordId } from './record-id-serializer';
import withRetry from './with-retry';
import { ActivityLogCreationError, extractErrorMessage } from '../errors';

export default class ForestadminClientActivityLogPort implements ActivityLogPort {
  constructor(
    private readonly service: ActivityLogsServiceInterface,
    private readonly logger: Logger,
    private readonly forestServerToken: string,
    private readonly drainer: ActivityLogDrainer,
  ) {}

  async createPending(args: CreateActivityLogArgs): Promise<ActivityLogHandle> {
    try {
      const response = await withRetry(
        'activity log create',
        () =>
          this.service.createActivityLog({
            forestServerToken: this.forestServerToken,
            renderingId: String(args.renderingId),
            action: args.action,
            type: args.type,
            // The lib writes this value verbatim into relationships.collection.data.id
            // (JSON:API). The Forest server audit-trail API expects the numeric collectionId.
            collectionName: args.collectionId,
            // Record ids are serialized to the pipe wire format here, never in the executor.
            recordId: args.recordId?.length ? serializeRecordId(args.recordId) : undefined,
            label: args.label,
          }),
        { logger: this.logger },
      );

      return { id: response.id, index: response.attributes.index };
    } catch (cause) {
      this.logger.error('activity log create failed', {
        action: args.action,
        collectionId: args.collectionId,
        status: (cause as { status?: number }).status,
        error: extractErrorMessage(cause),
      });
      throw new ActivityLogCreationError(cause);
    }
  }

  async markSucceeded(handle: ActivityLogHandle): Promise<void> {
    return this.drainer.track(async () => {
      try {
        await withRetry(
          'activity log mark-as-completed',
          () =>
            this.service.updateActivityLogStatus({
              forestServerToken: this.forestServerToken,
              activityLog: { id: handle.id, attributes: { index: handle.index } },
              status: 'completed',
            }),
          { logger: this.logger, extraRetryStatuses: [404] },
        );
      } catch (err) {
        this.logger.error('activity log mark-as-completed failed', {
          handleId: handle.id,
          error: extractErrorMessage(err),
        });
      }
    });
  }

  async markFailed(handle: ActivityLogHandle): Promise<void> {
    return this.drainer.track(async () => {
      try {
        await withRetry(
          'activity log mark-as-failed',
          () =>
            this.service.updateActivityLogStatus({
              forestServerToken: this.forestServerToken,
              activityLog: { id: handle.id, attributes: { index: handle.index } },
              status: 'failed',
            }),
          { logger: this.logger, extraRetryStatuses: [404] },
        );
      } catch (err) {
        this.logger.error('activity log mark-as-failed failed', {
          handleId: handle.id,
          error: extractErrorMessage(err),
        });
      }
    });
  }
}

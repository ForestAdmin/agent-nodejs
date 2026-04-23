import type ActivityLogDrainer from './activity-log-drainer';
import type {
  ActivityLogHandle,
  ActivityLogPort,
  CreateActivityLogArgs,
} from '../ports/activity-log-port';
import type { Logger } from '../ports/logger-port';
import type {
  ActivityLogAction,
  ActivityLogsServiceInterface,
} from '@forestadmin/forestadmin-client';

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
        'Activity log createPending',
        () =>
          this.service.createActivityLog({
            forestServerToken: this.forestServerToken,
            renderingId: String(args.renderingId),
            action: args.action as ActivityLogAction,
            type: args.type,
            // The lib writes this value verbatim into relationships.collection.data.id
            // (JSON:API). The Forest server audit-trail API expects the numeric collectionId.
            collectionName: args.collectionId,
            recordId: args.recordId,
            label: args.label,
          }),
        { logger: this.logger },
      );

      return { id: response.id, index: response.attributes.index };
    } catch (cause) {
      this.logger.error('Activity log creation failed', {
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
          'Activity log markSucceeded',
          () =>
            this.service.updateActivityLogStatus({
              forestServerToken: this.forestServerToken,
              activityLog: { id: handle.id, attributes: { index: handle.index } },
              status: 'completed',
            }),
          { logger: this.logger },
        );
      } catch (err) {
        this.logger.error('Activity log markSucceeded failed after retries', {
          handleId: handle.id,
          error: extractErrorMessage(err),
        });
      }
    });
  }

  async markFailed(handle: ActivityLogHandle, errorMessage: string): Promise<void> {
    return this.drainer.track(async () => {
      try {
        await withRetry(
          'Activity log markFailed',
          () =>
            this.service.updateActivityLogStatus({
              forestServerToken: this.forestServerToken,
              activityLog: { id: handle.id, attributes: { index: handle.index } },
              status: 'failed',
              errorMessage,
            }),
          { logger: this.logger },
        );
      } catch (err) {
        this.logger.error('Activity log markFailed failed after retries', {
          handleId: handle.id,
          stepErrorMessage: errorMessage,
          error: extractErrorMessage(err),
        });
      }
    });
  }
}

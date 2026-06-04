import type { CreateActivityLogArgs } from '../ports/activity-log-port';
import type { RecordRef } from '../types/validated/collection';
import type { StepDefinition } from '../types/validated/step-definition';

import BaseStepExecutor from './base-step-executor';

export type OperationDescriptor = Pick<CreateActivityLogArgs, 'action' | 'type' | 'label'>;

export default abstract class OperationStepExecutor<
  TStep extends StepDefinition = StepDefinition,
> extends BaseStepExecutor<TStep> {
  protected abstract readonly operation: OperationDescriptor;

  // Defaults to the run's trigger collection; RecordStepExecutor overrides it to resolve the
  // acted record's own collection (which may differ from the trigger).
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected operationCollectionId(record: RecordRef): Promise<string> {
    return Promise.resolve(this.context.collectionId);
  }

  protected async logOperation<T>(record: RecordRef, run: () => Promise<T>): Promise<T> {
    const collectionId = await this.operationCollectionId(record);

    return this.withActivityLog(
      {
        renderingId: this.context.user.renderingId,
        ...this.operation,
        collectionId,
        recordId: record.recordId,
      },
      run,
    );
  }

  private async withActivityLog<T>(
    args: CreateActivityLogArgs,
    operation: () => Promise<T>,
  ): Promise<T> {
    const handle = await this.context.activityLogPort.createPending(args);

    try {
      const result = await operation();
      void this.context.activityLogPort.markSucceeded(handle);

      return result;
    } catch (err) {
      void this.context.activityLogPort.markFailed(handle);
      throw err;
    }
  }
}

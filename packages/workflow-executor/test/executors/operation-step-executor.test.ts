/* eslint-disable max-classes-per-file */
import type { Logger } from '../../src/ports/logger-port';
import type { RunStore } from '../../src/ports/run-store';
import type { ExecutionContext, StepExecutionResult } from '../../src/types/execution-context';
import type { RecordRef } from '../../src/types/validated/collection';
import type { BaseStepStatus } from '../../src/types/validated/step-outcome';

import { ActivityLogCreationError, NoRecordsError } from '../../src/errors';
import OperationStepExecutor from '../../src/executors/operation-step-executor';
import SchemaCache from '../../src/schema-cache';
import { StepExecutionMode, StepType } from '../../src/types/validated/step-definition';

class TestOperationExecutor extends OperationStepExecutor {
  protected readonly operation = { action: 'update', type: 'write' } as const;

  constructor(
    context: ExecutionContext,
    private readonly run: () => Promise<unknown> = () => Promise.resolve('ok'),
  ) {
    super(context);
  }

  protected async doExecute(): Promise<StepExecutionResult> {
    await this.logOperation(this.context.baseRecordRef, this.run);

    return this.buildOutcomeResult({ status: 'success' });
  }

  protected buildOutcomeResult(outcome: {
    status: BaseStepStatus;
    error?: string;
  }): StepExecutionResult {
    return {
      stepOutcome: {
        type: 'record',
        stepId: this.context.stepId,
        stepIndex: this.context.stepIndex,
        status: outcome.status,
        ...(outcome.error !== undefined && { error: outcome.error }),
      },
    };
  }
}

function makeMockRunStore(): RunStore {
  return {
    init: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    getStepExecutions: jest.fn().mockResolvedValue([]),
    saveStepExecution: jest.fn().mockResolvedValue(undefined),
  };
}

function makeMockLogger(): Logger {
  return { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
}

function makeMockActivityLogPort(): ExecutionContext['activityLogPort'] {
  return {
    createPending: jest.fn().mockResolvedValue({ id: 'log-1', index: '0' }),
    markSucceeded: jest.fn().mockResolvedValue(undefined),
    markFailed: jest.fn().mockResolvedValue(undefined),
  };
}

function makeContext(overrides: Partial<ExecutionContext> = {}): ExecutionContext {
  return {
    runId: 'run-1',
    stepId: 'step-0',
    stepIndex: 0,
    collectionId: 'col-1',
    baseRecordRef: {
      collectionName: 'customers',
      recordId: [42],
      stepIndex: 0,
    } as RecordRef,
    stepDefinition: {
      type: StepType.UpdateRecord,
      executionType: StepExecutionMode.FullyAutomated,
      prompt: 'Update it',
    },
    model: {} as ExecutionContext['model'],
    agentPort: {} as ExecutionContext['agentPort'],
    workflowPort: {} as ExecutionContext['workflowPort'],
    runStore: makeMockRunStore(),
    user: {
      id: 1,
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      team: 'admin',
      renderingId: 1,
      role: 'admin',
      permissionLevel: 'admin',
      tags: {},
    },
    schemaCache: new SchemaCache(),
    previousSteps: [],
    logger: makeMockLogger(),
    activityLogPort: makeMockActivityLogPort(),
    ...overrides,
  };
}

describe('OperationStepExecutor', () => {
  describe('logOperation', () => {
    it('logs the operation against the given record and trigger collection, then marks succeeded', async () => {
      const context = makeContext();
      const executor = new TestOperationExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      expect(context.activityLogPort.createPending).toHaveBeenCalledWith({
        renderingId: 1,
        action: 'update',
        type: 'write',
        collectionId: 'col-1',
        recordId: [42],
      });
      expect(context.activityLogPort.markSucceeded).toHaveBeenCalledWith({
        id: 'log-1',
        index: '0',
      });
      expect(context.activityLogPort.markFailed).not.toHaveBeenCalled();
    });

    it('marks the log failed (by handle) when the operation throws', async () => {
      const context = makeContext();
      const executor = new TestOperationExecutor(context, () =>
        Promise.reject(new NoRecordsError()),
      );

      await executor.execute();

      expect(context.activityLogPort.markFailed).toHaveBeenCalledWith({ id: 'log-1', index: '0' });
      expect(context.activityLogPort.markSucceeded).not.toHaveBeenCalled();
    });

    it('does NOT run the operation and propagates when createPending throws', async () => {
      const context = makeContext();
      (context.activityLogPort.createPending as jest.Mock).mockRejectedValue(
        new ActivityLogCreationError(new Error('net')),
      );
      const operation = jest.fn().mockResolvedValue('ok');

      const executor = new TestOperationExecutor(context, operation);
      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe(
        'Could not record this step in the audit log. Please try again, or contact your administrator if the problem persists.',
      );
      expect(operation).not.toHaveBeenCalled();
    });
  });

  describe('operationCollectionId', () => {
    it('targets the collection resolved by the override instead of the trigger collection', async () => {
      class OverridingExecutor extends TestOperationExecutor {
        protected override operationCollectionId(): Promise<string> {
          return Promise.resolve('col-orders');
        }
      }
      const context = makeContext();
      const executor = new OverridingExecutor(context);

      await executor.execute();

      expect(context.activityLogPort.createPending).toHaveBeenCalledWith(
        expect.objectContaining({ collectionId: 'col-orders', recordId: [42] }),
      );
    });
  });
});

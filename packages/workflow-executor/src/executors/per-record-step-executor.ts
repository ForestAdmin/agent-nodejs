import type {
  ExecutionContext,
  IStepExecutor,
  StepExecutionResult,
} from '../types/execution-context';
import type {
  PerRecordStepExecutionData,
  StepExecutionData,
  StepIteration,
} from '../types/step-execution-data';
import type { RecordRef } from '../types/validated/collection';
import type { Step } from '../types/validated/execution';
import type { RecordStepStatus } from '../types/validated/step-outcome';

import { z } from 'zod';

import {
  MultipleOnPerRecordSourceError,
  SourceRecordMissingError,
  StepTimeoutError,
  WorkflowExecutorError,
  extractErrorMessage,
} from '../errors';
import { findStepExecution } from './base-step-executor';
import IterationRunStore, { isSameRecord } from './iteration-run-store';
import { classifyMissingSourceRecord } from './record-step-executor';
import { serializeRecordId } from '../record-id';
import { isPerRecordExecution } from '../types/step-execution-data';
import { StepType } from '../types/validated/step-definition';

// Read before any type-specific confirmation: Get Data has none, and a failed record of any step
// can be retried or skipped.
const FailedRecordsRequestSchema = z
  .object({
    failedRecords: z.enum(['retry', 'skip']),
    sourceRecordId: z.string().min(1).optional(),
  })
  .strict();

export interface PerRecordSource {
  // The Multiple step whose records the step runs once for.
  root: Step;
  // The step the step reads its record from: the Multiple step, or a per-record step after it.
  direct: Step;
}

type RecordRun = { status: RecordStepStatus } | { interrupted: 'stopped' | 'yielded' };

// Runs a record step once per record its Multiple source loaded, in order, each record
// independently, through the single-record executor of its type.
export default class PerRecordStepExecutor implements IStepExecutor {
  private readonly context: ExecutionContext;
  private readonly source: PerRecordSource;
  private readonly createInner: (context: ExecutionContext) => IStepExecutor;

  constructor(
    context: ExecutionContext,
    source: PerRecordSource,
    createInner: (context: ExecutionContext) => IStepExecutor,
  ) {
    this.context = context;
    this.source = source;
    this.createInner = createInner;
  }

  async execute(): Promise<StepExecutionResult> {
    try {
      return await this.run();
    } catch (error) {
      this.context.logger('Error', 'Per-record step failed', {
        ...this.logCtx,
        error: extractErrorMessage(error),
      });

      if (error instanceof WorkflowExecutorError) {
        return this.outcome('error', {
          error: error.userMessage,
          ...(error.errorKind !== undefined && { errorKind: error.errorKind }),
          ...(error.errorSourceStepIndex !== undefined && {
            errorSourceStepIndex: error.errorSourceStepIndex,
          }),
        });
      }

      return this.outcome('error', { error: 'Unexpected error during step execution' });
    }
  }

  private async run(): Promise<StepExecutionResult> {
    const { stepDefinition } = this.context;

    if (
      stepDefinition.type === StepType.LoadRelatedRecord &&
      stepDefinition.preRecordedArgs?.multiple === true
    ) {
      throw new MultipleOnPerRecordSourceError(stepDefinition.title);
    }

    const executions = await this.context.runStore.getStepExecutions(this.context.runId);
    const stored = executions.find(e => e.stepIndex === this.context.stepIndex);
    const row = isPerRecordExecution(stored) ? stored : this.listRecords(executions);
    const answered = this.readRequest(row);
    await this.persist(row);

    for (let index = 0; index < row.iterations.length; index += 1) {
      if (row.iterations[index].finishedAt === undefined) {
        // Records run one after the other: each one renews the lock the next one relies on.
        // eslint-disable-next-line no-await-in-loop
        const run = await this.runRecord(row, index, answered === index, executions);

        if ('interrupted' in run) {
          return { ...this.outcome('awaiting-input'), interrupted: run.interrupted };
        }

        if (run.status === 'awaiting-input') return this.outcome('awaiting-input');
      }
    }

    const failed = row.iterations.filter(iteration => iteration.error !== undefined).length;

    return failed > 0
      ? this.outcome('error', { error: `${failed} of ${row.iterations.length} records failed.` })
      : this.outcome('success');
  }

  // Every record is listed when the step starts, so the run view shows the ones still to come.
  private listRecords(executions: StepExecutionData[]): PerRecordStepExecutionData {
    const { root } = this.source;
    const rootExecution = findStepExecution(root, executions);
    const result = rootExecution?.type === 'load-related-record' && rootExecution.executionResult;
    const records = result && 'records' in result ? result.records : [];

    if (records.length === 0) {
      throw new SourceRecordMissingError(root.stepDefinition.title, {
        errorKind: classifyMissingSourceRecord(rootExecution),
        errorSourceStepIndex: root.stepOutcome.stepIndex,
      });
    }

    return {
      type: this.context.stepDefinition.type as PerRecordStepExecutionData['type'],
      stepIndex: this.context.stepIndex,
      iterations: records.map(record => ({ sourceRecordRef: record, attempt: 1 })),
    };
  }

  // Applies a retry or skip request, or returns the index of the paused record an answer is for.
  // An answer for any other record is dropped: the run view sent it for a pause that has moved on.
  private readRequest(row: PerRecordStepExecutionData): number | undefined {
    const incoming = this.context.incomingPendingData;
    if (incoming === undefined) return undefined;

    const request = FailedRecordsRequestSchema.safeParse(incoming);

    if (request.success) {
      const { failedRecords, sourceRecordId } = request.data;

      row.iterations = row.iterations.map(iteration => {
        if (iteration.error === undefined) return iteration;
        if (sourceRecordId !== undefined && sourceRecordId !== this.idOf(iteration)) {
          return iteration;
        }

        return failedRecords === 'retry'
          ? { sourceRecordRef: iteration.sourceRecordRef, attempt: iteration.attempt + 1 }
          : {
              sourceRecordRef: iteration.sourceRecordRef,
              ...(iteration.selectedRecordRef && { selectedRecordRef: iteration.selectedRecordRef }),
              attempt: iteration.attempt,
              executionResult: { skipped: true },
              finishedAt: new Date().toISOString(),
            };
      });

      return undefined;
    }

    const paused = row.iterations.findIndex(iteration => iteration.finishedAt === undefined);
    const { sourceRecordId } = (incoming ?? {}) as { sourceRecordId?: unknown };

    if (
      paused >= 0 &&
      row.iterations[paused].pendingData !== undefined &&
      sourceRecordId === this.idOf(row.iterations[paused])
    ) {
      return paused;
    }

    this.context.logger('Info', 'Dropped an answer for a record that is not the one paused', {
      ...this.logCtx,
      sourceRecordId: typeof sourceRecordId === 'string' ? sourceRecordId : null,
    });

    return undefined;
  }

  private async runRecord(
    row: PerRecordStepExecutionData,
    index: number,
    answered: boolean,
    executions: StepExecutionData[],
  ): Promise<RecordRun> {
    const decision = (await this.context.runControl?.beforeRecord()) ?? 'continue';
    if (decision === 'stop') return { interrupted: 'stopped' };
    if (decision === 'yield') return { interrupted: 'yielded' };

    const { sourceRecordRef } = row.iterations[index];

    if (!this.reachesRecord(sourceRecordRef, executions)) {
      row.iterations[index] = {
        ...row.iterations[index],
        executionResult: { skipped: true },
        finishedAt: new Date().toISOString(),
      };
      await this.persist(row);

      return { status: 'success' };
    }

    const store = new IterationRunStore(this.context.runStore, this.context.stepIndex, sourceRecordRef, {
      get: () => row.iterations[index],
      set: async iteration => {
        row.iterations[index] = iteration;
        await this.persist(row);
      },
    });
    const { incomingPendingData } = this.context;
    const answer = answered ? this.withoutRecordId(incomingPendingData) : undefined;
    const inner = this.createInner({
      ...this.context,
      runStore: store,
      incomingPendingData: answer,
      stepTimeoutS: undefined,
      perRecordLabel: await this.labelOf(sourceRecordRef),
    });
    const { stepOutcome } = await this.withTimeout(inner.execute(), store);

    if (stepOutcome.status === 'awaiting-input') {
      await this.persist(row);

      return { status: 'awaiting-input' };
    }

    row.iterations[index] = {
      ...row.iterations[index],
      ...(stepOutcome.status === 'error' && {
        error: stepOutcome.error ?? 'Unexpected error during step execution',
        ...(stepOutcome.errorKind !== undefined && { errorKind: stepOutcome.errorKind }),
      }),
      finishedAt: new Date().toISOString(),
    };
    await this.persist(row);

    return { status: stepOutcome.status };
  }

  // A record whose per-record source found nothing for it is skipped by the steps after it.
  private reachesRecord(sourceRecordRef: RecordRef, executions: StepExecutionData[]): boolean {
    const { root, direct } = this.source;
    if (direct === root) return true;

    const execution = findStepExecution(direct, executions);
    if (!isPerRecordExecution(execution)) return false;

    const result = execution.iterations.find(iteration =>
      isSameRecord(iteration.sourceRecordRef, sourceRecordRef),
    )?.executionResult;

    return Boolean(result && 'record' in result);
  }

  // The step timeout applies to each record. The race does not abort the call it gives up on, so
  // the store it writes through is abandoned and its late result is never saved.
  private async withTimeout(
    execution: Promise<StepExecutionResult>,
    store: IterationRunStore,
  ): Promise<StepExecutionResult> {
    const timeoutS = this.context.stepTimeoutS;
    if (!timeoutS || timeoutS <= 0) return execution;

    let timer: NodeJS.Timeout | undefined;
    execution.catch(() => undefined);

    try {
      return await Promise.race([
        execution,
        new Promise<StepExecutionResult>(resolve => {
          timer = setTimeout(() => {
            store.abandon();
            resolve(
              this.outcome('error', { error: new StepTimeoutError(timeoutS).userMessage }),
            );
          }, timeoutS * 1000);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private withoutRecordId(pendingData: unknown): unknown {
    const { sourceRecordId, ...answer } = pendingData as Record<string, unknown>;

    return answer;
  }

  private idOf(iteration: StepIteration): string {
    return serializeRecordId(iteration.sourceRecordRef.recordId);
  }

  private async labelOf(record: RecordRef): Promise<string> {
    const schema = await this.context.schemaResolver.resolve(record.collectionName);

    return `${schema.collectionDisplayName} #${record.recordId.join(', ')}`;
  }

  private persist(row: PerRecordStepExecutionData): Promise<void> {
    return this.context.runStore.saveStepExecution(this.context.runId, row);
  }

  private outcome(
    status: RecordStepStatus,
    extra: Pick<StepExecutionResult['stepOutcome'], 'error' | 'errorKind' | 'errorSourceStepIndex'> = {},
  ): StepExecutionResult {
    return {
      stepOutcome: {
        type: 'record',
        stepId: this.context.stepId,
        stepIndex: this.context.stepIndex,
        status,
        ...extra,
      },
    };
  }

  private get logCtx() {
    const { runId, stepId, stepIndex, stepDefinition } = this.context;

    return { runId, stepId, stepIndex, stepType: stepDefinition.type };
  }
}

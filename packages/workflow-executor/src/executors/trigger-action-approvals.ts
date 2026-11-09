import type { ExecutionContext, StepExecutionResult } from '../types/execution-context';
import type { TriggerRecordActionStepExecutionData } from '../types/step-execution-data';
import type { RecordRef } from '../types/validated/collection';
import type { TriggerActionStepDefinition } from '../types/validated/step-definition';
import type {
  ApprovalActionTarget,
  ApprovalOutcome,
  ApprovalRequestRef,
  AwaitingInputReason,
  ErrorKind,
  RecordStepStatus,
} from '../types/validated/step-outcome';

import {
  ActionRequiresApprovalError,
  ApprovalBranchesMissingError,
  ApprovalRequestFailedError,
  ApprovalRequestGoneError,
  ApprovalRequestUntrackedError,
  StepStateError,
} from '../errors';
import { serializeRecordId } from '../record-id';

export type TriggerActionOutcome = {
  status: RecordStepStatus;
  error?: string;
  errorKind?: ErrorKind;
  errorSourceStepIndex?: number;
  approvalRequest?: { id: string };
  awaitingInputReason?: AwaitingInputReason;
  approvalRequests?: ApprovalRequestRef[];
  actionTarget?: ApprovalActionTarget;
  selectedOption?: ApprovalOutcome;
  approverId?: number | null;
};

export type RanAction = { selectedRecordRef: RecordRef; actionName: string };

type FiledExecutionResult = Exclude<
  TriggerRecordActionStepExecutionData['executionResult'],
  { skipped: true }
>;

// What the step's approval outcomes decide: whether a filed request pauses, errors or succeeds,
// how its review is replayed, and which branch a run takes without one.
export default class TriggerActionApprovals {
  constructor(
    private readonly context: ExecutionContext<TriggerActionStepDefinition>,
    private readonly buildOutcome: (outcome: TriggerActionOutcome) => StepExecutionResult,
  ) {}

  get hasOutcomes(): boolean {
    return this.context.stepDefinition.approvalOutcomes === true;
  }

  // Saved without branches by an editor that knows them; a step from an older editor has no value.
  get refuses(): boolean {
    return this.context.stepDefinition.approvalOutcomes === false;
  }

  // A request filed by the executor on a step that refuses approvals would stay open with no run
  // to follow its review, so the agent is asked to refuse instead.
  async mapRefusal(error: unknown, actionName: string): Promise<never> {
    if (error instanceof ActionRequiresApprovalError && this.refuses) {
      // Nothing ran: a re-dispatch must ask the agent again, not read the step as interrupted.
      await this.context.runStore.deleteStepExecution(this.context.runId, this.context.stepIndex);
      throw new ApprovalBranchesMissingError(actionName);
    }

    throw error;
  }

  // The one decision for a request the AI or the native form filed, on its first report or on a
  // replay of the record saved `done` (filedRecord), which consults the review.
  async settle(
    approvalRequest: { id: string } | undefined,
    ranAction: RanAction,
    filedRecord?: TriggerRecordActionStepExecutionData,
  ): Promise<StepExecutionResult> {
    if (this.refuses) {
      throw new ApprovalBranchesMissingError(ranAction.actionName, approvalRequest?.id);
    }

    if (this.hasOutcomes) {
      if (!approvalRequest) throw new ApprovalRequestUntrackedError(ranAction.actionName);

      return filedRecord
        ? this.replayReview(filedRecord, approvalRequest, ranAction)
        : this.pause(approvalRequest, ranAction);
    }

    return this.buildOutcome({ status: 'success', ...(approvalRequest && { approvalRequest }) });
  }

  executedResult(): StepExecutionResult {
    return this.buildOutcome({
      status: 'success',
      ...(this.hasOutcomes && { selectedOption: 'approved' as const }),
    });
  }

  // Declining the form takes the branch the user picks (product question Q7): falling through to
  // Approved would read as an approval nobody gave.
  async decline(execution: TriggerRecordActionStepExecutionData): Promise<StepExecutionResult> {
    const selectedOption = execution.userConfirmation?.selectedOption;

    if (!selectedOption) {
      throw new StepStateError(
        `Declining the form of a step with approval outcomes requires a selectedOption ` +
          `(run "${this.context.runId}", step ${this.context.stepIndex})`,
      );
    }

    await this.context.runStore.saveStepExecution(this.context.runId, {
      ...execution,
      executionResult: { skipped: true, selectedOption },
    });

    return this.buildOutcome({ status: 'success', selectedOption });
  }

  private pause(
    approvalRequest: { id: string },
    { selectedRecordRef, actionName }: RanAction,
  ): StepExecutionResult {
    return this.buildOutcome({
      status: 'awaiting-input',
      awaitingInputReason: 'pending-approval',
      approvalRequests: [{ id: approvalRequest.id }],
      actionTarget: {
        collectionName: selectedRecordRef.collectionName,
        actionName,
        recordId: serializeRecordId(selectedRecordRef.recordId),
      },
    });
  }

  // The server hands back the review of the request the step paused on. Until it is closed the
  // step pauses again; once closed it takes the branch the reviewer chose.
  private async replayReview(
    existing: TriggerRecordActionStepExecutionData,
    approvalRequest: { id: string },
    ranAction: RanAction,
  ): Promise<StepExecutionResult> {
    const review = this.context.approvalRequests?.find(({ id }) => id === approvalRequest.id);

    if (!review) return this.pause(approvalRequest, ranAction);

    if (review.status === 'approved' || review.status === 'rejected') {
      await this.context.runStore.saveStepExecution(this.context.runId, {
        ...existing,
        executionResult: {
          ...(existing.executionResult as FiledExecutionResult),
          approvalOutcome: review.status,
        },
      });

      return this.buildOutcome({
        status: 'success',
        selectedOption: review.status,
        approverId: review.approverId ?? null,
      });
    }

    if (review.status === 'failed') throw new ApprovalRequestFailedError(approvalRequest.id);
    if (review.status === undefined) throw new ApprovalRequestGoneError(approvalRequest.id);

    return this.pause(approvalRequest, ranAction);
  }
}

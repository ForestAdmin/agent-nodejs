import type {
  ServerHydratedWorkflowRun,
  ServerStartSubWorkflow,
  ServerStepHistory,
  ServerUserProfile,
} from './server-types';
import type {
  ConditionStepOutcome,
  GuidanceStepOutcome,
  McpStepOutcome,
  RecordStepOutcome,
  StepOutcome,
} from '../types/validated/step-outcome';

import { z } from 'zod';

import toProjectTimezone from './project-timezone';
import { deserializeRecordId } from '../record-id';
import { ServerStepTypeEnum, ServerWorkflowTriggerType } from './server-types';
import toStepDefinition from './step-definition-mapper';
import { toStepUser as toSharedStepUser } from './step-user';
import {
  DomainValidationError,
  InvalidStepDefinitionError,
  UnsupportedStepTypeError,
} from '../errors';
import {
  type ApprovalRequestReview,
  ApprovalRequestStatusSchema,
  type AvailableStepExecution,
  AvailableStepExecutionSchema,
  type CallScope,
  type Step,
  type StepUser,
  type SubWorkflowEnd,
} from '../types/validated/execution';
import { WORKFLOW_START_STEP_ID } from '../types/validated/step-definition';
import {
  ApprovalOutcomeSchema,
  ErrorKindSchema,
  ErrorSourceStepIndexSchema,
  stepTypeToOutcomeType,
} from '../types/validated/step-outcome';

function toRecordStatus(ctxStatus: unknown): RecordStepOutcome['status'] {
  if (ctxStatus === 'error') return 'error';
  if (ctxStatus === 'awaiting-input') return 'awaiting-input';

  return 'success';
}

// `context` may come from the executor (our StepOutcome, stored verbatim) or the legacy frontend
// (free-form). We whitelist known fields per type to avoid leaking legacy ones back to the
// orchestrator and to enforce the discriminated-union shape.
function toStepOutcome(s: ServerStepHistory): StepOutcome {
  const stepDef = toStepDefinition(s.stepDefinition);
  const outcomeType = stepTypeToOutcomeType(stepDef.type);
  const ctx = (s.context ?? {}) as Record<string, unknown>;

  // A value the executor didn't write (legacy frontend, or a newer executor's vocabulary) is dropped
  // rather than passed on: AvailableStepExecutionSchema.parse below would fail the whole run.
  const parsedErrorKind = ErrorKindSchema.safeParse(ctx.errorKind);
  const parsedSourceStepIndex = ErrorSourceStepIndexSchema.safeParse(ctx.errorSourceStepIndex);

  const baseFromCtx = {
    stepId: s.stepName,
    stepIndex: s.stepIndex,
    error: typeof ctx.error === 'string' ? ctx.error : undefined,
    ...(parsedErrorKind.success && { errorKind: parsedErrorKind.data }),
    ...(parsedSourceStepIndex.success && { errorSourceStepIndex: parsedSourceStepIndex.data }),
  };

  if (outcomeType === 'condition') {
    const status: ConditionStepOutcome['status'] = toRecordStatus(ctx.status);
    const selectedOption = typeof ctx.selectedOption === 'string' ? ctx.selectedOption : undefined;

    return {
      type: 'condition',
      ...baseFromCtx,
      status,
      ...(selectedOption !== undefined && { selectedOption }),
    };
  }

  if (outcomeType === 'guidance') {
    const status: GuidanceStepOutcome['status'] = ctx.status === 'error' ? 'error' : 'success';

    return { type: 'guidance', ...baseFromCtx, status };
  }

  const status = toRecordStatus(ctx.status);

  if (outcomeType === 'mcp') {
    return { type: 'mcp', ...baseFromCtx, status } satisfies McpStepOutcome;
  }

  const selectedOption = ApprovalOutcomeSchema.safeParse(ctx.selectedOption);

  return {
    type: 'record',
    ...baseFromCtx,
    status,
    ...(selectedOption.success && { selectedOption: selectedOption.data }),
  } satisfies RecordStepOutcome;
}

// The server sends the row id as a number; the executor keeps the JSON:API string it was handed.
// A status outside the known ones is dropped, so the replay reads the request as unknown.
function toApprovalRequestReviews(context: unknown): ApprovalRequestReview[] | undefined {
  const refs = (context as { approvalRequests?: unknown } | null | undefined)?.approvalRequests;

  if (!Array.isArray(refs)) return undefined;

  return refs.flatMap((ref): ApprovalRequestReview[] => {
    const { id, status, approverId } = (ref ?? {}) as Record<string, unknown>;

    if (typeof id !== 'string' && typeof id !== 'number') return [];

    const parsedStatus = ApprovalRequestStatusSchema.safeParse(status);
    const review: ApprovalRequestReview = { id: String(id) };

    if (parsedStatus.success) review.status = parsedStatus.data;
    if (typeof approverId === 'number') review.approverId = approverId;
    if (approverId === null) review.approverId = null;

    return [review];
  });
}

function tryMapStep(s: ServerStepHistory): Step | null {
  try {
    return {
      stepDefinition: toStepDefinition(s.stepDefinition),
      stepOutcome: toStepOutcome(s),
      ...(s.originalStepIndex !== undefined && { originalStepIndex: s.originalStepIndex }),
    };
  } catch (err) {
    // Sub-workflow navigation steps (start-sub-workflow, close-sub-workflow) are not
    // meaningful for AI context — skip them rather than failing the whole run.
    if (err instanceof UnsupportedStepTypeError) return null;
    throw err;
  }
}

// Mirrors the orchestrator's own read filter: revised and cancelled entries are not on the
// live path.
function toPreviousSteps(
  history: ServerStepHistory[],
  pendingStepIndex: number,
  excludedStepIndexes: number[],
): ReadonlyArray<Step> {
  const excluded = new Set(excludedStepIndexes);

  return history
    .filter(s => s.done && !s.revised && !s.cancelled && s.stepIndex < pendingStepIndex)
    .filter(s => !excluded.has(s.stepIndex))
    .map(s => tryMapStep(s))
    .filter((s): s is Step => s !== null);
}

// A missing, empty or non-string wire value reads as absent: a call sending neither the pin nor the
// called collection behaves as one that predates them.
const ROOT_FRAME = -1;

function toNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function toCallRecordIndex(context: ServerStepHistory['context']): number | undefined {
  const value = context?.callRecordIndex;

  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

interface Call {
  stepId: string;
  stepIndex: number;
  frameOpenedAt: number;
  definition: ServerStartSubWorkflow;
  callRecordIndex?: number;
  // Every step run inside the call, nested calls included.
  stepIndexes: number[];
}

interface CallStackWalk {
  openCalls: Call[];
  closedCalls: Array<{ call: Call; endStepId: string }>;
  // Sub-workflow steps the orchestrator skipped because their load was empty: no call, no End.
  skippedCalls: Array<{ stepId: string; stepIndex: number; frameOpenedAt: number }>;
  // Tracked per step rather than as a range, because a frame's steps resume after each nested call.
  frameOfStep: Map<number, number>;
  stepNameOf: Map<number, string>;
}

// Rebuilt from the raw history because previousSteps drops the navigation steps, and read the way
// the orchestrator reads its own call stack so the two agree on which call is open.
function walkCallStack(history: ServerStepHistory[], pending: ServerStepHistory): CallStackWalk {
  const openCalls: Call[] = [];
  const closedCalls: CallStackWalk['closedCalls'] = [];
  const skippedCalls: CallStackWalk['skippedCalls'] = [];
  const frameOfStep = new Map<number, number>();
  const stepNameOf = new Map<number, string>();

  history.forEach(entry => {
    if (entry.revised || entry.cancelled || entry.stepIndex >= pending.stepIndex) return;
    const frameOpenedAt = openCalls.at(-1)?.stepIndex ?? ROOT_FRAME;

    // A Sub-workflow the orchestrator skipped because its load was empty opened no call.
    if (entry.context?.skippedForNoRecord === true) {
      skippedCalls.push({ stepId: entry.stepName, stepIndex: entry.stepIndex, frameOpenedAt });

      return;
    }

    if (entry.stepDefinition.type === ServerStepTypeEnum.StartSubWorkflow) {
      openCalls.push({
        stepId: entry.stepName,
        stepIndex: entry.stepIndex,
        frameOpenedAt,
        definition: entry.stepDefinition,
        callRecordIndex: toCallRecordIndex(entry.context),
        stepIndexes: [],
      });
    } else if (entry.stepDefinition.type === ServerStepTypeEnum.CloseSubWorkflow) {
      const closed = openCalls.pop();

      if (closed) {
        openCalls.at(-1)?.stepIndexes.push(...closed.stepIndexes);
        // The close step keeps the step key of the End the called workflow reached.
        closedCalls.push({ call: closed, endStepId: entry.stepName });
      }
    } else {
      frameOfStep.set(entry.stepIndex, frameOpenedAt);
      stepNameOf.set(entry.stepIndex, entry.stepName);
      openCalls.at(-1)?.stepIndexes.push(entry.stepIndex);
    }
  });

  return { openCalls, closedCalls, skippedCalls, frameOfStep, stepNameOf };
}

// Undefined for a step of a called workflow while no call is open, a history with no frame to read.
function frameOfPending(walk: CallStackWalk, pending: ServerStepHistory): number | undefined {
  if (!pending.childrenWorkflowId) return ROOT_FRAME;

  return walk.openCalls.at(-1)?.stepIndex;
}

// Step ids are unique only per workflow, so only the calls the pending step's own workflow made
// can answer for it: a nested call's End belongs to the step that made it, not to its caller.
// A navigation entry with no name is dropped rather than failing the whole run's validation.
// A Sub-workflow step whose latest run was once per record reached one End per record, so it is
// reported as such rather than by the End of whichever record ran last.
function toSubWorkflowEnds(
  walk: CallStackWalk,
  pending: ServerStepHistory,
): SubWorkflowEnd[] | undefined {
  const frame = frameOfPending(walk, pending);
  // A pass skipped for no record reached no End, so it hides the End an earlier pass reached.
  const latestEndOf = new Map<string, { stepIndex: number; end: SubWorkflowEnd | null }>();
  const keepLatest = (stepId: string, stepIndex: number, end: SubWorkflowEnd | null) => {
    if ((latestEndOf.get(stepId)?.stepIndex ?? -1) < stepIndex) {
      latestEndOf.set(stepId, { stepIndex, end });
    }
  };

  walk.closedCalls
    .filter(({ call, endStepId }) => call.frameOpenedAt === frame && call.stepId && endStepId)
    .forEach(({ call, endStepId }) =>
      keepLatest(
        call.stepId,
        call.stepIndex,
        call.callRecordIndex !== undefined
          ? { stepId: call.stepId, perRecord: true }
          : { stepId: call.stepId, endStepId },
      ),
    );
  walk.skippedCalls
    .filter(skipped => skipped.frameOpenedAt === frame)
    .forEach(skipped => keepLatest(skipped.stepId, skipped.stepIndex, null));

  const ends = [...latestEndOf.values()].flatMap(({ end }) => (end ? [end] : []));

  return ends.length > 0 ? ends : undefined;
}

// excludedStepIndexes: inside calls opened once per record, the steps of every closed call opened
// once per record of the same Multiple step from the same calling frame for another record: another
// record's run, at any level of nesting. A call for the same record of the same run of that step
// stays in, and so does a call pinned to another Multiple step, which held none of these records.
function toCallScope(
  walk: CallStackWalk,
  pending: ServerStepHistory,
): { callScope?: CallScope; excludedStepIndexes: number[] } {
  const { openCalls, frameOfStep, stepNameOf } = walk;
  const closedRecordCalls = walk.closedCalls
    .map(({ call }) => call)
    .filter(call => call.callRecordIndex !== undefined);

  // A root step needs its frame too once a call has run: a closed call repeating a step id would
  // otherwise answer a root pin with its own record.
  if (!pending.childrenWorkflowId) {
    const rootStepIndexes = [...frameOfStep]
      .filter(([, frame]) => frame === ROOT_FRAME)
      .map(([stepIndex]) => stepIndex);

    return {
      excludedStepIndexes: [],
      ...(rootStepIndexes.length < frameOfStep.size && {
        callScope: { currentFrameStepIndexes: rootStepIndexes },
      }),
    };
  }

  const innermost = openCalls.at(-1);
  if (!innermost) return { excludedStepIndexes: [] };

  // The steps of the frame a call opened from that ran before it, where its pin is read.
  const pinnedFrameOf = (call: Call) =>
    [...frameOfStep]
      .filter(([stepIndex, frame]) => frame === call.frameOpenedAt && stepIndex < call.stepIndex)
      .map(([stepIndex]) => stepIndex);

  // A call pinning "workflow start" pins what that phrase means where it was written — the record
  // its own caller pinned — so the pin resolves outwards, and ends on the run's record.
  const pinOf = (call: Call) =>
    toNonEmptyString(call.definition.preRecordedArgs?.selectedRecordStepId);
  const pinnedBy = [...openCalls].reverse().find(call => pinOf(call) !== WORKFLOW_START_STEP_ID);
  const pin = pinnedBy && pinOf(pinnedBy);

  const calledWorkflowCollectionName = toNonEmptyString(
    innermost.definition.calledWorkflowCollectionName,
  );

  // Step ids are unique only per workflow, so outside the frame that wrote the pin a copy, a
  // self-call or an already closed sibling would answer with its own record.
  const pinnedFrameStepIndexes = pinnedBy && pinnedFrameOf(pinnedBy);

  const currentFrameStepIndexes = [...frameOfStep]
    .filter(([, frame]) => frame === innermost.stepIndex)
    .map(([stepIndex]) => stepIndex);

  // The run of its Multiple step a call's record index counts in, undefined when none is in view.
  const sourceOf = (call: Call) => {
    const callPin = pinOf(call);

    return pinnedFrameOf(call)
      .filter(stepIndex => stepNameOf.get(stepIndex) === callPin)
      .at(-1);
  };

  const isSameRecordCall = (a: Call, b: Call) => {
    const source = sourceOf(a);

    return (
      source !== undefined && source === sourceOf(b) && a.callRecordIndex === b.callRecordIndex
    );
  };

  // A call pinned to the same Multiple step can hold another of these records, an earlier run of
  // that step included, since it may load the same records again. One pinned to another Multiple
  // step held none of them, so it reads whole, as CallRecordRunStore reads that step's rows.
  const isOtherRecordCall = (closed: Call, open: Call) =>
    pinOf(closed) === pinOf(open) && !isSameRecordCall(closed, open);

  // Outermost first, so each one's record narrows what the calls inside it read.
  const recordCalls = openCalls.filter(
    call => call.callRecordIndex !== undefined && pinOf(call) !== undefined,
  );
  const excludedStepIndexes = closedRecordCalls
    .filter(closed =>
      recordCalls.some(
        open => closed.frameOpenedAt === open.frameOpenedAt && isOtherRecordCall(closed, open),
      ),
    )
    .flatMap(call => call.stepIndexes);

  return {
    excludedStepIndexes,
    callScope: {
      currentFrameStepIndexes,
      startStepIndex: innermost.stepIndex,
      ...(pinnedBy !== undefined &&
        pin !== undefined && { selectedRecordStepId: pin, pinnedFrameStepIndexes }),
      ...(calledWorkflowCollectionName !== undefined && { calledWorkflowCollectionName }),
      ...(pinOf(innermost) !== undefined && { isPinned: true as const }),
      ...(recordCalls.length > 0 && {
        recordCalls: recordCalls.map(call => ({
          selectedRecordStepId: pinOf(call) as string,
          pinnedFrameStepIndexes: pinnedFrameOf(call),
          recordIndex: call.callRecordIndex as number,
          startStepIndex: call.stepIndex,
        })),
      }),
    },
  };
}

function toStepUser(runId: number, profile: ServerUserProfile): StepUser {
  // renderingId is stringified into the activity-log payload — reject non-finite so we don't
  // silently post "undefined"/"NaN" to the audit trail.
  if (typeof profile.renderingId !== 'number' || !Number.isFinite(profile.renderingId)) {
    throw new InvalidStepDefinitionError(
      `Run ${runId} userProfile has no valid renderingId (got "${String(profile.renderingId)}")`,
    );
  }

  return toSharedStepUser(profile);
}

function carriesError(pending: ServerStepHistory): boolean {
  const { error } = (pending.context ?? {}) as { error?: unknown };

  return typeof error === 'string' && error.length > 0;
}

// Returns null when the run has no available step (terminal state or all done/cancelled).
// Throws InvalidStepDefinitionError on missing required fields (collectionId, collectionName,
// userProfile) or an unmappable step definition.
export default function toAvailableStepExecution(
  run: ServerHydratedWorkflowRun,
): AvailableStepExecution | null {
  if (!run.collectionName) {
    throw new InvalidStepDefinitionError(
      `Run ${run.id} has no collectionName — cannot build baseRecordRef`,
    );
  }

  if (!run.collectionId) {
    throw new InvalidStepDefinitionError(
      `Run ${run.id} has no collectionId — cannot build baseRecordRef`,
    );
  }

  if (!run.selectedRecordId) {
    throw new InvalidStepDefinitionError(
      `Run ${run.id} has no selectedRecordId — cannot build baseRecordRef`,
    );
  }

  const pending = run.workflowHistory.at(-1) ?? null;
  if (!pending || pending.done) return null;

  const callStack = walkCallStack(run.workflowHistory, pending);
  const { callScope, excludedStepIndexes } = toCallScope(callStack, pending);
  const subWorkflowEnds = toSubWorkflowEnds(callStack, pending);
  const workflowName = toNonEmptyString(run.workflowName);
  const approvalRequests = toApprovalRequestReviews(pending.context);

  const result = {
    runId: String(run.id),
    stepId: pending.stepName,
    stepIndex: pending.stepIndex,
    collectionId: run.collectionId,
    triggerType: run.triggerType ?? ServerWorkflowTriggerType.manual,
    baseRecordRef: {
      collectionName: run.collectionName,
      recordId: deserializeRecordId(run.selectedRecordId),
      stepIndex: 0,
    },
    stepDefinition: toStepDefinition(pending.stepDefinition),
    previousSteps: toPreviousSteps(run.workflowHistory, pending.stepIndex, excludedStepIndexes),
    user: toStepUser(run.id, run.userProfile),
    // UTC when the project has none set, when the orchestrator is too old to send one, and when
    // the name is not a zone Luxon knows: a relative date must resolve the same on every executor
    // instance, so the machine's zone is never the fallback. The zone actually used is persisted
    // with the evaluation, so the run view shows UTC rather than the name it fell back from.
    // This branch is the main path, not an edge case: 635 of 85457 projects carry a timezone
    // (0.7%, measured on production in September 2026), so almost every Decision reads its
    // relative dates in UTC — an hour or two away from the day the list filter shows the same
    // user, since that one follows the browser.
    timezone: toProjectTimezone(run.timezone),
    ...(callScope && { callScope }),
    ...(subWorkflowEnds && { subWorkflowEnds }),
    ...(carriesError(pending) && { carriesError: true as const }),
    ...(workflowName && { workflowName }),
    ...(approvalRequests && { approvalRequests }),
  };

  // Defense against mapper bugs: zod asserts the shape we produce is what the domain expects,
  // before any executor consumes it. Fails loudly with a typed error instead of crashing deep.

  try {
    return AvailableStepExecutionSchema.parse(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      throw new DomainValidationError(run.id, err);
    }

    /* istanbul ignore next — zod.parse only throws ZodError; defensive fallback */
    throw err;
  }
}

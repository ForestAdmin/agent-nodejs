import type {
  ServerHydratedWorkflowRun,
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

import { deserializeRecordId } from './record-id-serializer';
import { ServerWorkflowTriggerType } from './server-types';
import toStepDefinition from './step-definition-mapper';
import {
  DomainValidationError,
  InvalidStepDefinitionError,
  UnsupportedStepTypeError,
} from '../errors';
import {
  type AvailableStepExecution,
  AvailableStepExecutionSchema,
  type Step,
  type StepUser,
} from '../types/validated/execution';
import {
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

  return { type: 'record', ...baseFromCtx, status } satisfies RecordStepOutcome;
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
): ReadonlyArray<Step> {
  return history
    .filter(s => s.done && !s.revised && !s.cancelled && s.stepIndex < pendingStepIndex)
    .map(s => tryMapStep(s))
    .filter((s): s is Step => s !== null);
}

function toStepUser(runId: number, profile: ServerUserProfile): StepUser {
  // renderingId is stringified into the activity-log payload — reject non-finite so we don't
  // silently post "undefined"/"NaN" to the audit trail.
  if (typeof profile.renderingId !== 'number' || !Number.isFinite(profile.renderingId)) {
    throw new InvalidStepDefinitionError(
      `Run ${runId} userProfile has no valid renderingId (got "${String(profile.renderingId)}")`,
    );
  }

  return {
    id: profile.id,
    email: profile.email,
    firstName: profile.firstName ?? '',
    lastName: profile.lastName ?? '',
    team: profile.team ?? '',
    renderingId: profile.renderingId,
    role: profile.role ?? '',
    permissionLevel: profile.permissionLevel ?? '',
    tags: profile.tags,
  };
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
    previousSteps: toPreviousSteps(run.workflowHistory, pending.stepIndex),
    user: toStepUser(run.id, run.userProfile),
    // UTC when the project has none set, and when the orchestrator is too old to send one: a
    // relative date must resolve the same on every executor instance, so the machine's zone is
    // never the fallback.
    timezone: run.timezone || 'UTC',
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

import type {
  ServerHydratedWorkflowRun,
  ServerStepHistory,
  ServerUserProfile,
} from './server-types';
import type { PendingStepExecution, Step, StepUser } from '../types/execution';
import type {
  ConditionStepOutcome,
  GuidanceStepOutcome,
  McpStepOutcome,
  RecordStepOutcome,
  StepOutcome,
} from '../types/step-outcome';

import toStepDefinition from './step-definition-mapper';
import { InvalidStepDefinitionError } from '../errors';
import { stepTypeToOutcomeType } from '../types/step-outcome';

function toRecordStatus(ctxStatus: unknown): RecordStepOutcome['status'] {
  if (ctxStatus === 'error') return 'error';
  if (ctxStatus === 'awaiting-input') return 'awaiting-input';

  return 'success';
}

/**
 * Build a StepOutcome from a server history entry.
 *
 * `context` may come from the executor (our StepOutcome format, stored verbatim)
 * or from the legacy frontend (free-form object). We whitelist known StepOutcome
 * fields per type to:
 *   - avoid leaking legacy/unknown fields (privacy concern — outcomes are sent
 *     back to the orchestrator)
 *   - enforce the discriminated union shape (e.g. ConditionStepOutcome status
 *     can only be 'success' | 'error')
 */
function toStepOutcome(s: ServerStepHistory): StepOutcome {
  const stepDef = toStepDefinition(s.stepDefinition);
  const outcomeType = stepTypeToOutcomeType(stepDef.type);
  const ctx = (s.context ?? {}) as Record<string, unknown>;

  const baseFromCtx = {
    stepId: s.stepName,
    stepIndex: s.stepIndex,
    error: typeof ctx.error === 'string' ? ctx.error : undefined,
  };

  if (outcomeType === 'condition') {
    const status: ConditionStepOutcome['status'] = ctx.status === 'error' ? 'error' : 'success';
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

function toPreviousSteps(
  history: ServerStepHistory[],
  pendingStepIndex: number,
): ReadonlyArray<Step> {
  return history
    .filter(s => s.done && s.stepIndex < pendingStepIndex)
    .map(s => ({
      stepDefinition: toStepDefinition(s.stepDefinition),
      stepOutcome: toStepOutcome(s),
    }));
}

function toStepUser(runId: number, profile: ServerUserProfile | undefined): StepUser {
  if (!profile) {
    throw new InvalidStepDefinitionError(`Run ${runId} has no userProfile — cannot build StepUser`);
  }

  // renderingId flows into the Forest activity-log payload as a String. Reject
  // at the boundary to avoid silently posting `"undefined"` / `"NaN"` to the
  // audit trail.
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

/**
 * Convert a server HydratedWorkflowRun into an executor PendingStepExecution,
 * or return null if the run has no pending step (terminal state or all steps done).
 *
 * A "pending" step is the first entry in `workflowHistory` that is not `done` and
 * not `cancelled`.
 *
 * Throws InvalidStepDefinitionError when the run is missing required fields
 * (collectionName, userProfile) or when a step definition cannot be mapped.
 */
export default function toPendingStepExecution(
  run: ServerHydratedWorkflowRun,
): PendingStepExecution | null {
  if (!run.collectionName) {
    throw new InvalidStepDefinitionError(
      `Run ${run.id} has no collectionName — cannot build baseRecordRef`,
    );
  }

  const pending = run.workflowHistory.find(s => !s.done && !s.cancelled);
  if (!pending) return null;

  return {
    runId: String(run.id),
    stepId: pending.stepName,
    stepIndex: pending.stepIndex,
    baseRecordRef: {
      collectionName: run.collectionName,
      recordId: [run.selectedRecordId],
      stepIndex: 0,
    },
    stepDefinition: toStepDefinition(pending.stepDefinition),
    previousSteps: toPreviousSteps(run.workflowHistory, pending.stepIndex),
    user: toStepUser(run.id, run.userProfile),
  };
}

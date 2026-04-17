import type { ServerHydratedWorkflowRun, ServerStepHistory, ServerUserProfile } from './server-types';
import type { PendingStepExecution, Step, StepUser } from '../types/execution';
import type { StepOutcome } from '../types/step-outcome';

import { InvalidStepDefinitionError } from '../errors';
import { StepType } from '../types/step-definition';
import toStepDefinition from './step-definition-mapper';

/**
 * Convert a server HydratedWorkflowRun into an executor PendingStepExecution,
 * or return null if the run has no pending step (terminal state or all steps done).
 *
 * A "pending" step is the first entry in `workflowHistory` that is not `done` and
 * not `cancelled`.
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
    user: toStepUser(run.userProfile),
  };
}

/**
 * Build the `previousSteps` array from done steps preceding the pending one.
 *
 * `context` may come from the executor (our StepOutcome format, stored under
 * `attributes.context`) or from the legacy frontend (free-form object). We best-effort
 * recover a StepOutcome; if the context does not match, we synthesize a minimal one.
 */
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

function toStepOutcome(s: ServerStepHistory): StepOutcome {
  const ctx = s.context as Partial<StepOutcome> | undefined;

  // If the context looks like one of our StepOutcome shapes, trust it.
  if (ctx && typeof ctx === 'object' && typeof ctx.type === 'string' && typeof ctx.status === 'string') {
    return { ...ctx, stepId: s.stepName, stepIndex: s.stepIndex } as StepOutcome;
  }

  // Otherwise synthesize a minimal success outcome based on the step type.
  const stepDef = toStepDefinition(s.stepDefinition);
  const outcomeType = stepTypeToOutcomeType(stepDef.type);

  return {
    type: outcomeType,
    stepId: s.stepName,
    stepIndex: s.stepIndex,
    status: 'success',
  } as StepOutcome;
}

function stepTypeToOutcomeType(type: StepType): 'condition' | 'record' | 'mcp' | 'guidance' {
  if (type === StepType.Condition) return 'condition';
  if (type === StepType.Mcp) return 'mcp';
  if (type === StepType.Guidance) return 'guidance';
  return 'record';
}

function toStepUser(profile: ServerUserProfile | undefined): StepUser {
  if (!profile) {
    // Server might omit userProfile — return a placeholder user with the minimum needed.
    return {
      id: 0,
      email: '',
      firstName: '',
      lastName: '',
      team: '',
      renderingId: 0,
      role: '',
      permissionLevel: '',
      tags: {},
    };
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

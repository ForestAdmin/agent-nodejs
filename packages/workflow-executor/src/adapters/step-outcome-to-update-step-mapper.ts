import type {
  ServerExecutionStatus,
  ServerStepHistoryUpdate,
  ServerUpdateStepRequest,
} from './server-types';
import type { StepOutcome } from '../types/step-outcome';

function toExecutionStatus(outcome: StepOutcome): ServerExecutionStatus {
  if (outcome.status === 'error') {
    // Joi.string().required() on the server rejects empty strings — fall back
    // so an executor that produces error='' doesn't trigger an infinite re-dispatch.
    return { type: 'error', message: outcome.error || 'Unknown error' };
  }

  if (outcome.status === 'awaiting-input') {
    return { type: 'awaiting-input' };
  }

  return { type: 'success' };
}

/**
 * Convert an executor StepOutcome into the body expected by
 * POST /api/workflow-orchestrator/update-step.
 *
 * Mirrors `run-to-pending-step-mapper.ts` in the reverse direction: the reverse
 * mapper reads `status`, `error`, `selectedOption` from `ServerStepHistory.context`,
 * so we write them into `context` here to keep the round-trip ISO.
 */
export default function toUpdateStepRequest(
  runId: string,
  outcome: StepOutcome,
): ServerUpdateStepRequest {
  const context: Record<string, unknown> = { status: outcome.status };
  if (outcome.error !== undefined) context.error = outcome.error;

  if (outcome.type === 'condition' && outcome.selectedOption !== undefined) {
    context.selectedOption = outcome.selectedOption;
  }

  const attributes: ServerStepHistoryUpdate = {
    done: outcome.status !== 'awaiting-input',
    context,
  };

  return {
    runId: Number(runId),
    stepUpdate: { stepIndex: outcome.stepIndex, attributes },
    executionStatus: toExecutionStatus(outcome),
  };
}

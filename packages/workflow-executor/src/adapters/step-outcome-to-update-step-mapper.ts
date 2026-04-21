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

// Write to `context` so the round-trip with run-to-pending-step-mapper stays ISO (reverse mapper
// reads status/error/selectedOption from ServerStepHistory.context).
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

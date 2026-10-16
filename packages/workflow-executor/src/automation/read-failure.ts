import type { SegmentReadFailureKind } from '../errors';
import type { SegmentReadFailure, SegmentReadFailureReason } from '../types/automation';

import { SegmentReadError } from '../errors';

const READ_FAILURE_REASONS: Record<SegmentReadFailureKind, SegmentReadFailureReason> = {
  forbidden: 'agent-forbidden',
  unreachable: 'agent-unreachable',
  overloaded: 'segment-read-failed',
  failed: 'segment-read-failed',
};

export function toReadFailure(error: unknown): SegmentReadFailure {
  if (!(error instanceof SegmentReadError)) return { reason: 'segment-read-failed' };

  const { failure, httpStatus } = error;
  const reason = READ_FAILURE_REASONS[failure];

  return httpStatus === undefined ? { reason } : { reason, httpStatus };
}

// Some agents refuse an undeclared operator with a plain failure rather than a refusal, so any
// `failed` read may be one. An unreachable or overloaded agent rules it out, and padding then would
// evaluate the segment again on top of the read the agent may still be running; a forbidden read
// would refuse the padded one just the same.
export function mayBeOperatorRefusal(error: unknown): boolean {
  return !(error instanceof SegmentReadError) || error.failure === 'failed';
}

// An agent rejects a sort on a field it does not know with a 4xx, and one on a relation the service
// account cannot read with a refusal. Anything else says nothing about the sort, and a segment that
// timed out its database would only be evaluated twice.
export function mayBeSortRefusal(error: unknown): boolean {
  if (!(error instanceof SegmentReadError)) return false;
  if (error.failure === 'forbidden') return true;

  return (
    error.failure === 'failed' &&
    error.httpStatus !== undefined &&
    error.httpStatus >= 400 &&
    error.httpStatus < 500
  );
}

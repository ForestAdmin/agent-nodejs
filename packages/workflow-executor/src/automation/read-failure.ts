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

// An agent rejects a sort on a field it does not know as a plain failure, and one on a relation the
// service account cannot read as a refusal. An unreachable or overloaded agent says nothing about
// the sort, and reading again would only add load.
export function mayBeSortRefusal(error: unknown): boolean {
  return (
    error instanceof SegmentReadError &&
    (error.failure === 'failed' || error.failure === 'forbidden')
  );
}

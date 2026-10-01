import type { SegmentReadFailureKind } from '../errors';
import type {
  InboxAssignment,
  SegmentReadFailure,
  SegmentReadFailureReason,
} from '../types/automation';

import { SegmentReadError } from '../errors';
import { deserializeRecordId } from '../record-id';

// One membership question per chunk, small enough that a `pk In (...)` stays a query an agent will
// accept whatever its datasource.
export const MEMBERSHIP_CHUNK_SIZE = 50;

// Ceiling on the padded fallback page. The padding grows with the backlog while the agent read is
// bounded by the client's ten-second timeout, so past some size the page stops being served at all.
export const MAX_CANDIDATE_PAGE_SIZE = 500;

// Records waiting on a person stay known for as long as nobody handles them, so one padded page can
// hold nothing but them. Bounds the reads a sweep makes on the customer's agent to walk past them.
export const MAX_PADDED_PAGES = 5;

const RECONCILABLE_ASSIGNMENT_STATES: ReadonlySet<string> = new Set([
  'done',
  'canceled',
  'auto-canceled',
]);

const TERMINAL_RUN_STATES: ReadonlySet<string> = new Set(['finished', 'aborted']);

const LIVE_RUN_STATES: ReadonlySet<string> = new Set(['started', 'pending', 'loading']);

const OPEN_ASSIGNMENT_STATES: ReadonlySet<string> = new Set(['todo', 'doing']);

const isTerminalRun = (runState: string | null | undefined): boolean =>
  runState != null && TERMINAL_RUN_STATES.has(runState);

const isLiveRun = (runState: string | null | undefined): boolean =>
  runState != null && LIVE_RUN_STATES.has(runState);

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

// A refused `not_in` comes back as a 4xx or a 500 depending on the agent (PHP answers 500 even for
// an undeclared operator). Only a timeout, an unreachable agent or a throttle rules it out, and
// padding then would evaluate the segment again on top of the read the agent may still be running.
// A 401 or 403 would refuse the padded read just the same.
export function mayBeOperatorRefusal(error: unknown): boolean {
  return !(error instanceof SegmentReadError) || error.failure === 'failed';
}

export function withUnknownState(assignments: InboxAssignment[]): InboxAssignment[] {
  return assignments.filter(
    ({ state }) => !RECONCILABLE_ASSIGNMENT_STATES.has(state) && !OPEN_ASSIGNMENT_STATES.has(state),
  );
}

// The orchestrator keeps the row of an ended run `doing` while its record is still in the
// segment, so that record is only released once it is seen leaving. An assignment with no
// workflowRunId was made by a person, not the orchestrator, which binds the run first: there is
// nothing to reconcile, so it stays out of the report — the record stays known, and no automated
// run is ever started over the human's work. Keyed on the run's presence, not its state: the
// orchestrator binds a run before an automated assignment and its `runState` is NOT NULL, so a
// bound run with a null state is a contract break, not a human assignment — it belongs here so
// `withUnexpectedRunState` surfaces it instead of dropping it silently.
export function reconcilable(assignments: InboxAssignment[]): InboxAssignment[] {
  return assignments.filter(
    ({ state, runState, workflowRunId }) =>
      workflowRunId != null &&
      (RECONCILABLE_ASSIGNMENT_STATES.has(state) || (state === 'doing' && isTerminalRun(runState))),
  );
}

// A run state this executor cannot place: a non-null one it predates, or null on a bound run —
// which the orchestrator's schema (NOT NULL runState behind a cascading FK) should never emit, so
// it is a contract break worth surfacing until a fix lands. The human assignment never reaches
// here — it has no workflowRunId, so warning forever would be noise it could never resolve.
export function withUnexpectedRunState(assignments: InboxAssignment[]): InboxAssignment[] {
  return assignments.filter(({ runState }) => !isTerminalRun(runState) && !isLiveRun(runState));
}

// A record whose run is still going is not judged yet, whatever its assignments say. Judged per
// record rather than per assignment: nothing in the contract says a record holds only one, and one
// terminal assignment must not speak for a sibling whose run is still alive.
export function recordsToCheck(
  assignments: InboxAssignment[],
  reconcilableAssignments: InboxAssignment[],
): string[] {
  const liveRecords = new Set(
    assignments.filter(({ runState }) => !isTerminalRun(runState)).map(a => a.recordId),
  );

  return [
    ...new Set(
      reconcilableAssignments
        .filter(({ recordId }) => !liveRecords.has(recordId))
        .map(({ recordId }) => recordId),
    ),
  ];
}

// A packed id that does not split into as many parts as the key has columns cannot be asked about —
// the agent has the same limitation in `IdUtils.packId`.
export function isReadableRecordId(recordId: string, primaryKeys: string[]): boolean {
  return primaryKeys.length === 1 || deserializeRecordId(recordId).length === primaryKeys.length;
}

export function knownRecordIds(assignments: InboxAssignment[]): string[] {
  return [...new Set(assignments.map(({ recordId }) => recordId))];
}

export function paddedPageSize(maxConcurrentRuns: number, assignmentCount: number): number {
  return Math.min(maxConcurrentRuns + assignmentCount, MAX_CANDIDATE_PAGE_SIZE);
}

export function newCandidates(
  page: string[],
  known: ReadonlySet<string>,
  found: ReadonlySet<string>,
  room: number,
): string[] {
  return page.filter(recordId => !known.has(recordId) && !found.has(recordId)).slice(0, room);
}

export function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

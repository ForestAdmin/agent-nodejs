import type { StepUser } from './execution-context';

export type SegmentConditionTree =
  | { field: string; operator: string; value?: unknown }
  | { aggregator: string; conditions: SegmentConditionTree[] };

export type SegmentDescriptor =
  | { kind: 'smart'; name: string }
  | { kind: 'sql'; query: string; connectionName?: string | null }
  | { kind: 'filter'; conditionTree: SegmentConditionTree };

export interface PlainSortClause {
  field: string;
  ascending: boolean;
}

export interface AutomatedInbox {
  inboxId: string;
  renderingId?: number;
  workflowId?: string;
  collectionName: string;
  primaryKeys: string[];
  maxConcurrentRuns: number;
  /** Zone the segment's relative dates are read in, already resolved to a valid one. */
  timezone: string;
  liana?: string | null;
  segment: SegmentDescriptor;
  /** The inbox dispatch order, absent when records are dispatched at random. */
  sort?: PlainSortClause[];
  user: StepUser;
}

/** States stay plain strings: one a newer orchestrator introduces must not take the inbox down. */
export interface InboxAssignment {
  recordId: string;
  state: string;
  workflowRunId?: number | null;
  runState?: string | null;
}

export type SegmentReadFailureReason =
  | 'agent-forbidden'
  | 'agent-unreachable'
  | 'segment-read-failed';

export interface SegmentReadFailure {
  reason: SegmentReadFailureReason;
  httpStatus?: number;
}

export interface InboxSyncReport {
  closed: { recordId: string; stillInSegment: boolean }[];
  candidates: string[];
  readFailure?: SegmentReadFailure;
}

export interface InboxSyncResult {
  recordId: string;
  outcome: string;
}

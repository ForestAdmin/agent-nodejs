import type { PlainSortClause, SegmentDescriptor } from '../types/automation';
import type { StepUser } from '../types/execution-context';

export interface ListSegmentRecordIdsQuery {
  /** Agent-side collection name, as used in `/forest/:collectionName`. */
  collectionName: string;
  segment: SegmentDescriptor;
  /** Field names of the collection's primary key, in the order the packed record id uses. */
  primaryKeys: string[];
  user: StepUser;
  /** IANA zone the agent evaluates relative-date conditions in. */
  timezone: string;
  /** Restricts the read to these packed record ids, on top of the segment. */
  recordIds?: string[];
  /**
   * Excludes these packed record ids from the read, on top of the segment. Honoured for a
   * single-column primary key only: `not_in` takes a flat list of values.
   */
  excludedRecordIds?: string[];
  pageSize?: number;
  pageNumber?: number;
  /** Sort clauses in priority order; the agent's own order when absent or empty. */
  sort?: PlainSortClause[];
}

/**
 * Reads record ids out of a segment, on the client's agent. Separate from `AgentPort`, which only
 * ever reads one record or one relation at a time and carries no list operation.
 */
export interface SegmentReaderPort {
  /** Packed record ids (`a|b` for a composite key), in the agent's own order. */
  listRecordIds(query: ListSegmentRecordIdsQuery): Promise<string[]>;
  /**
   * Why `excludedRecordIds` cannot be used for these known records, or undefined when it can. Reads
   * the agent's capabilities only when there is something to exclude; throws when that read fails.
   */
  exclusionUnavailableReason(
    query: ExclusionQuery,
  ): Promise<ExclusionUnavailableReason | undefined>;
}

export type ExclusionUnavailableReason =
  | 'composite-key'
  | 'too-many-known-records'
  | 'unknown-liana'
  | 'field-without-not-in';

export type ExclusionQuery = Pick<
  ListSegmentRecordIdsQuery,
  'collectionName' | 'primaryKeys' | 'user' | 'timezone'
> & {
  /** Which agent answers the read, as the orchestrator names it; null when it does not say. */
  liana: string | null | undefined;
  knownRecordCount: number;
};

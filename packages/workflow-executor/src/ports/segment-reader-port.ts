import type {
  ServerAutomatedInboxServiceAccountProfile,
  ServerAutomatedSegmentDescriptor,
} from '../adapters/server-types';

export interface ListSegmentRecordIdsQuery {
  /** Agent-side collection name, as used in `/forest/:collectionName`. */
  collectionName: string;
  segment: ServerAutomatedSegmentDescriptor;
  /** Field names of the collection's primary key, in the order the packed record id uses. */
  primaryKeys: string[];
  user: ServerAutomatedInboxServiceAccountProfile;
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
}

/**
 * Reads record ids out of a segment, on the client's agent. Separate from `AgentPort`, which only
 * ever reads one record or one relation at a time and carries no list operation.
 */
export interface SegmentReaderPort {
  /** Packed record ids (`a|b` for a composite key), in the agent's own order. */
  listRecordIds(query: ListSegmentRecordIdsQuery): Promise<string[]>;
}

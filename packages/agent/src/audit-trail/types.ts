import type { Logger } from '@forestadmin/datasource-toolkit';

export type AuditOperation = 'create' | 'update' | 'delete' | 'action' | 'action_failed';

export type AuditStatus = 'pending' | 'done';

export type AuditRecord = {
  id: number;
  timestamp: string;
  operation: AuditOperation;
  collection: string;
  /** Null for a pending create — the record's primary key isn't assigned yet. */
  recordId: string | null;
  userId: number;
  /** Denormalised from the caller at write time: who acted then, not who holds that id today. */
  userFirstName: string | null;
  userLastName: string | null;
  userEmail: string | null;
  /** `action` / `action_failed` rows only. */
  actionName: string | null;
  correlationKey: string;
  previousValues: Record<string, unknown>;
  newValues: Record<string, unknown>;
  /**
   * `pending` from the moment the row is inserted (before the write runs) until it's confirmed
   * `done` afterward. A row left `pending` means the write may or may not have landed — that
   * residue is evidence a write was attempted and never confirmed, which is the point.
   */
  status: AuditStatus;
};

/** The subset known before the write runs, when the pending row is first inserted. */
export type PendingAuditRecord = Omit<AuditRecord, 'id' | 'status'>;

/** What `confirm` updates once the write (or action) has resolved. */
export type AuditRecordConfirmation = Pick<
  AuditRecord,
  'operation' | 'recordId' | 'previousValues' | 'newValues'
>;

export type AuditHistoryQuery = {
  collection: string;
  recordId: string;
  skip?: number;
  limit?: number;
  userIds?: number[];
  /** Inclusive lower bound on `timestamp` as a UTC ISO instant. */
  startTimestamp?: string;
  /** Inclusive upper bound on `timestamp` as a UTC ISO instant. */
  endTimestamp?: string;
  /** Keep only entries whose change touched at least one of these fields. */
  fields?: string[];
  /**
   * Free-text, case-insensitive substring match against `actionName`, `userFirstName`,
   * `userLastName`, `userEmail`, and the keys and scalar values of `previousValues`/`newValues` at
   * any depth. Never matches `operation`, `correlationKey`, `recordId`, `collection`, `status` or
   * `timestamp` — those are machine identifiers a user would never search, and matching them
   * produces confusing hits. A redacted value can't match a search for the real value: the real
   * value was never stored in the first place.
   */
  search?: string;
  /** Sort direction on `timestamp` (ties broken by insertion order). Defaults to `'asc'`. */
  order?: 'asc' | 'desc';
};

export type AuditCorrelationQuery = {
  collection: string;
  recordId: string;
  correlationKey: string;
};

export type AuditCorrelationsQuery = {
  collection: string;
  recordId: string;
  correlationKeys: string[];
};

export type AuditUserSummary = {
  id: number;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
};

export interface AuditStore {
  /** Inserts one `status: 'pending'` row before the write runs; returns its id. */
  insertPending(record: PendingAuditRecord): Promise<number>;
  /** Batched form of `insertPending`, for a bulk operation touching several records at once. */
  insertPendingBatch(records: PendingAuditRecord[]): Promise<number[]>;
  /** Updates a pending row to `status: 'done'` with the values known once the write resolved. */
  confirm(id: number, patch: AuditRecordConfirmation): Promise<void>;
  listByRecord(query: AuditHistoryQuery): AuditRecord[] | Promise<AuditRecord[]>;
  /** Total entries matching the query filters, ignoring `skip` / `limit`. */
  countByRecord(query: AuditHistoryQuery): number | Promise<number>;
  /** Entries recorded under one `correlationKey` for a record, oldest first. */
  listByCorrelation(query: AuditCorrelationQuery): AuditRecord[] | Promise<AuditRecord[]>;
  /** Flat list of entries recorded under any of `correlationKeys` for a record, oldest first. */
  listByCorrelations(query: AuditCorrelationsQuery): AuditRecord[] | Promise<AuditRecord[]>;
  /** Distinct authors matching the query filters, independent of pagination. */
  listDistinctUsers(
    query: Omit<AuditHistoryQuery, 'skip' | 'limit' | 'order'>,
  ): AuditUserSummary[] | Promise<AuditUserSummary[]>;
  /** One-shot bootstrap awaited by `agent.start()`. Must be idempotent. */
  init?(): Promise<void>;
}

export type AuditSink = (record: PendingAuditRecord) => void | Promise<void>;

export type AuditTrailInstrumentOptions = {
  sink?: AuditSink;
  store?: AuditStore;
  /**
   * Fields to mask, keyed by collection name. Redacted fields still produce an audit entry when
   * they change, but their value is replaced with a sentinel instead of being stored.
   */
  redact?: Record<string, string[]>;
  /**
   * When true, a failure inserting a write's pending audit row refuses the write itself — no
   * unaudited write ever happens, though a row left `pending` doesn't guarantee its values are
   * exact. When false (default), the same failure is logged and the write proceeds unaudited,
   * matching today's behavior.
   */
  critical?: boolean;
  logger?: Logger;
};

export type AuditStorageOptions = {
  /**
   * Postgres / SQL connection string for the audit database. May point at an empty database, the
   * database already used by the agent, or one that already contains the `forest` schema — the
   * schema and table are created on the fly when missing.
   */
  connectionString: string;
  /** Defaults to `forest`. */
  schema?: string;
  /** Defaults to `audit_logs`. */
  tableName?: string;
};

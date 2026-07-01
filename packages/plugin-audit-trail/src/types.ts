export type AuditOperation = 'create' | 'update' | 'delete';

export type AuditRecord = {
  timestamp: string;
  operation: AuditOperation;
  collection: string;
  recordId: string;
  userId: number;
  correlationKey: string;
  previousValues: Record<string, unknown>;
  newValues: Record<string, unknown>;
};

export type AuditSink = (record: AuditRecord) => void | Promise<void>;

export type AuditHistoryQuery = {
  collection: string;
  recordId: string;
  /** Number of (oldest-first) entries to skip. Defaults to 0. */
  skip?: number;
  /** Maximum number of entries to return. Unbounded when omitted. */
  limit?: number;
  /** Keep only entries whose `userId` is in this list. No filter when omitted. */
  userIds?: number[];
  /** Keep only entries whose `timestamp` is >= this UTC ISO instant (inclusive). */
  startTimestamp?: string;
  /** Keep only entries whose `timestamp` is <= this UTC ISO instant (inclusive). */
  endTimestamp?: string;
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

export interface AuditStore {
  append(record: AuditRecord): void | Promise<void>;
  listByRecord(query: AuditHistoryQuery): AuditRecord[] | Promise<AuditRecord[]>;
  /** Total number of entries matching the query filters, ignoring `skip` / `limit`. */
  countByRecord(query: AuditHistoryQuery): number | Promise<number>;
  /** Entries recorded under one `correlationKey` for a given record, oldest first. */
  listByCorrelation(query: AuditCorrelationQuery): AuditRecord[] | Promise<AuditRecord[]>;
  /** Flat list of entries recorded under any of `correlationKeys` for a record, oldest first. */
  listByCorrelations(query: AuditCorrelationsQuery): AuditRecord[] | Promise<AuditRecord[]>;
  /**
   * Optional one-shot bootstrap (e.g. open a connection, run migrations). The audit-trail plugin
   * awaits it during agent start, so any failure surfaces before the agent serves requests.
   * Implementations must be idempotent — the plugin may call it more than once.
   */
  init?(): Promise<void>;
}

export type AuditTrailOptions = {
  sink?: AuditSink;
  store?: AuditStore;
  /**
   * Field values to mask, keyed by collection name. A redacted field still produces an
   * audit entry when it changes (so the change is recorded), but its value is replaced
   * with a sentinel instead of being stored.
   */
  redact?: Record<string, string[]>;
};

export type AuditStorageOptions = {
  /**
   * Connection string (Postgres or plain SQL) of the database that will hold the audit log.
   * It may point to an empty database, the database already used by the agent, or a database
   * that already contains the `forest` schema. The schema and the table are created on the fly
   * when missing.
   */
  connectionString: string;
  /** Schema that namespaces Forest-owned tables. Defaults to `forest`. */
  schema?: string;
  /** Name of the audit table. Defaults to `audit_logs`. */
  tableName?: string;
};

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
  /** Total entries matching the query filters, ignoring `skip` / `limit`. */
  countByRecord(query: AuditHistoryQuery): number | Promise<number>;
  /** Entries recorded under one `correlationKey` for a record, oldest first. */
  listByCorrelation(query: AuditCorrelationQuery): AuditRecord[] | Promise<AuditRecord[]>;
  /** Flat list of entries recorded under any of `correlationKeys` for a record, oldest first. */
  listByCorrelations(query: AuditCorrelationsQuery): AuditRecord[] | Promise<AuditRecord[]>;
  /** One-shot bootstrap awaited by `agent.start()`. Must be idempotent. */
  init?(): Promise<void>;
}

export type AuditSink = (record: AuditRecord) => void | Promise<void>;

export type AuditTrailInstrumentOptions = {
  sink?: AuditSink;
  store?: AuditStore;
  /**
   * Fields to mask, keyed by collection name. Redacted fields still produce an audit entry when
   * they change, but their value is replaced with a sentinel instead of being stored.
   */
  redact?: Record<string, string[]>;
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

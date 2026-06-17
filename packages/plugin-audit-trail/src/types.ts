import type { CompositeId } from '@forestadmin/datasource-toolkit';

export type AuditOperation = 'create' | 'update' | 'delete';

export type AuditRecord = {
  timestamp: string;
  operation: AuditOperation;
  collection: string;
  recordId: CompositeId;
  userId: number;
  correlationKey: string;
  previousValues: Record<string, unknown>;
  newValues: Record<string, unknown>;
};

export type AuditSink = (record: AuditRecord) => void | Promise<void>;

export type AuditHistoryQuery = {
  collection: string;
  recordId: CompositeId;
};

export interface AuditStore {
  append(record: AuditRecord): void | Promise<void>;
  listByRecord(query: AuditHistoryQuery): AuditRecord[] | Promise<AuditRecord[]>;
}

export type AuditTrailOptions = {
  sink?: AuditSink;
  store?: AuditStore;
};

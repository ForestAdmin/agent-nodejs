import type { CompositeId, RecordData } from '@forestadmin/datasource-toolkit';

export type AuditOperation = 'create' | 'update' | 'delete';

export type AuditActor = {
  id: number;
  email: string;
  role: string;
  requestId: string;
};

export type FieldChange = {
  before: unknown;
  after: unknown;
};

export type AuditRecord = {
  timestamp: string;
  operation: AuditOperation;
  collection: string;
  recordId: CompositeId;
  actor: AuditActor;
  correlationKey: string;
  before: RecordData | null;
  after: RecordData | null;
  changes: Record<string, FieldChange>;
};

export type AuditSink = (record: AuditRecord) => void | Promise<void>;

export type AuditTrailOptions = {
  sink?: AuditSink;
};

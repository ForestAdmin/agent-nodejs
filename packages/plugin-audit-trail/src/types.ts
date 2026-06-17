import type { CompositeId } from '@forestadmin/datasource-toolkit';

export type AuditOperation = 'create' | 'update' | 'delete';

export type AuditActor = {
  id: number;
  email: string;
  role: string;
  requestId: string;
};

export type AuditRecord = {
  timestamp: string;
  operation: AuditOperation;
  collection: string;
  recordId: CompositeId;
  actor: AuditActor;
  correlationKey: string;
  previousValues: Record<string, unknown>;
  newValues: Record<string, unknown>;
};

export type AuditSink = (record: AuditRecord) => void | Promise<void>;

export type AuditTrailOptions = {
  sink?: AuditSink;
};

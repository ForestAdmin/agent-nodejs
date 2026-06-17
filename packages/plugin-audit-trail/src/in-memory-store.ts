import type { AuditHistoryQuery, AuditRecord, AuditStore } from './types';

export default class InMemoryAuditStore implements AuditStore {
  private readonly records: AuditRecord[] = [];

  append(record: AuditRecord): void {
    this.records.push(record);
  }

  listByRecord({ collection, recordId }: AuditHistoryQuery): AuditRecord[] {
    return this.records
      .filter(record => record.collection === collection && record.recordId === recordId)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }
}

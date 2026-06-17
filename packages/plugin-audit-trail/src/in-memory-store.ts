import type { AuditHistoryQuery, AuditRecord, AuditStore } from './types';

export default class InMemoryAuditStore implements AuditStore {
  private readonly records: AuditRecord[] = [];

  append(record: AuditRecord): void {
    this.records.push(record);
  }

  listByRecord({ collection, recordId }: AuditHistoryQuery): AuditRecord[] {
    const target = JSON.stringify(recordId);

    return this.records
      .filter(
        record => record.collection === collection && JSON.stringify(record.recordId) === target,
      )
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }
}

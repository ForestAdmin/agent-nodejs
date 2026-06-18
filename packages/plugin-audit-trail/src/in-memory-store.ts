import type { AuditHistoryQuery, AuditRecord, AuditStore } from './types';

export default class InMemoryAuditStore implements AuditStore {
  private readonly records: AuditRecord[] = [];

  append(record: AuditRecord): void {
    this.records.push(record);
  }

  listByRecord({ collection, recordId, skip = 0, limit }: AuditHistoryQuery): AuditRecord[] {
    const matches = this.records
      .filter(record => record.collection === collection && record.recordId === recordId)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    return matches.slice(skip, limit === undefined ? undefined : skip + limit);
  }
}

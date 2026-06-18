import type { AuditHistoryQuery, AuditRecord, AuditStore } from './types';

export default class InMemoryAuditStore implements AuditStore {
  private readonly records: AuditRecord[] = [];

  append(record: AuditRecord): void {
    this.records.push(record);
  }

  listByRecord(query: AuditHistoryQuery): AuditRecord[] {
    const { skip = 0, limit } = query;
    const matches = this.matching(query);

    return matches.slice(skip, limit === undefined ? undefined : skip + limit);
  }

  countByRecord(query: AuditHistoryQuery): number {
    return this.matching(query).length;
  }

  private matching({
    collection,
    recordId,
    userIds,
    startTimestamp,
    endTimestamp,
  }: AuditHistoryQuery): AuditRecord[] {
    return this.records
      .filter(record => record.collection === collection && record.recordId === recordId)
      .filter(record => !userIds || userIds.includes(record.userId))
      .filter(record => !startTimestamp || record.timestamp >= startTimestamp)
      .filter(record => !endTimestamp || record.timestamp <= endTimestamp)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }
}

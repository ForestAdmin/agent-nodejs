import type {
  AuditCorrelationQuery,
  AuditCorrelationsQuery,
  AuditHistoryQuery,
  AuditRecord,
  AuditStore,
} from './types';

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

  listByCorrelation({
    collection,
    recordId,
    correlationKey,
  }: AuditCorrelationQuery): AuditRecord[] {
    return this.records
      .filter(
        record =>
          record.collection === collection &&
          record.recordId === recordId &&
          record.correlationKey === correlationKey,
      )
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  listByCorrelations({
    collection,
    recordId,
    correlationKeys,
  }: AuditCorrelationsQuery): AuditRecord[] {
    const keys = new Set(correlationKeys);

    return this.records
      .filter(
        record =>
          record.collection === collection &&
          record.recordId === recordId &&
          keys.has(record.correlationKey),
      )
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  private matching({
    collection,
    recordId,
    userIds,
    startTimestamp,
    endTimestamp,
    order = 'asc',
  }: AuditHistoryQuery): AuditRecord[] {
    const direction = order === 'desc' ? -1 : 1;

    // Ties on equal timestamps fall back to append order (the stable sort keeps it), which is the
    // in-memory equivalent of the SQL store's auto-increment id — deterministic and chronological.
    return this.records
      .filter(record => record.collection === collection && record.recordId === recordId)
      .filter(record => !userIds || userIds.includes(record.userId))
      .filter(record => !startTimestamp || record.timestamp >= startTimestamp)
      .filter(record => !endTimestamp || record.timestamp <= endTimestamp)
      .sort((a, b) => direction * a.timestamp.localeCompare(b.timestamp));
  }
}

import type {
  AuditCorrelationQuery,
  AuditCorrelationsQuery,
  AuditHistoryQuery,
  AuditRecord,
  AuditRecordConfirmation,
  AuditStore,
  AuditUserSummary,
  PendingAuditRecord,
} from '../../src/audit-trail/types';

export default class InMemoryAuditStore implements AuditStore {
  private readonly records: AuditRecord[] = [];

  private nextId = 1;

  /** Test-only shortcut: seeds a complete, already-`done` record directly, bypassing pending/confirm. */
  seed(
    record: Omit<AuditRecord, 'id' | 'status'> & Partial<Pick<AuditRecord, 'id' | 'status'>>,
  ): AuditRecord {
    const id = record.id ?? this.nextId;
    this.nextId = Math.max(this.nextId, id + 1);

    const stored: AuditRecord = { status: 'done', ...record, id };
    this.records.push(stored);

    return stored;
  }

  async insertPending(record: PendingAuditRecord): Promise<number> {
    const id = this.nextId;
    this.nextId += 1;
    this.records.push({ ...record, id, status: 'pending' });

    return id;
  }

  async insertPendingBatch(records: PendingAuditRecord[]): Promise<number[]> {
    return Promise.all(records.map(record => this.insertPending(record)));
  }

  async confirm(id: number, patch: AuditRecordConfirmation): Promise<void> {
    const record = this.records.find(existing => existing.id === id);
    if (!record) return;

    Object.assign(record, patch, { status: 'done' });
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

  listDistinctUsers(
    query: Omit<AuditHistoryQuery, 'skip' | 'limit' | 'order'>,
  ): AuditUserSummary[] {
    const matches = this.matching({ ...query, order: 'asc' });
    const byUser = new Map<number, AuditUserSummary>();

    for (const record of matches) {
      byUser.set(record.userId, {
        id: record.userId,
        firstName: record.userFirstName,
        lastName: record.userLastName,
        email: record.userEmail,
      });
    }

    return [...byUser.values()];
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

    // Ties on equal timestamps fall back to insertion order (the stable sort keeps it), which is
    // the in-memory equivalent of the SQL store's auto-increment id — deterministic and chronological.
    return this.records
      .filter(record => record.collection === collection && record.recordId === recordId)
      .filter(record => !userIds || userIds.includes(record.userId))
      .filter(record => !startTimestamp || record.timestamp >= startTimestamp)
      .filter(record => !endTimestamp || record.timestamp <= endTimestamp)
      .sort((a, b) => direction * a.timestamp.localeCompare(b.timestamp));
  }
}

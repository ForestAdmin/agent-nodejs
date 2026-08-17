import type { AuditRecord } from '../../src/audit-trail';

import InMemoryAuditStore from './in-memory-store';

const record = (
  over: Partial<AuditRecord>,
): Omit<AuditRecord, 'id' | 'status'> & Partial<Pick<AuditRecord, 'id' | 'status'>> => ({
  timestamp: '2026-01-01T00:00:00.000Z',
  operation: 'update',
  collection: 'accounts',
  recordId: '1',
  userId: 1,
  userFirstName: null,
  userLastName: null,
  userEmail: null,
  actionName: null,
  correlationKey: 'r',
  previousValues: {},
  newValues: {},
  ...over,
});

describe('InMemoryAuditStore', () => {
  it('returns the records of a given record id, oldest first', () => {
    const store = new InMemoryAuditStore();
    store.seed(record({ timestamp: '2026-01-02T00:00:00.000Z', newValues: { status: 'b' } }));
    store.seed(record({ timestamp: '2026-01-01T00:00:00.000Z', newValues: { status: 'a' } }));

    const history = store.listByRecord({ collection: 'accounts', recordId: '1' });

    expect(history.map(r => r.newValues)).toEqual([{ status: 'a' }, { status: 'b' }]);
  });

  it('paginates with skip and limit, oldest first', () => {
    const store = new InMemoryAuditStore();

    for (let i = 1; i <= 5; i += 1) {
      store.seed(record({ timestamp: `2026-01-0${i}T00:00:00.000Z`, newValues: { n: i } }));
    }

    const page = store.listByRecord({ collection: 'accounts', recordId: '1', skip: 1, limit: 2 });

    expect(page.map(r => r.newValues)).toEqual([{ n: 2 }, { n: 3 }]);
  });

  it('returns all entries from skip to the end when no limit is given', () => {
    const store = new InMemoryAuditStore();

    for (let i = 1; i <= 3; i += 1) {
      store.seed(record({ timestamp: `2026-01-0${i}T00:00:00.000Z`, newValues: { n: i } }));
    }

    const page = store.listByRecord({ collection: 'accounts', recordId: '1', skip: 1 });

    expect(page.map(r => r.newValues)).toEqual([{ n: 2 }, { n: 3 }]);
  });

  it('filters out records of other ids and other collections', () => {
    const store = new InMemoryAuditStore();
    store.seed(record({ recordId: '1' }));
    store.seed(record({ recordId: '2' }));
    store.seed(record({ collection: 'contacts', recordId: '1' }));

    const history = store.listByRecord({ collection: 'accounts', recordId: '1' });

    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ collection: 'accounts', recordId: '1' });
  });

  it('matches composite (packed) record ids', () => {
    const store = new InMemoryAuditStore();
    store.seed(record({ recordId: '3|7' }));

    expect(store.listByRecord({ collection: 'accounts', recordId: '3|7' })).toHaveLength(1);
    expect(store.listByRecord({ collection: 'accounts', recordId: '3|8' })).toHaveLength(0);
  });

  it('keeps only the records whose userId is in the userIds filter', () => {
    const store = new InMemoryAuditStore();
    store.seed(record({ userId: 1, newValues: { n: 1 } }));
    store.seed(record({ userId: 2, newValues: { n: 2 } }));
    store.seed(record({ userId: 3, newValues: { n: 3 } }));

    const history = store.listByRecord({
      collection: 'accounts',
      recordId: '1',
      userIds: [1, 3],
    });

    expect(history.map(r => r.userId)).toEqual([1, 3]);
  });

  it('keeps only records within the inclusive startTimestamp/endTimestamp range', () => {
    const store = new InMemoryAuditStore();
    store.seed(record({ timestamp: '2026-01-01T00:00:00.000Z', newValues: { n: 1 } }));
    store.seed(record({ timestamp: '2026-01-02T00:00:00.000Z', newValues: { n: 2 } }));
    store.seed(record({ timestamp: '2026-01-03T00:00:00.000Z', newValues: { n: 3 } }));

    const history = store.listByRecord({
      collection: 'accounts',
      recordId: '1',
      startTimestamp: '2026-01-02T00:00:00.000Z',
      endTimestamp: '2026-01-03T00:00:00.000Z',
    });

    expect(history.map(r => r.newValues)).toEqual([{ n: 2 }, { n: 3 }]);
  });

  it('combines the userIds and the timestamp range filters (AND)', () => {
    const store = new InMemoryAuditStore();
    store.seed(record({ userId: 1, timestamp: '2026-01-01T00:00:00.000Z', newValues: { n: 1 } }));
    store.seed(record({ userId: 1, timestamp: '2026-01-05T00:00:00.000Z', newValues: { n: 2 } }));
    store.seed(record({ userId: 2, timestamp: '2026-01-02T00:00:00.000Z', newValues: { n: 3 } }));

    const history = store.listByRecord({
      collection: 'accounts',
      recordId: '1',
      userIds: [1],
      startTimestamp: '2026-01-01T00:00:00.000Z',
      endTimestamp: '2026-01-03T00:00:00.000Z',
    });

    expect(history.map(r => r.newValues)).toEqual([{ n: 1 }]);
  });

  it('returns an empty list for an unknown record', () => {
    expect(
      new InMemoryAuditStore().listByRecord({ collection: 'accounts', recordId: '99' }),
    ).toEqual([]);
  });

  it('orders newest first when order is desc', () => {
    const store = new InMemoryAuditStore();
    store.seed(record({ timestamp: '2026-01-01T00:00:00.000Z', newValues: { n: 1 } }));
    store.seed(record({ timestamp: '2026-01-02T00:00:00.000Z', newValues: { n: 2 } }));

    const history = store.listByRecord({ collection: 'accounts', recordId: '1', order: 'desc' });

    expect(history.map(r => r.newValues)).toEqual([{ n: 2 }, { n: 1 }]);
  });

  it('keeps equal-timestamp entries in insertion order, stable across pages', () => {
    const store = new InMemoryAuditStore();
    const timestamp = '2026-01-01T00:00:00.000Z';
    store.seed(record({ timestamp, newValues: { n: 1 } }));
    store.seed(record({ timestamp, newValues: { n: 2 } }));
    store.seed(record({ timestamp, newValues: { n: 3 } }));

    const page1 = store.listByRecord({ collection: 'accounts', recordId: '1', skip: 0, limit: 2 });
    const page2 = store.listByRecord({ collection: 'accounts', recordId: '1', skip: 2, limit: 2 });

    expect(page1.map(r => r.newValues)).toEqual([{ n: 1 }, { n: 2 }]);
    expect(page2.map(r => r.newValues)).toEqual([{ n: 3 }]);
  });

  describe('countByRecord', () => {
    it('counts all matching entries, ignoring skip and limit', () => {
      const store = new InMemoryAuditStore();

      for (let i = 1; i <= 5; i += 1) {
        store.seed(record({ timestamp: `2026-01-0${i}T00:00:00.000Z` }));
      }

      expect(
        store.countByRecord({ collection: 'accounts', recordId: '1', skip: 2, limit: 1 }),
      ).toBe(5);
    });

    it('reflects the active filters', () => {
      const store = new InMemoryAuditStore();
      store.seed(record({ userId: 1, timestamp: '2026-01-01T00:00:00.000Z' }));
      store.seed(record({ userId: 2, timestamp: '2026-01-02T00:00:00.000Z' }));
      store.seed(record({ userId: 1, timestamp: '2026-01-05T00:00:00.000Z' }));

      const count = store.countByRecord({
        collection: 'accounts',
        recordId: '1',
        userIds: [1],
        startTimestamp: '2026-01-01T00:00:00.000Z',
        endTimestamp: '2026-01-03T00:00:00.000Z',
      });

      expect(count).toBe(1);
    });
  });

  describe('listByCorrelation', () => {
    it('returns the entries recorded under a correlationKey for a record, oldest first', () => {
      const store = new InMemoryAuditStore();
      store.seed(
        record({
          correlationKey: 'req-1',
          timestamp: '2026-01-02T00:00:00.000Z',
          newValues: { n: 2 },
        }),
      );
      store.seed(
        record({
          correlationKey: 'req-1',
          timestamp: '2026-01-01T00:00:00.000Z',
          newValues: { n: 1 },
        }),
      );
      store.seed(record({ correlationKey: 'req-2', newValues: { n: 9 } }));

      const history = store.listByCorrelation({
        collection: 'accounts',
        recordId: '1',
        correlationKey: 'req-1',
      });

      expect(history.map(r => r.newValues)).toEqual([{ n: 1 }, { n: 2 }]);
    });

    it('scopes to the given record and collection', () => {
      const store = new InMemoryAuditStore();
      store.seed(record({ correlationKey: 'req-1', recordId: '1' }));
      store.seed(record({ correlationKey: 'req-1', recordId: '2' }));
      store.seed(record({ correlationKey: 'req-1', collection: 'contacts', recordId: '1' }));

      const history = store.listByCorrelation({
        collection: 'accounts',
        recordId: '1',
        correlationKey: 'req-1',
      });

      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({ collection: 'accounts', recordId: '1' });
    });

    it('returns an empty array when nothing matches', () => {
      expect(
        new InMemoryAuditStore().listByCorrelation({
          collection: 'accounts',
          recordId: '1',
          correlationKey: 'nope',
        }),
      ).toEqual([]);
    });
  });

  describe('listByCorrelations', () => {
    it('returns a flat list of entries under any of the keys, oldest first', () => {
      const store = new InMemoryAuditStore();
      store.seed(
        record({ correlationKey: 'a', timestamp: '2026-01-03T00:00:00.000Z', newValues: { n: 3 } }),
      );
      store.seed(
        record({ correlationKey: 'b', timestamp: '2026-01-01T00:00:00.000Z', newValues: { n: 1 } }),
      );
      store.seed(
        record({ correlationKey: 'a', timestamp: '2026-01-02T00:00:00.000Z', newValues: { n: 2 } }),
      );
      store.seed(
        record({ correlationKey: 'c', timestamp: '2026-01-04T00:00:00.000Z', newValues: { n: 9 } }),
      );

      const history = store.listByCorrelations({
        collection: 'accounts',
        recordId: '1',
        correlationKeys: ['a', 'b'],
      });

      expect(history.map(r => r.newValues)).toEqual([{ n: 1 }, { n: 2 }, { n: 3 }]);
    });

    it('scopes to the given record and collection', () => {
      const store = new InMemoryAuditStore();
      store.seed(record({ correlationKey: 'a', recordId: '1' }));
      store.seed(record({ correlationKey: 'a', recordId: '2' }));
      store.seed(record({ correlationKey: 'a', collection: 'contacts', recordId: '1' }));

      const history = store.listByCorrelations({
        collection: 'accounts',
        recordId: '1',
        correlationKeys: ['a'],
      });

      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({ collection: 'accounts', recordId: '1' });
    });

    it('returns an empty array for an empty key list', () => {
      const store = new InMemoryAuditStore();
      store.seed(record({ correlationKey: 'a' }));

      expect(
        store.listByCorrelations({ collection: 'accounts', recordId: '1', correlationKeys: [] }),
      ).toEqual([]);
    });
  });

  describe('insertPending / confirm', () => {
    it('inserts a pending row and confirms it to done with the final values', async () => {
      const store = new InMemoryAuditStore();

      const id = await store.insertPending(record({ recordId: '1', newValues: {} }));
      await store.confirm(id, {
        operation: 'update',
        recordId: '1',
        previousValues: { status: 'open' },
        newValues: { status: 'closed' },
      });

      const [entry] = store.listByRecord({ collection: 'accounts', recordId: '1' });
      expect(entry).toMatchObject({
        status: 'done',
        previousValues: { status: 'open' },
        newValues: { status: 'closed' },
      });
    });

    it('inserts a batch and returns one id per record, in order', async () => {
      const store = new InMemoryAuditStore();

      const ids = await store.insertPendingBatch([
        record({ recordId: '1' }),
        record({ recordId: '2' }),
      ]);

      expect(ids).toHaveLength(2);
      expect(new Set(ids).size).toBe(2);
    });
  });

  describe('listDistinctUsers', () => {
    it('returns one entry per distinct userId, keyed on their latest identity', () => {
      const store = new InMemoryAuditStore();
      store.seed(
        record({
          userId: 1,
          userFirstName: 'Jane',
          userLastName: 'Doe',
          userEmail: 'jane.doe@forest.dev',
        }),
      );
      store.seed(record({ userId: 1, userFirstName: 'Jane' }));
      store.seed(record({ userId: 2, userFirstName: 'John' }));

      const users = store.listDistinctUsers({ collection: 'accounts', recordId: '1' });

      expect(users.map(user => user.id).sort()).toEqual([1, 2]);
    });
  });
});

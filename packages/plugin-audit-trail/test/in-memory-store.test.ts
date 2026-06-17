import type { AuditRecord } from '../src';

import { InMemoryAuditStore } from '../src';

const record = (over: Partial<AuditRecord>): AuditRecord => ({
  timestamp: '2026-01-01T00:00:00.000Z',
  operation: 'update',
  collection: 'accounts',
  recordId: [1],
  actor: { id: 1, email: 'a@b.c', role: 'admin', requestId: 'r' },
  correlationKey: 'r',
  previousValues: {},
  newValues: {},
  ...over,
});

describe('InMemoryAuditStore', () => {
  it('returns the records of a given record id, oldest first', () => {
    const store = new InMemoryAuditStore();
    store.append(record({ timestamp: '2026-01-02T00:00:00.000Z', newValues: { status: 'b' } }));
    store.append(record({ timestamp: '2026-01-01T00:00:00.000Z', newValues: { status: 'a' } }));

    const history = store.listByRecord({ collection: 'accounts', recordId: [1] });

    expect(history.map(r => r.newValues)).toEqual([{ status: 'a' }, { status: 'b' }]);
  });

  it('filters out records of other ids and other collections', () => {
    const store = new InMemoryAuditStore();
    store.append(record({ recordId: [1] }));
    store.append(record({ recordId: [2] }));
    store.append(record({ collection: 'contacts', recordId: [1] }));

    const history = store.listByRecord({ collection: 'accounts', recordId: [1] });

    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ collection: 'accounts', recordId: [1] });
  });

  it('matches composite record ids by value', () => {
    const store = new InMemoryAuditStore();
    store.append(record({ recordId: [3, 7] }));

    expect(store.listByRecord({ collection: 'accounts', recordId: [3, 7] })).toHaveLength(1);
    expect(store.listByRecord({ collection: 'accounts', recordId: [3, 8] })).toHaveLength(0);
  });

  it('returns an empty list for an unknown record', () => {
    expect(
      new InMemoryAuditStore().listByRecord({ collection: 'accounts', recordId: [99] }),
    ).toEqual([]);
  });
});

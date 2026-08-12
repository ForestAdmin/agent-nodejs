import revertRecord from '../../src/audit-trail/revert';
import { ABSENT } from '../../src/audit-trail/types';

const update = (
  previousValues: Record<string, unknown>,
  newValues: Record<string, unknown>,
  timestamp = '2026-06-18T12:00:00Z',
) => ({ operation: 'update' as const, previousValues, newValues, timestamp });

describe('revertRecord', () => {
  test('returns the current record unchanged when no entries are provided', () => {
    expect(revertRecord({ id: 1, status: 'closed' }, [])).toEqual({ id: 1, status: 'closed' });
  });

  test('returns null when the current record does not exist and no entries are provided', () => {
    expect(revertRecord(null, [])).toBeNull();
  });

  test('reverts a single column update', () => {
    const current = { id: 1, status: 'closed', name: 'Acme' };

    const state = revertRecord(current, [update({ status: 'open' }, { status: 'closed' })]);

    expect(state).toEqual({ id: 1, status: 'open', name: 'Acme' });
  });

  test('applies entries newest-first to walk back through multiple updates', () => {
    const current = { id: 1, status: 'archived' };
    const entries = [
      update({ status: 'closed' }, { status: 'archived' }, '2026-06-18T13:00:00Z'),
      update({ status: 'open' }, { status: 'closed' }, '2026-06-18T12:00:00Z'),
    ];

    expect(revertRecord(current, entries)).toEqual({ id: 1, status: 'open' });
  });

  test('reverts a nested-object diff at the changed leaf only', () => {
    const current = {
      id: 1,
      payload: { theme: 'dark', layout: { sidebar: false, density: 'compact' } },
    };
    const entries = [
      update(
        { payload: { layout: { sidebar: true } } },
        { payload: { layout: { sidebar: false } } },
      ),
    ];

    expect(revertRecord(current, entries)).toEqual({
      id: 1,
      payload: { theme: 'dark', layout: { sidebar: true, density: 'compact' } },
    });
  });

  test('reverts an array-of-objects diff at the changed index only', () => {
    const current = {
      id: 1,
      payload: [
        { step: 'a', done: true },
        { step: 'b', done: true },
      ],
    };
    const entries = [
      update({ payload: { 1: { done: false } } }, { payload: { 1: { done: true } } }),
    ];

    expect(revertRecord(current, entries)).toEqual({
      id: 1,
      payload: [
        { step: 'a', done: true },
        { step: 'b', done: false },
      ],
    });
  });

  test('replaces a primitive-array column wholesale (no element-wise diff)', () => {
    const current = { id: 1, tags: ['x', 'z'] };
    const entries = [update({ tags: ['x', 'y'] }, { tags: ['x', 'z'] })];

    expect(revertRecord(current, entries)).toEqual({ id: 1, tags: ['x', 'y'] });
  });

  test('returns null when walking back hits a create (record did not exist at target)', () => {
    const current = { id: 1, status: 'open' };
    const entries = [
      { operation: 'create' as const, previousValues: {}, newValues: { id: 1, status: 'open' } },
    ];

    expect(revertRecord(current, entries)).toBeNull();
  });

  test('restores the delete snapshot then keeps walking older entries', () => {
    const entries = [
      {
        operation: 'delete' as const,
        previousValues: { id: 1, status: 'closed', name: 'Acme' },
        newValues: {},
      },
      update({ status: 'open' }, { status: 'closed' }),
    ];

    // The target timestamp predates the update too, so it must also be reverted rather than
    // stopping at the delete's own snapshot (which only reflects the moment just before deletion).
    expect(revertRecord(null, entries)).toEqual({ id: 1, status: 'open', name: 'Acme' });
  });

  test('returns the delete snapshot as-is when it is the only entry in range', () => {
    const entries = [
      {
        operation: 'delete' as const,
        previousValues: { id: 1, status: 'closed', name: 'Acme' },
        newValues: {},
      },
    ];

    expect(revertRecord(null, entries)).toEqual({ id: 1, status: 'closed', name: 'Acme' });
  });

  test('drops the accumulated reverts when walking back hits a delete (recreated record)', () => {
    const current = { id: 1, status: 'fresh' };
    const entries = [
      update({ status: 'fresh-was' }, { status: 'fresh' }),
      {
        operation: 'delete' as const,
        previousValues: { id: 1, status: 'old' },
        newValues: {},
      },
    ];

    expect(revertRecord(current, entries)).toEqual({ id: 1, status: 'old' });
  });

  test('removes a nested key that did not exist before the update (ABSENT marker)', () => {
    const current = {
      id: 1,
      payload: { theme: 'dark', addedKey: 'x' },
    };
    const entries = [update({ payload: { addedKey: ABSENT } }, { payload: { addedKey: 'x' } })];

    expect(revertRecord(current, entries)).toEqual({
      id: 1,
      payload: { theme: 'dark' },
    });
  });

  test('removes an appended array element that did not exist before the update (ABSENT marker)', () => {
    const current = {
      id: 1,
      payload: [{ step: 'a' }, { step: 'b' }],
    };
    const entries = [update({ payload: { 1: ABSENT } }, { payload: { 1: { step: 'b' } } })];

    expect(revertRecord(current, entries)).toEqual({
      id: 1,
      payload: [{ step: 'a' }],
    });
  });

  test('removes multiple appended array elements, highest index first', () => {
    const current = {
      id: 1,
      payload: [{ step: 'a' }, { step: 'b' }, { step: 'c' }],
    };
    const entries = [
      update(
        { payload: { 1: ABSENT, 2: ABSENT } },
        { payload: { 1: { step: 'b' }, 2: { step: 'c' } } },
      ),
    ];

    expect(revertRecord(current, entries)).toEqual({
      id: 1,
      payload: [{ step: 'a' }],
    });
  });

  test('rebuilds a nested object from scratch when the current value is not an object', () => {
    const current = { id: 1, payload: null };
    const entries = [update({ payload: { theme: 'dark' } }, { payload: { theme: 'light' } })];

    expect(revertRecord(current, entries)).toEqual({
      id: 1,
      payload: { theme: 'dark' },
    });
  });

  test('removes a top-level column that did not exist before the update (ABSENT marker)', () => {
    const current = { id: 1, status: 'closed', addedColumn: 'x' };
    const entries = [update({ addedColumn: ABSENT }, { addedColumn: 'x' })];

    expect(revertRecord(current, entries)).toEqual({ id: 1, status: 'closed' });
  });

  test('does not mutate the current record passed in', () => {
    const current = { id: 1, status: 'closed', payload: { a: 1 } };
    const snapshot = JSON.parse(JSON.stringify(current));

    revertRecord(current, [
      update({ status: 'open', payload: { a: 0 } }, { status: 'closed', payload: { a: 1 } }),
    ]);

    expect(current).toEqual(snapshot);
  });
});

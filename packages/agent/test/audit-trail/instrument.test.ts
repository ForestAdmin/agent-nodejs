import type { AuditRecord, AuditTrailInstrumentOptions } from '../../src/audit-trail';
import type { Caller } from '@forestadmin/datasource-toolkit';

import { Page, PaginatedFilter } from '@forestadmin/datasource-toolkit';

import InMemoryAuditStore from './in-memory-store';
import { REDACTED, installAuditTrailHooks as auditTrail } from '../../src/audit-trail';

type AuditTrailOptions = AuditTrailInstrumentOptions;

type Handler = (context: unknown) => Promise<void>;

const makeCaller = (requestId = 'req-1'): Caller =>
  ({
    id: 42,
    email: 'jane@forest.dev',
    firstName: 'Jane',
    lastName: 'Doe',
    role: 'admin',
    requestId,
  } as unknown as Caller);

const idFilterOperators = { filterOperators: new Set(['Equal', 'In']) };

const baseSchema = {
  fields: {
    id: { type: 'Column', columnType: 'Number', isPrimaryKey: true, ...idFilterOperators },
    status: { type: 'Column', columnType: 'String' },
    name: { type: 'Column', columnType: 'String' },
    amount: { type: 'Column', columnType: 'Number' },
    owner: { type: 'ManyToOne' },
  },
};

const compositeSchema = {
  fields: {
    organizationId: {
      type: 'Column',
      columnType: 'Number',
      isPrimaryKey: true,
      ...idFilterOperators,
    },
    userId: { type: 'Column', columnType: 'Number', isPrimaryKey: true, ...idFilterOperators },
    role: { type: 'Column', columnType: 'String' },
  },
};

const complexSchema = {
  fields: {
    id: { type: 'Column', columnType: 'Number', isPrimaryKey: true, ...idFilterOperators },
    payload: { type: 'Column', columnType: 'Json' },
    tags: { type: 'Column', columnType: ['String'] },
    seenAt: { type: 'Column', columnType: 'Date' },
    ref: { type: 'Column', columnType: 'String' },
  },
};

function fakeCollection(
  name: string,
  listResult: Record<string, unknown>[] = [],
  schema: unknown = baseSchema,
) {
  const handlers = new Map<string, Handler>();
  const list = jest.fn().mockResolvedValue(listResult);
  const collection = {
    name,
    schema,
    addInternalHook: (position: string, type: string, handler: Handler) => {
      handlers.set(`${position}:${type}`, handler);
    },
  };

  const fire = (key: string, context: Record<string, unknown>) => handlers.get(key)!(context);

  return { collection, handlers, list, fire, records: listResult };
}

function register(collections: Array<{ collection: unknown }>, options?: AuditTrailOptions) {
  const dataSourceCustomizer = { collections: collections.map(c => c.collection) };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  auditTrail(dataSourceCustomizer as any, null, options);
}

type Target = ReturnType<typeof fakeCollection>;

// The Before:Create hook inserts one pending entry per record and keys them off the `data` array
// reference; After:Create looks that array back up to correlate its confirm calls. Firing only
// After:Create (as a real create never would) leaves nothing to correlate, so both must fire here
// sharing the same `data` reference.
async function runCreate(
  target: Target,
  args: { caller: Caller; records: Record<string, unknown>[] },
) {
  const data = args.records.map(() => ({}));
  await target.fire('Before:Create', { caller: args.caller, data });
  await target.fire('After:Create', { caller: args.caller, records: args.records, data });
}

async function runUpdate(
  target: Target,
  args: {
    caller: Caller;
    patch: Record<string, unknown>;
    filter?: object;
    after?: Record<string, unknown>[];
  },
) {
  const filter = args.filter ?? {};
  await target.fire('Before:Update', {
    caller: args.caller,
    filter,
    patch: args.patch,
    collection: { list: target.list },
  });

  // The After hook re-reads the current values instead of trusting the patch; simulate the write
  // actually persisting by default (the patch applied on top of the snapshot), unless the test
  // overrides `after` to simulate the datasource storing something different from what was asked.
  const after = args.after ?? target.records.map(record => ({ ...record, ...args.patch }));
  target.list.mockResolvedValueOnce(after);

  await target.fire('After:Update', {
    caller: args.caller,
    filter,
    patch: args.patch,
    collection: { list: target.list },
  });
}

async function runDelete(target: Target, args: { caller: Caller; filter?: object }) {
  const filter = args.filter ?? {};
  await target.fire('Before:Delete', {
    caller: args.caller,
    filter,
    collection: { list: target.list },
  });
  await target.fire('After:Delete', { caller: args.caller, filter });
}

describe('auditTrail plugin', () => {
  describe('registration', () => {
    it('registers exactly the six CRUD hooks on a collection', () => {
      const accounts = fakeCollection('accounts');
      const sink = jest.fn();
      register([accounts], { sink });

      expect([...accounts.handlers.keys()].sort()).toEqual([
        'After:Create',
        'After:Delete',
        'After:Update',
        'Before:Create',
        'Before:Delete',
        'Before:Update',
      ]);
    });

    it('instruments every collection of the datasource', () => {
      const accounts = fakeCollection('accounts');
      const contacts = fakeCollection('contacts');
      register([accounts, contacts], { sink: jest.fn() });

      expect(accounts.handlers.size).toBe(6);
      expect(contacts.handlers.size).toBe(6);
    });

    it('writes captured records to the provided store', async () => {
      const store = new InMemoryAuditStore();
      const accounts = fakeCollection('accounts');
      register([accounts], { store });

      await runCreate(accounts, {
        caller: makeCaller(),
        records: [{ id: 1, status: 'open', name: 'Acme', amount: 10 }],
      });

      expect(store.listByRecord({ collection: 'accounts', recordId: '1' })).toEqual([
        expect.objectContaining({ operation: 'create', newValues: expect.anything() }),
      ]);
    });

    it('returns the store bootstrap promise so failures surface during agent start', async () => {
      const init = jest.fn().mockRejectedValue(new Error('migration failed'));
      const store = {
        init,
        insertPending: jest.fn(),
        insertPendingBatch: jest.fn(),
        confirm: jest.fn(),
        listByRecord: jest.fn().mockResolvedValue([]),
        countByRecord: jest.fn().mockResolvedValue(0),
        listByCorrelation: jest.fn().mockResolvedValue([]),
        listByCorrelations: jest.fn().mockResolvedValue([]),
        listDistinctUsers: jest.fn().mockResolvedValue([]),
      };
      const accounts = fakeCollection('accounts');

      // The plugin installs hooks synchronously and returns the init promise, so a broken
      // migration must reject the returned promise (which the customizer awaits at start).
      const result = auditTrail({ collections: [accounts.collection] } as never, null, { store });

      expect(accounts.handlers.size).toBe(6);
      await expect(result).rejects.toThrow('migration failed');
      expect(init).toHaveBeenCalledTimes(1);
    });

    it('falls back to a console sink when no sink is provided', async () => {
      const spy = jest.spyOn(console, 'info').mockImplementation(() => {});
      const accounts = fakeCollection('accounts');
      register([accounts]);

      await runCreate(accounts, {
        caller: makeCaller(),
        records: [{ id: 1, status: 'open', name: 'Acme', amount: 10 }],
      });

      expect(spy).toHaveBeenCalledWith(
        '[audit-trail]',
        expect.stringContaining('"operation":"create"'),
      );
      spy.mockRestore();
    });
  });

  describe('common record shape', () => {
    it('stamps timestamp, user id and correlation key from the caller', async () => {
      const sink = jest.fn();
      const accounts = fakeCollection('accounts');
      register([accounts], { sink });

      await runCreate(accounts, {
        caller: makeCaller('req-abc'),
        records: [{ id: 1, status: 'open', name: 'Acme', amount: 10 }],
      });

      const record = sink.mock.calls[0][0] as AuditRecord;
      expect(record.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
      expect(record.collection).toBe('accounts');
      expect(record.userId).toBe(42);
      expect(record.correlationKey).toBe('req-abc');
    });

    it('packs a composite recordId from every primary key', async () => {
      const sink = jest.fn();
      const memberships = fakeCollection('memberships', [], compositeSchema);
      register([memberships], { sink });

      await runCreate(memberships, {
        caller: makeCaller(),
        records: [{ organizationId: 3, userId: 7, role: 'admin' }],
      });

      expect(sink).toHaveBeenCalledWith(expect.objectContaining({ recordId: '3|7' }));
    });

    it('builds a string recordId for a varchar primary key', async () => {
      const sink = jest.fn();
      const schema = {
        fields: {
          slug: { type: 'Column', columnType: 'String', isPrimaryKey: true },
          name: { type: 'Column', columnType: 'String' },
        },
      };
      const pages = fakeCollection('pages', [], schema);
      register([pages], { sink });

      await runCreate(pages, {
        caller: makeCaller(),
        records: [{ slug: 'home', name: 'Home' }],
      });

      expect(sink).toHaveBeenCalledWith(expect.objectContaining({ recordId: 'home' }));
    });
  });

  describe('create', () => {
    it('captures the full new record and leaves previousValues empty', async () => {
      const sink = jest.fn();
      const accounts = fakeCollection('accounts');
      register([accounts], { sink });

      await runCreate(accounts, {
        caller: makeCaller(),
        records: [{ id: 1, status: 'open', name: 'Acme', amount: 10 }],
      });

      expect(sink).toHaveBeenCalledWith(
        expect.objectContaining<Partial<AuditRecord>>({
          operation: 'create',
          recordId: '1',
          previousValues: {},
          newValues: { id: 1, status: 'open', name: 'Acme', amount: 10 },
        }),
      );
    });

    it('excludes relation fields, keeping only columns', async () => {
      const sink = jest.fn();
      const accounts = fakeCollection('accounts');
      register([accounts], { sink });

      await runCreate(accounts, {
        caller: makeCaller(),
        records: [{ id: 1, status: 'open', name: 'Acme', amount: 10, owner: { id: 9 } }],
      });

      expect((sink.mock.calls[0][0] as AuditRecord).newValues).not.toHaveProperty('owner');
    });

    it('excludes read-only (computed/virtual) columns', async () => {
      const sink = jest.fn();
      const schema = {
        fields: {
          id: { type: 'Column', columnType: 'Number', isPrimaryKey: true },
          name: { type: 'Column', columnType: 'String' },
          fullName: { type: 'Column', columnType: 'String', isReadOnly: true },
        },
      };
      const users = fakeCollection('users', [], schema);
      register([users], { sink });

      await runCreate(users, {
        caller: makeCaller(),
        records: [{ id: 1, name: 'Jane', fullName: 'Jane Doe' }],
      });

      expect((sink.mock.calls[0][0] as AuditRecord).newValues).toEqual({ id: 1, name: 'Jane' });
    });

    it('records a missing column as null', async () => {
      const sink = jest.fn();
      const accounts = fakeCollection('accounts');
      register([accounts], { sink });

      await runCreate(accounts, {
        caller: makeCaller(),
        records: [{ id: 1, status: 'open' }],
      });

      expect((sink.mock.calls[0][0] as AuditRecord).newValues).toEqual({
        id: 1,
        status: 'open',
        name: null,
        amount: null,
      });
    });

    it('keeps falsy values (0, empty string) instead of nulling them', async () => {
      const sink = jest.fn();
      const accounts = fakeCollection('accounts');
      register([accounts], { sink });

      await runCreate(accounts, {
        caller: makeCaller(),
        records: [{ id: 1, status: '', name: 'Acme', amount: 0 }],
      });

      expect((sink.mock.calls[0][0] as AuditRecord).newValues).toMatchObject({
        status: '',
        amount: 0,
      });
    });

    it('emits one record per created record', async () => {
      const sink = jest.fn();
      const accounts = fakeCollection('accounts');
      register([accounts], { sink });

      await runCreate(accounts, {
        caller: makeCaller(),
        records: [
          { id: 1, status: 'open', name: 'Acme', amount: 10 },
          { id: 2, status: 'open', name: 'Globex', amount: 20 },
        ],
      });

      expect(sink).toHaveBeenCalledTimes(2);
      expect(sink).toHaveBeenNthCalledWith(1, expect.objectContaining({ recordId: '1' }));
      expect(sink).toHaveBeenNthCalledWith(2, expect.objectContaining({ recordId: '2' }));
    });
  });

  describe('update', () => {
    it('reads the affected records before the write through the collection API', async () => {
      const sink = jest.fn();
      const accounts = fakeCollection('accounts', [
        { id: 1, status: 'open', name: 'Acme', amount: 10 },
      ]);
      register([accounts], { sink });

      const filter = { conditionTree: { field: 'id', operator: 'Equal', value: 1 } };
      await accounts.fire('Before:Update', {
        caller: makeCaller(),
        filter,
        collection: { list: accounts.list },
      });

      expect(accounts.list).toHaveBeenCalledWith(
        new PaginatedFilter({ ...filter, page: new Page(0, 1001) } as never),
        ['id', 'status', 'name', 'amount'],
      );
    });

    it('does not report truncation when the matched count is exactly the 1000-record cap', async () => {
      // Fetching exactly `MAX_SNAPSHOT_RECORDS` back can never distinguish "matched exactly the
      // cap" from "matched more" — requesting one extra (see the test above) is what makes it
      // distinguishable; the fake here returns precisely what it's asked for, one row short of
      // the requested 1001, simulating "the real total is 1000".
      const sink = jest.fn();
      const logger = jest.fn();
      const matched = Array.from({ length: 1000 }, (_, i) => ({
        id: i + 1,
        status: 'open',
        name: 'Acme',
        amount: 10,
      }));
      const accounts = fakeCollection('accounts', matched);
      register([accounts], { sink, logger });

      await accounts.fire('Before:Update', {
        caller: makeCaller(),
        filter: {},
        patch: { status: 'closed' },
        collection: { list: accounts.list },
      });

      expect(logger).not.toHaveBeenCalled();
    });

    it('logs a truncation warning when a bulk update matches more than the 1000-record snapshot cap', async () => {
      const sink = jest.fn();
      const logger = jest.fn();
      // One more than the cap: simulates the datasource actually having more than 1000 matches,
      // since the fake returns everything it's given regardless of the requested page size.
      const matched = Array.from({ length: 1001 }, (_, i) => ({
        id: i + 1,
        status: 'open',
        name: 'Acme',
        amount: 10,
      }));
      const accounts = fakeCollection('accounts', matched);
      register([accounts], { sink, logger });

      await accounts.fire('Before:Update', {
        caller: makeCaller(),
        filter: {},
        patch: { status: 'closed' },
        collection: { list: accounts.list },
      });

      expect(logger).toHaveBeenCalledWith(
        'Warn',
        expect.stringContaining('"accounts" update matched more than 1000 records'),
      );
    });

    it('does not log a truncation warning when the matched count stays under the cap', async () => {
      const sink = jest.fn();
      const logger = jest.fn();
      const accounts = fakeCollection('accounts', [
        { id: 1, status: 'open', name: 'Acme', amount: 10 },
      ]);
      register([accounts], { sink, logger });

      await accounts.fire('Before:Update', {
        caller: makeCaller(),
        filter: {},
        patch: { status: 'closed' },
        collection: { list: accounts.list },
      });

      expect(logger).not.toHaveBeenCalled();
    });

    it('refuses a bulk update that matches more than the snapshot cap when critical is enabled', async () => {
      const sink = jest.fn();
      const logger = jest.fn();
      const matched = Array.from({ length: 1001 }, (_, i) => ({
        id: i + 1,
        status: 'open',
        name: 'Acme',
        amount: 10,
      }));
      const accounts = fakeCollection('accounts', matched);
      register([accounts], { sink, logger, critical: true });

      await expect(
        accounts.fire('Before:Update', {
          caller: makeCaller(),
          filter: {},
          patch: { status: 'closed' },
          collection: { list: accounts.list },
        }),
      ).rejects.toThrow('Refusing the operation because "critical" is enabled');
    });

    it('logs and swallows a rejecting sink at confirm time instead of failing the write', async () => {
      const sink = jest.fn().mockRejectedValue(new Error('sink unreachable'));
      const logger = jest.fn();
      const accounts = fakeCollection('accounts', [
        { id: 1, status: 'open', name: 'Acme', amount: 10 },
      ]);
      register([accounts], { sink, logger });

      await expect(
        runUpdate(accounts, { caller: makeCaller(), patch: { status: 'closed' } }),
      ).resolves.toBeUndefined();

      expect(logger).toHaveBeenCalledWith(
        'Error',
        expect.stringContaining('unable to confirm entry, continuing'),
      );
    });

    it('still builds the recordId when the primary key is read-only', async () => {
      const sink = jest.fn();
      const schema = {
        fields: {
          id: {
            type: 'Column',
            columnType: 'Number',
            isPrimaryKey: true,
            isReadOnly: true,
            ...idFilterOperators,
          },
          name: { type: 'Column', columnType: 'String' },
        },
      };
      const users = fakeCollection('users', [{ id: 17, name: 'Jane' }], schema);
      register([users], { sink });

      await runUpdate(users, { caller: makeCaller(), patch: { name: 'Janet' } });

      expect(users.list).toHaveBeenCalledWith(expect.anything(), ['id', 'name']);
      expect(sink).toHaveBeenCalledWith(
        expect.objectContaining({
          recordId: '17',
          previousValues: { name: 'Jane' },
          newValues: { name: 'Janet' },
        }),
      );
    });

    it('captures only the changed fields, split into previous/new values', async () => {
      const sink = jest.fn();
      const accounts = fakeCollection('accounts', [
        { id: 1, status: 'open', name: 'Acme', amount: 10 },
      ]);
      register([accounts], { sink });

      await runUpdate(accounts, { caller: makeCaller(), patch: { status: 'closed', amount: 99 } });

      expect(sink).toHaveBeenCalledWith(
        expect.objectContaining<Partial<AuditRecord>>({
          operation: 'update',
          recordId: '1',
          previousValues: { status: 'open', amount: 10 },
          newValues: { status: 'closed', amount: 99 },
        }),
      );
    });

    it('neither reads nor captures read-only columns', async () => {
      const sink = jest.fn();
      const schema = {
        fields: {
          id: { type: 'Column', columnType: 'Number', isPrimaryKey: true, ...idFilterOperators },
          name: { type: 'Column', columnType: 'String' },
          fullName: { type: 'Column', columnType: 'String', isReadOnly: true },
        },
      };
      const users = fakeCollection(
        'users',
        [{ id: 1, name: 'Jane', fullName: 'Jane Doe' }],
        schema,
      );
      register([users], { sink });

      await runUpdate(users, { caller: makeCaller(), patch: { name: 'Janet', fullName: 'X' } });

      expect(users.list).toHaveBeenCalledWith(expect.anything(), ['id', 'name']);
      expect(sink).toHaveBeenCalledWith(
        expect.objectContaining({
          previousValues: { name: 'Jane' },
          newValues: { name: 'Janet' },
        }),
      );
    });

    it('ignores patched fields whose value did not actually change', async () => {
      const sink = jest.fn();
      const accounts = fakeCollection('accounts', [
        { id: 1, status: 'open', name: 'Acme', amount: 10 },
      ]);
      register([accounts], { sink });

      await runUpdate(accounts, { caller: makeCaller(), patch: { status: 'open', amount: 99 } });

      expect(sink).toHaveBeenCalledWith(
        expect.objectContaining({
          previousValues: { amount: 10 },
          newValues: { amount: 99 },
        }),
      );
    });

    it('confirms with empty diffs when the patch changes no value', async () => {
      const sink = jest.fn();
      const accounts = fakeCollection('accounts', [
        { id: 1, status: 'open', name: 'Acme', amount: 10 },
      ]);
      register([accounts], { sink });

      await runUpdate(accounts, { caller: makeCaller(), patch: { status: 'open' } });

      expect(sink).toHaveBeenCalledWith(
        expect.objectContaining({ previousValues: {}, newValues: {} }),
      );
    });

    it('emits one record per matched record on a bulk update, with per-record previous values', async () => {
      const sink = jest.fn();
      const accounts = fakeCollection('accounts', [
        { id: 1, status: 'open', name: 'Acme', amount: 10 },
        { id: 2, status: 'pending', name: 'Globex', amount: 20 },
      ]);
      register([accounts], { sink });

      await runUpdate(accounts, { caller: makeCaller(), patch: { status: 'closed' } });

      expect(sink).toHaveBeenCalledTimes(2);
      expect(sink).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          recordId: '1',
          previousValues: { status: 'open' },
          newValues: { status: 'closed' },
        }),
      );
      expect(sink).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          recordId: '2',
          previousValues: { status: 'pending' },
          newValues: { status: 'closed' },
        }),
      );
    });

    it('emits nothing when the update matches no record', async () => {
      const sink = jest.fn();
      const accounts = fakeCollection('accounts', []);
      register([accounts], { sink });

      await runUpdate(accounts, { caller: makeCaller(), patch: { status: 'closed' } });

      expect(sink).not.toHaveBeenCalled();
    });

    it('logs the value actually persisted, not the requested patch', async () => {
      const sink = jest.fn();
      const accounts = fakeCollection('accounts', [
        { id: 1, status: 'open', name: 'Acme', amount: 10 },
      ]);
      register([accounts], { sink });

      // The datasource/a decorator normalizes the requested value before persisting it.
      await runUpdate(accounts, {
        caller: makeCaller(),
        patch: { status: 'CLOSED' },
        after: [{ id: 1, status: 'closed', name: 'Acme', amount: 10 }],
      });

      expect(sink).toHaveBeenCalledWith(
        expect.objectContaining({
          previousValues: { status: 'open' },
          newValues: { status: 'closed' },
        }),
      );
    });

    it('files the entry under the post-update id when a writable primary key changes', async () => {
      const sink = jest.fn();
      const schema = {
        fields: {
          slug: {
            type: 'Column',
            columnType: 'String',
            isPrimaryKey: true,
            ...idFilterOperators,
          },
          name: { type: 'Column', columnType: 'String' },
        },
      };
      const pages = fakeCollection('pages', [{ slug: 'old-slug', name: 'Home' }], schema);
      register([pages], { sink });

      await runUpdate(pages, {
        caller: makeCaller(),
        patch: { slug: 'new-slug' },
        after: [{ slug: 'new-slug', name: 'Home' }],
      });

      expect(sink).toHaveBeenCalledWith(
        expect.objectContaining({
          recordId: 'new-slug',
          previousValues: { slug: 'old-slug' },
          newValues: { slug: 'new-slug' },
        }),
      );
    });

    it('still records an update that changes a field the update was itself filtered on', async () => {
      const sink = jest.fn();
      const accounts = fakeCollection('accounts', [
        { id: 1, status: 'draft', name: 'Acme', amount: 10 },
      ]);
      register([accounts], { sink });

      // A filter matching on `status` no longer matches once this very update archives the record,
      // so re-reading with it (instead of by the record's own identity) would find nothing.
      const filter = { conditionTree: { field: 'status', operator: 'Equal', value: 'draft' } };
      await runUpdate(accounts, {
        caller: makeCaller(),
        filter,
        patch: { status: 'archived' },
        after: [{ id: 1, status: 'archived', name: 'Acme', amount: 10 }],
      });

      const [, secondCallFilter] = accounts.list.mock.calls[1];
      expect(secondCallFilter).not.toBe(filter);

      expect(sink).toHaveBeenCalledWith(
        expect.objectContaining({
          recordId: '1',
          previousValues: { status: 'draft' },
          newValues: { status: 'archived' },
        }),
      );
    });

    it("does not let a failed write's abandoned snapshot leak into a later update sharing the same Filter object", async () => {
      const sink = jest.fn();
      const caller = makeCaller();
      const accounts = fakeCollection('accounts');
      register([accounts], { sink });

      const sharedFilter = { tag: 'shared' };

      // First update's write throws after Before ran (not simulated here beyond simply never
      // firing its After): the pushed snapshot is abandoned and must not poison the next update
      // that happens to reuse the identical Filter object.
      accounts.list.mockResolvedValueOnce([{ id: 1, status: 'open', name: 'Acme', amount: 10 }]);
      await accounts.fire('Before:Update', {
        caller,
        filter: sharedFilter,
        patch: { status: 'closed' },
        collection: { list: accounts.list },
      });

      accounts.list.mockResolvedValueOnce([
        { id: 2, status: 'pending', name: 'Globex', amount: 20 },
      ]);
      await accounts.fire('Before:Update', {
        caller,
        filter: sharedFilter,
        patch: { amount: 99 },
        collection: { list: accounts.list },
      });
      accounts.list.mockResolvedValueOnce([
        { id: 2, status: 'pending', name: 'Globex', amount: 99 },
      ]);
      await accounts.fire('After:Update', {
        caller,
        filter: sharedFilter,
        patch: { amount: 99 },
        collection: { list: accounts.list },
      });

      expect(sink).toHaveBeenCalledTimes(1);
      expect(sink).toHaveBeenCalledWith(
        expect.objectContaining({
          recordId: '2',
          previousValues: { amount: 20 },
          newValues: { amount: 99 },
        }),
      );
    });

    it('emits nothing in After:Update when no Before snapshot was taken', async () => {
      const sink = jest.fn();
      const accounts = fakeCollection('accounts');
      register([accounts], { sink });

      await accounts.fire('After:Update', {
        caller: makeCaller(),
        filter: {},
        patch: { status: 'closed' },
      });

      expect(sink).not.toHaveBeenCalled();
    });

    it('consumes the snapshot so a second After:Update emits nothing', async () => {
      const sink = jest.fn();
      const caller = makeCaller();
      const filter = {};
      const accounts = fakeCollection('accounts', [
        { id: 1, status: 'open', name: 'Acme', amount: 10 },
      ]);
      register([accounts], { sink });

      await accounts.fire('Before:Update', { caller, filter, collection: { list: accounts.list } });
      accounts.list.mockResolvedValueOnce([{ id: 1, status: 'closed', name: 'Acme', amount: 10 }]);
      await accounts.fire('After:Update', {
        caller,
        filter,
        patch: { status: 'closed' },
        collection: { list: accounts.list },
      });
      sink.mockClear();
      await accounts.fire('After:Update', {
        caller,
        filter,
        patch: { status: 'archived' },
        collection: { list: accounts.list },
      });

      expect(sink).not.toHaveBeenCalled();
    });

    it('keeps two concurrent updates on the same collection from mixing snapshots', async () => {
      const sink = jest.fn();
      const caller = makeCaller('same-request');
      const accounts = fakeCollection('accounts');
      register([accounts], { sink });

      const filterA = { tag: 'A' };
      const filterB = { tag: 'B' };
      accounts.list
        .mockResolvedValueOnce([{ id: 1, status: 'open', name: 'Acme', amount: 10 }])
        .mockResolvedValueOnce([{ id: 2, status: 'pending', name: 'Globex', amount: 20 }])
        .mockResolvedValueOnce([{ id: 1, status: 'closed', name: 'Acme', amount: 10 }])
        .mockResolvedValueOnce([{ id: 2, status: 'closed', name: 'Globex', amount: 20 }]);

      // Interleave the two operations: both Before hooks run before either After.
      await accounts.fire('Before:Update', {
        caller,
        filter: filterA,
        collection: { list: accounts.list },
      });
      await accounts.fire('Before:Update', {
        caller,
        filter: filterB,
        collection: { list: accounts.list },
      });
      await accounts.fire('After:Update', {
        caller,
        filter: filterA,
        patch: { status: 'closed' },
        collection: { list: accounts.list },
      });
      await accounts.fire('After:Update', {
        caller,
        filter: filterB,
        patch: { status: 'closed' },
        collection: { list: accounts.list },
      });

      expect(sink).toHaveBeenCalledTimes(2);
      expect(sink).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ recordId: '1', previousValues: { status: 'open' } }),
      );
      expect(sink).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ recordId: '2', previousValues: { status: 'pending' } }),
      );
    });

    it('keeps two concurrent updates sharing the same Filter instance from colliding', async () => {
      const sink = jest.fn();
      const caller = makeCaller('same-request');
      const accounts = fakeCollection('accounts');
      register([accounts], { sink });

      // A caller can legitimately reuse one Filter object across two concurrent calls (e.g. a
      // bulk helper looping over the same template) — this must not overwrite the first snapshot.
      const sharedFilter = { tag: 'shared' };
      accounts.list
        .mockResolvedValueOnce([{ id: 1, status: 'open', name: 'Acme', amount: 10 }])
        .mockResolvedValueOnce([{ id: 2, status: 'pending', name: 'Globex', amount: 20 }])
        .mockResolvedValueOnce([{ id: 1, status: 'closed', name: 'Acme', amount: 10 }])
        .mockResolvedValueOnce([{ id: 2, status: 'closed', name: 'Globex', amount: 20 }]);

      await accounts.fire('Before:Update', {
        caller,
        filter: sharedFilter,
        collection: { list: accounts.list },
      });
      await accounts.fire('Before:Update', {
        caller,
        filter: sharedFilter,
        collection: { list: accounts.list },
      });
      await accounts.fire('After:Update', {
        caller,
        filter: sharedFilter,
        patch: { status: 'closed' },
        collection: { list: accounts.list },
      });
      await accounts.fire('After:Update', {
        caller,
        filter: sharedFilter,
        patch: { status: 'closed' },
        collection: { list: accounts.list },
      });

      expect(sink).toHaveBeenCalledTimes(2);
      expect(sink).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ recordId: '1', previousValues: { status: 'open' } }),
      );
      expect(sink).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ recordId: '2', previousValues: { status: 'pending' } }),
      );
    });

    it('skips a collection with no primary key instead of installing hooks that would later throw', () => {
      const sink = jest.fn();
      const logger = jest.fn();
      const schema = { fields: { name: { type: 'Column', columnType: 'String' } } };
      const views = fakeCollection('views', [{ name: 'Acme' }], schema);
      register([views], { sink, logger });

      expect(views.handlers.size).toBe(0);
      expect(logger).toHaveBeenCalledWith('Warn', expect.stringContaining('"views"'));
    });
  });

  describe('complex and BSON values', () => {
    const update = (before: Record<string, unknown>, patch: Record<string, unknown>) => {
      const sink = jest.fn();
      const records = fakeCollection('records', [{ id: 1, ...before }], complexSchema);
      register([records], { sink });

      return { sink, run: () => runUpdate(records, { caller: makeCaller(), patch }) };
    };

    it('does not flag a structurally equal object (different instance, reordered keys)', async () => {
      const { sink, run } = update({ payload: { a: 1, b: 2 } }, { payload: { b: 2, a: 1 } });
      await run();

      expect(sink).toHaveBeenCalledWith(
        expect.objectContaining({ previousValues: {}, newValues: {} }),
      );
    });

    it('does not throw on a changed BigInt value, and stores it as a string', async () => {
      const { sink, run } = update({ ref: 10n }, { ref: 20n });
      await run();

      expect(sink).toHaveBeenCalledWith(
        expect.objectContaining({ previousValues: { ref: '10' }, newValues: { ref: '20' } }),
      );
    });

    it('does not flag two equal BigInt values as changed', async () => {
      const { sink, run } = update({ ref: 10n }, { ref: 10n });
      await run();

      expect(sink).toHaveBeenCalledWith(
        expect.objectContaining({ previousValues: {}, newValues: {} }),
      );
    });

    it('does not throw on a BigInt nested inside a JSON object, and stores it as a string', async () => {
      const { sink, run } = update({ payload: { count: 10n } }, { payload: { count: 20n } });
      await run();

      expect(sink).toHaveBeenCalledWith(
        expect.objectContaining({
          previousValues: { payload: { count: '10' } },
          newValues: { payload: { count: '20' } },
        }),
      );
    });

    it('does not throw on a BigInt nested inside a primitive array, and stores it as a string', async () => {
      const { sink, run } = update({ tags: [10n, 20n] }, { tags: [10n, 30n] });
      await run();

      expect(sink).toHaveBeenCalledWith(
        expect.objectContaining({
          previousValues: { tags: ['10', '20'] },
          newValues: { tags: ['10', '30'] },
        }),
      );
    });

    it('does not throw creating a record whose JSON column nests a BigInt', async () => {
      const sink = jest.fn();
      const records = fakeCollection('records', [], complexSchema);
      register([records], { sink });

      await runCreate(records, {
        caller: makeCaller(),
        records: [{ id: 1, payload: { count: 10n } }],
      });

      expect(sink).toHaveBeenCalledWith(
        expect.objectContaining({
          newValues: expect.objectContaining({ payload: { count: '10' } }),
        }),
      );
    });

    it('captures only the changed leaf inside a nested object, dropping unchanged siblings', async () => {
      const { sink, run } = update({ payload: { a: 1, b: 2 } }, { payload: { a: 1, b: 3 } });
      await run();

      expect(sink).toHaveBeenCalledWith(
        expect.objectContaining({
          previousValues: { payload: { b: 2 } },
          newValues: { payload: { b: 3 } },
        }),
      );
    });

    it('keeps only the deepest changed leaf of a deeply nested object', async () => {
      const { sink, run } = update(
        { payload: { theme: 'dark', layout: { sidebar: true, density: 'compact' } } },
        { payload: { theme: 'dark', layout: { sidebar: false, density: 'compact' } } },
      );
      await run();

      expect(sink).toHaveBeenCalledWith(
        expect.objectContaining({
          previousValues: { payload: { layout: { sidebar: true } } },
          newValues: { payload: { layout: { sidebar: false } } },
        }),
      );
    });

    it('diffs an array of objects element-wise, keeping only the changed index and leaf', async () => {
      const { sink, run } = update(
        {
          payload: [
            { step: 'a', done: true },
            { step: 'b', done: false },
          ],
        },
        {
          payload: [
            { step: 'a', done: true },
            { step: 'b', done: true },
          ],
        },
      );
      await run();

      expect(sink).toHaveBeenCalledWith(
        expect.objectContaining({
          previousValues: { payload: { 1: { done: false } } },
          newValues: { payload: { 1: { done: true } } },
        }),
      );
    });

    it('keeps a primitive array whole instead of diffing it element-wise', async () => {
      const { sink, run } = update({ tags: ['x', 'y'] }, { tags: ['x', 'z'] });
      await run();

      expect(sink).toHaveBeenCalledWith(
        expect.objectContaining({
          previousValues: { tags: ['x', 'y'] },
          newValues: { tags: ['x', 'z'] },
        }),
      );
    });

    it('does not flag an equal array, but flags a reorder', async () => {
      const equal = update({ tags: ['x', 'y'] }, { tags: ['x', 'y'] });
      await equal.run();
      expect(equal.sink).toHaveBeenCalledWith(
        expect.objectContaining({ previousValues: {}, newValues: {} }),
      );

      const reordered = update({ tags: ['x', 'y'] }, { tags: ['y', 'x'] });
      await reordered.run();
      expect(reordered.sink).toHaveBeenCalledWith(
        expect.objectContaining({
          previousValues: { tags: ['x', 'y'] },
          newValues: { tags: ['y', 'x'] },
        }),
      );
    });

    it('does not flag an equal Date, but flags a different one', async () => {
      const same = update(
        { seenAt: new Date('2026-01-01T00:00:00Z') },
        { seenAt: new Date('2026-01-01T00:00:00Z') },
      );
      await same.run();
      expect(same.sink).toHaveBeenCalledWith(
        expect.objectContaining({ previousValues: {}, newValues: {} }),
      );

      const changed = update(
        { seenAt: new Date('2026-01-01T00:00:00Z') },
        { seenAt: new Date('2026-02-01T00:00:00Z') },
      );
      await changed.run();
      expect(changed.sink).toHaveBeenCalledTimes(1);
    });

    it('compares BSON-like values by their canonical toJSON', async () => {
      const objectId = (hex: string) => ({ toJSON: () => hex });

      const same = update({ ref: objectId('abc') }, { ref: objectId('abc') });
      await same.run();
      expect(same.sink).toHaveBeenCalledWith(
        expect.objectContaining({ previousValues: {}, newValues: {} }),
      );

      const changed = update({ ref: objectId('abc') }, { ref: objectId('def') });
      await changed.run();
      expect(changed.sink).toHaveBeenCalledTimes(1);
    });

    it('stores a BSON-like value by its canonical toJSON, not its internal own fields', async () => {
      // Unlike the plain-object test double above, a real BSON wrapper's `toJSON` lives on its
      // prototype rather than as an own property, with the actual data in an unrelated own field —
      // `Object.entries`/`Object.fromEntries` would silently drop the (non-enumerable) prototype
      // method and keep only that internal field.
      class FakeObjectId {
        constructor(private readonly hex: string) {}

        toJSON() {
          return this.hex;
        }
      }

      const sink = jest.fn();
      const records = fakeCollection('records', [], complexSchema);
      register([records], { sink });

      await runCreate(records, {
        caller: makeCaller(),
        records: [{ id: 1, ref: new FakeObjectId('abc') }],
      });

      // `toJsonSafe` leaves it untouched (the eventual SQL JSON-column write calls its `toJSON`
      // itself, same as `JSON.stringify` would) — the point is that it isn't reconstructed into a
      // plain object first, which would silently discard the prototype method that produces this.
      const [{ newValues }] = sink.mock.calls[0];
      expect(JSON.stringify(newValues.ref)).toBe('"abc"');
    });

    it('omits a newly added nested key from previousValues rather than a bogus null', async () => {
      const { sink, run } = update(
        { payload: { theme: 'dark' } },
        { payload: { theme: 'dark', addedKey: 'x' } },
      );
      await run();

      expect(sink).toHaveBeenCalledWith(
        expect.objectContaining({
          previousValues: { payload: {} },
          newValues: { payload: { addedKey: 'x' } },
        }),
      );
    });

    it('omits a removed nested key from newValues rather than a bogus null', async () => {
      const { sink, run } = update(
        { payload: { theme: 'dark', removedKey: 'x' } },
        { payload: { theme: 'dark' } },
      );
      await run();

      expect(sink).toHaveBeenCalledWith(
        expect.objectContaining({
          previousValues: { payload: { removedKey: 'x' } },
          newValues: { payload: {} },
        }),
      );
    });
  });

  describe('redaction', () => {
    it('masks a redacted field on create, keeping the others', async () => {
      const sink = jest.fn();
      const accounts = fakeCollection('accounts');
      register([accounts], { sink, redact: { accounts: ['name'] } });

      await runCreate(accounts, {
        caller: makeCaller(),
        records: [{ id: 1, status: 'open', name: 'Acme', amount: 10 }],
      });

      expect((sink.mock.calls[0][0] as AuditRecord).newValues).toEqual({
        id: 1,
        status: 'open',
        name: REDACTED,
        amount: 10,
      });
    });

    it('still records that a redacted field changed, but masks both values', async () => {
      const sink = jest.fn();
      const accounts = fakeCollection('accounts', [
        { id: 1, status: 'open', name: 'Acme', amount: 10 },
      ]);
      register([accounts], { sink, redact: { accounts: ['name'] } });

      await runUpdate(accounts, { caller: makeCaller(), patch: { name: 'Globex' } });

      expect(sink).toHaveBeenCalledWith(
        expect.objectContaining({
          previousValues: { name: REDACTED },
          newValues: { name: REDACTED },
        }),
      );
    });

    it('confirms with empty diffs, rather than leaving the entry pending, when a patch changes nothing', async () => {
      const sink = jest.fn();
      const accounts = fakeCollection('accounts', [
        { id: 1, status: 'open', name: 'Acme', amount: 10 },
      ]);
      register([accounts], { sink, redact: { accounts: ['name'] } });

      await runUpdate(accounts, { caller: makeCaller(), patch: { name: 'Acme' } });

      expect(sink).toHaveBeenCalledWith(
        expect.objectContaining({ previousValues: {}, newValues: {} }),
      );
    });

    it('masks a redacted field on delete', async () => {
      const sink = jest.fn();
      const accounts = fakeCollection('accounts', [
        { id: 7, status: 'open', name: 'Globex', amount: 20 },
      ]);
      register([accounts], { sink, redact: { accounts: ['name'] } });

      await runDelete(accounts, { caller: makeCaller() });

      expect((sink.mock.calls[0][0] as AuditRecord).previousValues).toMatchObject({
        name: REDACTED,
      });
    });

    it('only redacts the configured collection, not a same-named field elsewhere', async () => {
      const sink = jest.fn();
      const accounts = fakeCollection('accounts');
      const contacts = fakeCollection('contacts');
      register([accounts, contacts], { sink, redact: { accounts: ['name'] } });

      await runCreate(contacts, {
        caller: makeCaller(),
        records: [{ id: 1, status: 'open', name: 'Bob', amount: 0 }],
      });

      expect((sink.mock.calls[0][0] as AuditRecord).newValues).toMatchObject({ name: 'Bob' });
    });
  });

  describe('delete', () => {
    it('reads the affected records before the write through the collection API', async () => {
      const sink = jest.fn();
      const accounts = fakeCollection('accounts', [
        { id: 7, status: 'open', name: 'Globex', amount: 20 },
      ]);
      register([accounts], { sink });

      const filter = { conditionTree: { field: 'id', operator: 'Equal', value: 7 } };
      await accounts.fire('Before:Delete', {
        caller: makeCaller(),
        filter,
        collection: { list: accounts.list },
      });

      expect(accounts.list).toHaveBeenCalledWith(
        new PaginatedFilter({ ...filter, page: new Page(0, 1001) } as never),
        ['id', 'status', 'name', 'amount'],
      );
    });

    it('does not report truncation when the matched count is exactly the 1000-record cap', async () => {
      const sink = jest.fn();
      const logger = jest.fn();
      const matched = Array.from({ length: 1000 }, (_, i) => ({
        id: i + 1,
        status: 'open',
        name: 'Acme',
        amount: 10,
      }));
      const accounts = fakeCollection('accounts', matched);
      register([accounts], { sink, logger });

      await accounts.fire('Before:Delete', {
        caller: makeCaller(),
        filter: {},
        collection: { list: accounts.list },
      });

      expect(logger).not.toHaveBeenCalled();
    });

    it('logs a truncation warning when a bulk delete matches more than the 1000-record snapshot cap', async () => {
      const sink = jest.fn();
      const logger = jest.fn();
      const matched = Array.from({ length: 1001 }, (_, i) => ({
        id: i + 1,
        status: 'open',
        name: 'Acme',
        amount: 10,
      }));
      const accounts = fakeCollection('accounts', matched);
      register([accounts], { sink, logger });

      await accounts.fire('Before:Delete', {
        caller: makeCaller(),
        filter: {},
        collection: { list: accounts.list },
      });

      expect(logger).toHaveBeenCalledWith(
        'Warn',
        expect.stringContaining('"accounts" delete matched more than 1000 records'),
      );
    });

    it('does not log a truncation warning when the matched count stays under the cap', async () => {
      const sink = jest.fn();
      const logger = jest.fn();
      const accounts = fakeCollection('accounts', [
        { id: 7, status: 'open', name: 'Globex', amount: 20 },
      ]);
      register([accounts], { sink, logger });

      await accounts.fire('Before:Delete', {
        caller: makeCaller(),
        filter: {},
        collection: { list: accounts.list },
      });

      expect(logger).not.toHaveBeenCalled();
    });

    it('refuses a bulk delete that matches more than the snapshot cap when critical is enabled', async () => {
      const sink = jest.fn();
      const logger = jest.fn();
      const matched = Array.from({ length: 1001 }, (_, i) => ({
        id: i + 1,
        status: 'open',
        name: 'Acme',
        amount: 10,
      }));
      const accounts = fakeCollection('accounts', matched);
      register([accounts], { sink, logger, critical: true });

      await expect(
        accounts.fire('Before:Delete', {
          caller: makeCaller(),
          filter: {},
          collection: { list: accounts.list },
        }),
      ).rejects.toThrow('Refusing the operation because "critical" is enabled');
    });

    it('captures the full previous record and leaves newValues empty', async () => {
      const sink = jest.fn();
      const accounts = fakeCollection('accounts', [
        { id: 7, status: 'open', name: 'Globex', amount: 20 },
      ]);
      register([accounts], { sink });

      await runDelete(accounts, { caller: makeCaller() });

      expect(sink).toHaveBeenCalledWith(
        expect.objectContaining<Partial<AuditRecord>>({
          operation: 'delete',
          recordId: '7',
          previousValues: { id: 7, status: 'open', name: 'Globex', amount: 20 },
          newValues: {},
        }),
      );
    });

    it('emits one record per deleted record on a bulk delete', async () => {
      const sink = jest.fn();
      const accounts = fakeCollection('accounts', [
        { id: 7, status: 'open', name: 'Globex', amount: 20 },
        { id: 8, status: 'open', name: 'Initech', amount: 30 },
      ]);
      register([accounts], { sink });

      await runDelete(accounts, { caller: makeCaller() });

      expect(sink).toHaveBeenCalledTimes(2);
      expect(sink).toHaveBeenNthCalledWith(1, expect.objectContaining({ recordId: '7' }));
      expect(sink).toHaveBeenNthCalledWith(2, expect.objectContaining({ recordId: '8' }));
    });

    it('emits nothing when the delete matches no record', async () => {
      const sink = jest.fn();
      const accounts = fakeCollection('accounts', []);
      register([accounts], { sink });

      await runDelete(accounts, { caller: makeCaller() });

      expect(sink).not.toHaveBeenCalled();
    });
  });
});

import type { AuditRecord, AuditSink } from '../src';
import type { Caller } from '@forestadmin/datasource-toolkit';

import { auditTrail } from '../src';

type Handler = (context: unknown) => Promise<void>;

const makeCaller = (requestId = 'req-1'): Caller =>
  ({ id: 42, email: 'jane@forest.dev', role: 'admin', requestId } as unknown as Caller);

const baseSchema = {
  fields: {
    id: { type: 'Column', columnType: 'Number', isPrimaryKey: true },
    status: { type: 'Column', columnType: 'String' },
    name: { type: 'Column', columnType: 'String' },
    amount: { type: 'Column', columnType: 'Number' },
    owner: { type: 'ManyToOne' },
  },
};

const compositeSchema = {
  fields: {
    organizationId: { type: 'Column', columnType: 'Number', isPrimaryKey: true },
    userId: { type: 'Column', columnType: 'Number', isPrimaryKey: true },
    role: { type: 'Column', columnType: 'String' },
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
    addHook: (position: string, type: string, handler: Handler) => {
      handlers.set(`${position}:${type}`, handler);
    },
  };

  const fire = (key: string, context: Record<string, unknown>) => handlers.get(key)!(context);

  return { collection, handlers, list, fire };
}

function register(collections: Array<{ collection: unknown }>, options?: { sink: AuditSink }) {
  const dataSourceCustomizer = { collections: collections.map(c => c.collection) };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  auditTrail(dataSourceCustomizer as any, null, options);
}

type Target = ReturnType<typeof fakeCollection>;

async function runUpdate(
  target: Target,
  args: { caller: Caller; patch: Record<string, unknown>; filter?: object },
) {
  const filter = args.filter ?? {};
  await target.fire('Before:Update', {
    caller: args.caller,
    filter,
    collection: { list: target.list },
  });
  await target.fire('After:Update', { caller: args.caller, filter, patch: args.patch });
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
    it('registers exactly the five CRUD hooks on a collection', () => {
      const accounts = fakeCollection('accounts');
      const sink = jest.fn();
      register([accounts], { sink });

      expect([...accounts.handlers.keys()].sort()).toEqual([
        'After:Create',
        'After:Delete',
        'After:Update',
        'Before:Delete',
        'Before:Update',
      ]);
    });

    it('instruments every collection of the datasource', () => {
      const accounts = fakeCollection('accounts');
      const contacts = fakeCollection('contacts');
      register([accounts, contacts], { sink: jest.fn() });

      expect(accounts.handlers.size).toBe(5);
      expect(contacts.handlers.size).toBe(5);
    });

    it('falls back to a console sink when no sink is provided', async () => {
      const spy = jest.spyOn(console, 'info').mockImplementation(() => {});
      const accounts = fakeCollection('accounts');
      register([accounts]);

      await accounts.fire('After:Create', {
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
    it('stamps timestamp, actor and correlation key from the caller', async () => {
      const sink = jest.fn();
      const accounts = fakeCollection('accounts');
      register([accounts], { sink });

      await accounts.fire('After:Create', {
        caller: makeCaller('req-abc'),
        records: [{ id: 1, status: 'open', name: 'Acme', amount: 10 }],
      });

      const record = sink.mock.calls[0][0] as AuditRecord;
      expect(record.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
      expect(record.collection).toBe('accounts');
      expect(record.actor).toEqual({
        id: 42,
        email: 'jane@forest.dev',
        role: 'admin',
        requestId: 'req-abc',
      });
      expect(record.correlationKey).toBe('req-abc');
    });

    it('builds a composite recordId from every primary key', async () => {
      const sink = jest.fn();
      const memberships = fakeCollection('memberships', [], compositeSchema);
      register([memberships], { sink });

      await memberships.fire('After:Create', {
        caller: makeCaller(),
        records: [{ organizationId: 3, userId: 7, role: 'admin' }],
      });

      expect(sink).toHaveBeenCalledWith(expect.objectContaining({ recordId: [3, 7] }));
    });
  });

  describe('create', () => {
    it('captures the full new record and leaves previousValues empty', async () => {
      const sink = jest.fn();
      const accounts = fakeCollection('accounts');
      register([accounts], { sink });

      await accounts.fire('After:Create', {
        caller: makeCaller(),
        records: [{ id: 1, status: 'open', name: 'Acme', amount: 10 }],
      });

      expect(sink).toHaveBeenCalledWith(
        expect.objectContaining<Partial<AuditRecord>>({
          operation: 'create',
          recordId: [1],
          previousValues: {},
          newValues: { id: 1, status: 'open', name: 'Acme', amount: 10 },
        }),
      );
    });

    it('excludes relation fields, keeping only columns', async () => {
      const sink = jest.fn();
      const accounts = fakeCollection('accounts');
      register([accounts], { sink });

      await accounts.fire('After:Create', {
        caller: makeCaller(),
        records: [{ id: 1, status: 'open', name: 'Acme', amount: 10, owner: { id: 9 } }],
      });

      expect((sink.mock.calls[0][0] as AuditRecord).newValues).not.toHaveProperty('owner');
    });

    it('records a missing column as null', async () => {
      const sink = jest.fn();
      const accounts = fakeCollection('accounts');
      register([accounts], { sink });

      await accounts.fire('After:Create', {
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

      await accounts.fire('After:Create', {
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

      await accounts.fire('After:Create', {
        caller: makeCaller(),
        records: [
          { id: 1, status: 'open', name: 'Acme', amount: 10 },
          { id: 2, status: 'open', name: 'Globex', amount: 20 },
        ],
      });

      expect(sink).toHaveBeenCalledTimes(2);
      expect(sink).toHaveBeenNthCalledWith(1, expect.objectContaining({ recordId: [1] }));
      expect(sink).toHaveBeenNthCalledWith(2, expect.objectContaining({ recordId: [2] }));
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

      expect(accounts.list).toHaveBeenCalledWith(filter, ['id', 'status', 'name', 'amount']);
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
          recordId: [1],
          previousValues: { status: 'open', amount: 10 },
          newValues: { status: 'closed', amount: 99 },
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

    it('emits nothing when the patch changes no value', async () => {
      const sink = jest.fn();
      const accounts = fakeCollection('accounts', [
        { id: 1, status: 'open', name: 'Acme', amount: 10 },
      ]);
      register([accounts], { sink });

      await runUpdate(accounts, { caller: makeCaller(), patch: { status: 'open' } });

      expect(sink).not.toHaveBeenCalled();
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
          recordId: [1],
          previousValues: { status: 'open' },
          newValues: { status: 'closed' },
        }),
      );
      expect(sink).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          recordId: [2],
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
      await accounts.fire('After:Update', { caller, filter, patch: { status: 'closed' } });
      sink.mockClear();
      await accounts.fire('After:Update', { caller, filter, patch: { status: 'archived' } });

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
        .mockResolvedValueOnce([{ id: 2, status: 'pending', name: 'Globex', amount: 20 }]);

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
      await accounts.fire('After:Update', { caller, filter: filterA, patch: { status: 'closed' } });
      await accounts.fire('After:Update', { caller, filter: filterB, patch: { status: 'closed' } });

      expect(sink).toHaveBeenCalledTimes(2);
      expect(sink).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ recordId: [1], previousValues: { status: 'open' } }),
      );
      expect(sink).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ recordId: [2], previousValues: { status: 'pending' } }),
      );
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

      expect(accounts.list).toHaveBeenCalledWith(filter, ['id', 'status', 'name', 'amount']);
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
          recordId: [7],
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
      expect(sink).toHaveBeenNthCalledWith(1, expect.objectContaining({ recordId: [7] }));
      expect(sink).toHaveBeenNthCalledWith(2, expect.objectContaining({ recordId: [8] }));
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

import type { AuditRecord, AuditSink } from '../src';
import type { Caller } from '@forestadmin/datasource-toolkit';

import { auditTrail } from '../src';

type Handler = (context: unknown) => Promise<void>;

const caller = {
  id: 42,
  email: 'jane@forest.dev',
  role: 'admin',
  requestId: 'req-123',
} as unknown as Caller;

const schema = {
  fields: {
    id: { type: 'Column', columnType: 'Number', isPrimaryKey: true },
    status: { type: 'Column', columnType: 'String' },
    name: { type: 'Column', columnType: 'String' },
    owner: { type: 'ManyToOne' },
  },
};

function setup(listResult: Record<string, unknown>[] = []) {
  const handlers = new Map<string, Handler>();
  const list = jest.fn().mockResolvedValue(listResult);

  const collection = {
    name: 'accounts',
    schema,
    addHook: (position: string, type: string, handler: Handler) => {
      handlers.set(`${position}:${type}`, handler);
    },
  };
  const dataSourceCustomizer = { collections: [collection] };

  const sink: jest.MockedFunction<AuditSink> = jest.fn();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  auditTrail(dataSourceCustomizer as any, null, { sink });

  return { handlers, list, sink };
}

describe('auditTrail plugin', () => {
  it('registers before/after hooks for create, update and delete', () => {
    const { handlers } = setup();

    expect([...handlers.keys()].sort()).toEqual([
      'After:Create',
      'After:Delete',
      'After:Update',
      'Before:Delete',
      'Before:Update',
    ]);
  });

  it('captures a create as a record with the new value and no previous value', async () => {
    const { handlers, sink } = setup();

    await handlers.get('After:Create')!({
      caller,
      records: [{ id: 1, status: 'open', name: 'Acme' }],
    });

    expect(sink).toHaveBeenCalledTimes(1);
    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining<Partial<AuditRecord>>({
        operation: 'create',
        collection: 'accounts',
        recordId: [1],
        actor: { id: 42, email: 'jane@forest.dev', role: 'admin', requestId: 'req-123' },
        correlationKey: 'req-123',
        before: null,
        after: { id: 1, status: 'open', name: 'Acme' },
        changes: {},
      }),
    );
  });

  it('captures an update with the field-level previous/new diff', async () => {
    const { handlers, list, sink } = setup([{ id: 1, status: 'open', name: 'Acme' }]);

    const filter = { conditionTree: { field: 'id', operator: 'Equal', value: 1 } };
    await handlers.get('Before:Update')!({ caller, filter, collection: { list } });
    await handlers.get('After:Update')!({ caller, patch: { status: 'closed' } });

    expect(list).toHaveBeenCalledWith(filter, ['id', 'status', 'name']);
    expect(sink).toHaveBeenCalledTimes(1);
    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining<Partial<AuditRecord>>({
        operation: 'update',
        recordId: [1],
        before: { id: 1, status: 'open', name: 'Acme' },
        after: { id: 1, status: 'closed', name: 'Acme' },
        changes: { status: { before: 'open', after: 'closed' } },
      }),
    );
  });

  it('captures a delete with the previous value and no new value', async () => {
    const { handlers, list, sink } = setup([{ id: 7, status: 'open', name: 'Globex' }]);

    await handlers.get('Before:Delete')!({ caller, filter: {}, collection: { list } });
    await handlers.get('After:Delete')!({ caller });

    expect(sink).toHaveBeenCalledTimes(1);
    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining<Partial<AuditRecord>>({
        operation: 'delete',
        recordId: [7],
        before: { id: 7, status: 'open', name: 'Globex' },
        after: null,
        changes: {},
      }),
    );
  });

  it('emits one record per affected record on a bulk update', async () => {
    const { handlers, list, sink } = setup([
      { id: 1, status: 'open', name: 'Acme' },
      { id: 2, status: 'open', name: 'Globex' },
    ]);

    await handlers.get('Before:Update')!({ caller, filter: {}, collection: { list } });
    await handlers.get('After:Update')!({ caller, patch: { status: 'closed' } });

    expect(sink).toHaveBeenCalledTimes(2);
    expect(sink).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ recordId: [1], changes: { status: { before: 'open', after: 'closed' } } }),
    );
    expect(sink).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ recordId: [2], changes: { status: { before: 'open', after: 'closed' } } }),
    );
  });
});

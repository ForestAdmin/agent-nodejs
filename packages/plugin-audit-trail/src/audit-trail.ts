import type { AuditActor, AuditRecord, AuditSink, AuditTrailOptions } from './types';
import type {
  CollectionCustomizer,
  DataSourceCustomizer,
  HookAfterCreateContext,
  HookBeforeDeleteContext,
  HookBeforeUpdateContext,
} from '@forestadmin/datasource-customizer';
import type { Caller, CompositeId, RecordData } from '@forestadmin/datasource-toolkit';

import { SchemaUtils } from '@forestadmin/datasource-toolkit';

const pendingSnapshots = new Map<string, RecordData[]>();

const snapshotKey = (caller: Caller, collection: string): string =>
  `${caller.requestId}::${collection}`;

const toActor = (caller: Caller): AuditActor => ({
  id: caller.id,
  email: caller.email,
  role: caller.role,
  requestId: caller.requestId,
});

const toRecordId = (record: RecordData, primaryKeys: string[]): CompositeId =>
  primaryKeys.map(pk => record[pk] as number | string);

const pick = (record: RecordData, columns: string[]): Record<string, unknown> =>
  Object.fromEntries(columns.map(column => [column, record[column] ?? null]));

const changedValues = (
  before: RecordData,
  patch: RecordData,
  columns: string[],
): Pick<AuditRecord, 'previousValues' | 'newValues'> => {
  const previousValues: Record<string, unknown> = {};
  const newValues: Record<string, unknown> = {};

  for (const column of columns) {
    if (column in patch && before[column] !== patch[column]) {
      previousValues[column] = before[column] ?? null;
      newValues[column] = patch[column] ?? null;
    }
  }

  return { previousValues, newValues };
};

const defaultSink: AuditSink = record => {
  // eslint-disable-next-line no-console
  console.info('[audit-trail]', JSON.stringify(record));
};

function instrumentCollection(collection: CollectionCustomizer, sink: AuditSink): void {
  const { schema } = collection;
  const columns = Object.keys(schema.fields).filter(name => schema.fields[name].type === 'Column');
  const primaryKeys = SchemaUtils.getPrimaryKeys(schema);
  const { name } = collection;

  const emit = (
    caller: Caller,
    operation: AuditRecord['operation'],
    recordId: CompositeId,
    previousValues: Record<string, unknown>,
    newValues: Record<string, unknown>,
  ): Promise<void> | void =>
    sink({
      timestamp: new Date().toISOString(),
      operation,
      collection: name,
      recordId,
      actor: toActor(caller),
      correlationKey: caller.requestId,
      previousValues,
      newValues,
    });

  collection.addHook('After', 'Create', async (context: HookAfterCreateContext) => {
    await Promise.all(
      context.records.map(record =>
        emit(context.caller, 'create', toRecordId(record, primaryKeys), {}, pick(record, columns)),
      ),
    );
  });

  collection.addHook('Before', 'Update', async (context: HookBeforeUpdateContext) => {
    const before = await context.collection.list(context.filter as never, columns as never[]);
    pendingSnapshots.set(snapshotKey(context.caller, name), before as RecordData[]);
  });

  collection.addHook('After', 'Update', async (context: HookBeforeUpdateContext) => {
    const key = snapshotKey(context.caller, name);
    const before = pendingSnapshots.get(key) ?? [];
    pendingSnapshots.delete(key);

    const patch = context.patch as RecordData;
    await Promise.all(
      before.map(record => {
        const { previousValues, newValues } = changedValues(record, patch, columns);

        if (Object.keys(newValues).length === 0) return undefined;

        return emit(
          context.caller,
          'update',
          toRecordId(record, primaryKeys),
          previousValues,
          newValues,
        );
      }),
    );
  });

  collection.addHook('Before', 'Delete', async (context: HookBeforeDeleteContext) => {
    const before = await context.collection.list(context.filter as never, columns as never[]);
    pendingSnapshots.set(snapshotKey(context.caller, name), before as RecordData[]);
  });

  collection.addHook('After', 'Delete', async (context: HookBeforeDeleteContext) => {
    const key = snapshotKey(context.caller, name);
    const before = pendingSnapshots.get(key) ?? [];
    pendingSnapshots.delete(key);

    await Promise.all(
      before.map(record =>
        emit(context.caller, 'delete', toRecordId(record, primaryKeys), pick(record, columns), {}),
      ),
    );
  });
}

export default function auditTrail(
  dataSourceCustomizer: DataSourceCustomizer,
  _collectionCustomizer: CollectionCustomizer | null,
  options?: AuditTrailOptions,
): void {
  const sink = options?.sink ?? defaultSink;

  for (const collection of dataSourceCustomizer.collections) {
    instrumentCollection(collection, sink);
  }
}

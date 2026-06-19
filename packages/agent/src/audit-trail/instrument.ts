import type { AuditRecord, AuditSink, AuditTrailInstrumentOptions } from './types';
import type {
  CollectionCustomizer,
  DataSourceCustomizer,
  HookAfterCreateContext,
  HookBeforeDeleteContext,
  HookBeforeUpdateContext,
} from '@forestadmin/datasource-customizer';
import type { Caller, RecordData } from '@forestadmin/datasource-toolkit';

import { SchemaUtils } from '@forestadmin/datasource-toolkit';

const pendingSnapshots = new WeakMap<object, RecordData[]>();

// Forest's canonical record identity: primary keys stringified and joined, matching
// IdUtils.packId and the record ids stored in the Elasticsearch activity logs.
const toRecordId = (record: RecordData, primaryKeys: string[]): string =>
  primaryKeys.map(pk => String(record[pk])).join('|');

const pick = (record: RecordData, columns: string[]): Record<string, unknown> =>
  Object.fromEntries(columns.map(column => [column, record[column] ?? null]));

const sortObjectKeys = (key: string, value: unknown): unknown => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((sorted, name) => {
        sorted[name] = (value as Record<string, unknown>)[name];

        return sorted;
      }, {});
  }

  return value;
};

// Value-equality across scalars, nested objects/arrays, Dates and BSON types.
// JSON.stringify reduces Dates/BSON to their canonical form via toJSON before the
// replacer runs, and the replacer makes plain-object key order irrelevant.
const equals = (a: unknown, b: unknown): boolean =>
  JSON.stringify(a, sortObjectKeys) === JSON.stringify(b, sortObjectKeys);

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date);

// Arrays whose every element is a plain object (record-like collections such as a workflow history).
// These are diffed element-wise; primitive or mixed arrays are kept whole.
const isObjectArray = (value: unknown): value is Record<string, unknown>[] =>
  Array.isArray(value) && value.length > 0 && value.every(isPlainObject);

// Minimal structural diff. Nested plain objects and arrays of objects are recursed into, so only the
// keys/indexes whose leaf value actually changed are kept — a single sub-field change does not store
// the whole object/array. Array diffs are reported as index-keyed objects. Scalars, primitive arrays,
// Dates and BSON values are compared and kept as a whole.
const diff = (before: unknown, after: unknown): { previous: unknown; next: unknown } | null => {
  if (equals(before, after)) return null;

  if (isPlainObject(before) && isPlainObject(after)) {
    const previous: Record<string, unknown> = {};
    const next: Record<string, unknown> = {};

    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
      const subDiff = diff(before[key], after[key]);

      if (subDiff) {
        previous[key] = subDiff.previous;
        next[key] = subDiff.next;
      }
    }

    return { previous, next };
  }

  if (isObjectArray(before) && isObjectArray(after)) {
    const previous: Record<number, unknown> = {};
    const next: Record<number, unknown> = {};

    for (let index = 0; index < Math.max(before.length, after.length); index += 1) {
      const subDiff = diff(before[index], after[index]);

      if (subDiff) {
        previous[index] = subDiff.previous;
        next[index] = subDiff.next;
      }
    }

    return { previous, next };
  }

  return { previous: before ?? null, next: after ?? null };
};

const changedValues = (
  before: RecordData,
  patch: RecordData,
  columns: string[],
): Pick<AuditRecord, 'previousValues' | 'newValues'> => {
  const previousValues: Record<string, unknown> = {};
  const newValues: Record<string, unknown> = {};

  for (const column of columns) {
    const delta = column in patch ? diff(before[column], patch[column]) : null;

    if (delta) {
      previousValues[column] = delta.previous;
      newValues[column] = delta.next;
    }
  }

  return { previousValues, newValues };
};

export const REDACTED = '[redacted]';

const redactValues = (
  values: Record<string, unknown>,
  redactedFields: string[],
): Record<string, unknown> => {
  if (!redactedFields.length) return values;

  const result = { ...values };
  for (const field of redactedFields) if (field in result) result[field] = REDACTED;

  return result;
};

const defaultSink: AuditSink = record => {
  // eslint-disable-next-line no-console
  console.info('[audit-trail]', JSON.stringify(record));
};

function instrumentCollection(
  collection: CollectionCustomizer,
  sink: AuditSink,
  redactedFields: string[],
): void {
  const { schema } = collection;
  // Writable columns only: Forest audits what it writes. Read-only fields cover both computed
  // /virtual fields and DB-managed columns, none of which Forest mutates.
  const columns = Object.keys(schema.fields).filter(name => {
    const field = schema.fields[name];

    return field.type === 'Column' && !field.isReadOnly;
  });
  const primaryKeys = SchemaUtils.getPrimaryKeys(schema);
  // Reads must carry the primary keys (even read-only ones) so the record id can be built;
  // the diff itself stays restricted to the writable columns.
  const projection = [...new Set([...primaryKeys, ...columns])];
  const { name } = collection;

  const emit = (
    caller: Caller,
    operation: AuditRecord['operation'],
    recordId: string,
    previousValues: Record<string, unknown>,
    newValues: Record<string, unknown>,
  ): Promise<void> | void =>
    sink({
      timestamp: new Date().toISOString(),
      operation,
      collection: name,
      recordId,
      userId: caller.id,
      correlationKey: caller.requestId,
      previousValues: redactValues(previousValues, redactedFields),
      newValues: redactValues(newValues, redactedFields),
    });

  collection.addInternalHook('After', 'Create', async (context: HookAfterCreateContext) => {
    await Promise.all(
      context.records.map(record =>
        emit(context.caller, 'create', toRecordId(record, primaryKeys), {}, pick(record, columns)),
      ),
    );
  });

  collection.addInternalHook('Before', 'Update', async (context: HookBeforeUpdateContext) => {
    const before = await context.collection.list(context.filter as never, projection as never[]);
    pendingSnapshots.set(context.filter, before as RecordData[]);
  });

  collection.addInternalHook('After', 'Update', async (context: HookBeforeUpdateContext) => {
    const before = pendingSnapshots.get(context.filter) ?? [];
    pendingSnapshots.delete(context.filter);

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

  collection.addInternalHook('Before', 'Delete', async (context: HookBeforeDeleteContext) => {
    const before = await context.collection.list(context.filter as never, projection as never[]);
    pendingSnapshots.set(context.filter, before as RecordData[]);
  });

  collection.addInternalHook('After', 'Delete', async (context: HookBeforeDeleteContext) => {
    const before = pendingSnapshots.get(context.filter) ?? [];
    pendingSnapshots.delete(context.filter);

    await Promise.all(
      before.map(record =>
        emit(context.caller, 'delete', toRecordId(record, primaryKeys), pick(record, columns), {}),
      ),
    );
  });
}

/**
 * Install the audit-trail CRUD hooks on every collection and bootstrap the store. Used internally
 * by the agent as a `customizer.use(...)` plugin when `auditTrail.connectionString` is set.
 */
export default function installAuditTrailHooks(
  dataSourceCustomizer: DataSourceCustomizer,
  _collectionCustomizer: CollectionCustomizer | null,
  options?: AuditTrailInstrumentOptions,
): Promise<void> | void {
  const { sink, store, redact } = options ?? {};
  const append = sink ?? (store ? record => store.append(record) : defaultSink);

  for (const collection of dataSourceCustomizer.collections) {
    instrumentCollection(collection, append, redact?.[collection.name] ?? []);
  }

  // Hooks are installed above; the store bootstrap runs asynchronously so failures (bad
  // connection string, broken migration) surface at agent start rather than on the first
  // audited write. The customizer awaits this promise during `agent.start()`.
  return store?.init?.();
}

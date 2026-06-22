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

const snapshotsByFilter = new WeakMap<object, RecordData[]>();

// Must match IdUtils.packId so recordIds align with the rest of Forest.
const toPackedRecordId = (record: RecordData, primaryKeys: string[]): string =>
  primaryKeys.map(pk => String(record[pk])).join('|');

const pickColumns = (record: RecordData, columns: string[]): Record<string, unknown> =>
  Object.fromEntries(columns.map(column => [column, record[column] ?? null]));

const stableKeyOrderReplacer = (key: string, value: unknown): unknown => {
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

// Date/BSON values round-trip through JSON.stringify via their toJSON; the replacer makes
// plain-object key order irrelevant.
const deepEquals = (a: unknown, b: unknown): boolean =>
  JSON.stringify(a, stableKeyOrderReplacer) === JSON.stringify(b, stableKeyOrderReplacer);

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date);

const isObjectArray = (value: unknown): value is Record<string, unknown>[] =>
  Array.isArray(value) && value.length > 0 && value.every(isPlainObject);

// Returns only the leaves that changed. Plain objects and object-arrays recurse; everything else
// (scalars, primitive arrays, Date, BSON) is compared and kept whole.
const diff = (before: unknown, after: unknown): { previous: unknown; next: unknown } | null => {
  if (deepEquals(before, after)) return null;

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

const consoleSink: AuditSink = record => {
  // eslint-disable-next-line no-console
  console.info('[audit-trail]', JSON.stringify(record));
};

function instrumentCollection(
  collection: CollectionCustomizer,
  sink: AuditSink,
  redactedFields: string[],
): void {
  const { schema } = collection;
  const writableColumns = Object.keys(schema.fields).filter(name => {
    const field = schema.fields[name];

    return field.type === 'Column' && !field.isReadOnly;
  });
  const primaryKeys = SchemaUtils.getPrimaryKeys(schema);
  // PKs may be read-only, but they are required to build the packed recordId; the diff itself
  // stays restricted to writableColumns.
  const readProjection = [...new Set([...primaryKeys, ...writableColumns])];
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
        emit(
          context.caller,
          'create',
          toPackedRecordId(record, primaryKeys),
          {},
          pickColumns(record, writableColumns),
        ),
      ),
    );
  });

  collection.addInternalHook('Before', 'Update', async (context: HookBeforeUpdateContext) => {
    const before = await context.collection.list(
      context.filter as never,
      readProjection as never[],
    );
    snapshotsByFilter.set(context.filter, before as RecordData[]);
  });

  collection.addInternalHook('After', 'Update', async (context: HookBeforeUpdateContext) => {
    const before = snapshotsByFilter.get(context.filter) ?? [];
    snapshotsByFilter.delete(context.filter);

    const patch = context.patch as RecordData;
    await Promise.all(
      before.map(record => {
        const { previousValues, newValues } = changedValues(record, patch, writableColumns);

        if (Object.keys(newValues).length === 0) return undefined;

        return emit(
          context.caller,
          'update',
          toPackedRecordId(record, primaryKeys),
          previousValues,
          newValues,
        );
      }),
    );
  });

  collection.addInternalHook('Before', 'Delete', async (context: HookBeforeDeleteContext) => {
    const before = await context.collection.list(
      context.filter as never,
      readProjection as never[],
    );
    snapshotsByFilter.set(context.filter, before as RecordData[]);
  });

  collection.addInternalHook('After', 'Delete', async (context: HookBeforeDeleteContext) => {
    const before = snapshotsByFilter.get(context.filter) ?? [];
    snapshotsByFilter.delete(context.filter);

    await Promise.all(
      before.map(record =>
        emit(
          context.caller,
          'delete',
          toPackedRecordId(record, primaryKeys),
          pickColumns(record, writableColumns),
          {},
        ),
      ),
    );
  });
}

export default function installAuditTrailHooks(
  dataSourceCustomizer: DataSourceCustomizer,
  _collectionCustomizer: CollectionCustomizer | null,
  options?: AuditTrailInstrumentOptions,
): Promise<void> | void {
  const { sink, store, redact } = options ?? {};
  const append = sink ?? (store ? record => store.append(record) : consoleSink);

  for (const collection of dataSourceCustomizer.collections) {
    instrumentCollection(collection, append, redact?.[collection.name] ?? []);
  }

  // Returned so a broken bootstrap fails agent.start() instead of the first write.
  return store?.init?.();
}

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

import { ABSENT } from './types';

// One caller-supplied `Filter` object can be reused across concurrent operations (e.g. a bulk
// helper looping over the same template), so each key holds a FIFO queue of snapshots rather than
// a single value — otherwise a second concurrent `Before` would overwrite the first snapshot and
// its `After` would silently emit nothing.
const snapshotsByFilter = new WeakMap<object, RecordData[][]>();

function pushSnapshot(key: object, snapshot: RecordData[]): void {
  const queue = snapshotsByFilter.get(key) ?? [];
  queue.push(snapshot);
  snapshotsByFilter.set(key, queue);
}

function shiftSnapshot(key: object): RecordData[] {
  const queue = snapshotsByFilter.get(key);
  if (!queue || queue.length === 0) return [];

  const snapshot = queue.shift();
  if (queue.length === 0) snapshotsByFilter.delete(key);

  return snapshot ?? [];
}

// Must match IdUtils.packId so recordIds align with the rest of Forest.
const toPackedRecordId = (record: RecordData, primaryKeys: string[]): string => {
  if (primaryKeys.length === 0) {
    throw new Error('Cannot audit a collection with no primary key');
  }

  return primaryKeys.map(pk => String(record[pk])).join('|');
};

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
// (scalars, primitive arrays, Date, BSON) is compared and kept whole. A leaf that did not exist
// before/after (as opposed to one explicitly set to `null`) is encoded as `ABSENT` so `revertRecord`
// can tell the two cases apart and remove the key/index instead of writing back a bogus `null`.
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

  return {
    previous: before === undefined ? ABSENT : before ?? null,
    next: after === undefined ? ABSENT : after ?? null,
  };
};

// Diffs against the record actually persisted by the write (`after`), not the requested patch, so
// the log reflects normalization/coercion/side effects applied by the datasource or a decorator.
const changedValues = (
  before: RecordData,
  after: RecordData,
  columns: string[],
): Pick<AuditRecord, 'previousValues' | 'newValues'> => {
  const previousValues: Record<string, unknown> = {};
  const newValues: Record<string, unknown> = {};

  for (const column of columns) {
    const delta = diff(before[column], after[column]);

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
    entry: Pick<AuditRecord, 'operation' | 'recordId' | 'previousValues' | 'newValues'>,
  ): Promise<void> | void =>
    sink({
      timestamp: new Date().toISOString(),
      collection: name,
      userId: caller.id,
      correlationKey: caller.requestId,
      ...entry,
      previousValues: redactValues(entry.previousValues, redactedFields),
      newValues: redactValues(entry.newValues, redactedFields),
    });

  collection.addInternalHook(
    'After',
    'Create',
    async (context: HookAfterCreateContext) => {
      await Promise.all(
        context.records.map(record =>
          emit(context.caller, {
            operation: 'create',
            recordId: toPackedRecordId(record, primaryKeys),
            previousValues: {},
            newValues: pickColumns(record, writableColumns),
          }),
        ),
      );
    },
    { prepend: true },
  );

  collection.addInternalHook('Before', 'Update', async (context: HookBeforeUpdateContext) => {
    const before = await context.collection.list(
      context.filter as never,
      readProjection as never[],
    );
    pushSnapshot(context.filter, before as RecordData[]);
  });

  collection.addInternalHook(
    'After',
    'Update',
    async (context: HookBeforeUpdateContext) => {
      const before = shiftSnapshot(context.filter);

      if (before.length === 0) return;

      // Re-read what was actually persisted rather than trusting the requested patch: a decorator
      // or the datasource itself may normalize, coerce, or otherwise alter the written values.
      const after = (await context.collection.list(
        context.filter as never,
        readProjection as never[],
      )) as RecordData[];

      await Promise.all(
        before.map((record, index) => {
          const updated = after[index];

          if (!updated) return undefined;

          const { previousValues, newValues } = changedValues(record, updated, writableColumns);

          if (Object.keys(newValues).length === 0) return undefined;

          // Packed from the post-update values: if the update changed a writable primary key, the
          // entry is filed under the record's new id, matching what later history lookups use.
          return emit(context.caller, {
            operation: 'update',
            recordId: toPackedRecordId(updated, primaryKeys),
            previousValues,
            newValues,
          });
        }),
      );
    },
    { prepend: true },
  );

  collection.addInternalHook('Before', 'Delete', async (context: HookBeforeDeleteContext) => {
    const before = await context.collection.list(
      context.filter as never,
      readProjection as never[],
    );
    pushSnapshot(context.filter, before as RecordData[]);
  });

  collection.addInternalHook(
    'After',
    'Delete',
    async (context: HookBeforeDeleteContext) => {
      const before = shiftSnapshot(context.filter);

      await Promise.all(
        before.map(record =>
          emit(context.caller, {
            operation: 'delete',
            recordId: toPackedRecordId(record, primaryKeys),
            previousValues: pickColumns(record, writableColumns),
            newValues: {},
          }),
        ),
      );
    },
    { prepend: true },
  );
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

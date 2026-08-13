import type { AuditRecord, AuditSink, AuditTrailInstrumentOptions } from './types';
import type {
  CollectionCustomizer,
  DataSourceCustomizer,
  HookAfterCreateContext,
  HookBeforeDeleteContext,
  HookBeforeUpdateContext,
} from '@forestadmin/datasource-customizer';
import type { Caller, RecordData } from '@forestadmin/datasource-toolkit';

import { ConditionTreeFactory, SchemaUtils } from '@forestadmin/datasource-toolkit';

import { ABSENT } from './types';

const stableKeyOrderReplacer = (key: string, value: unknown): unknown => {
  // JSON.stringify has no native BigInt support and throws on one, regardless of nesting depth or
  // whether it's the root value; the replacer gets a chance to convert it first either way.
  if (typeof value === 'bigint') return value.toString();

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

// A value with its own `toJSON` (Date, a BSON wrapper) has a canonical representation that
// `Object.entries` can't be trusted to reproduce: BSON's `toJSON` is typically on the prototype
// while the actual data lives in unrelated (and sometimes non-enumerable) own fields, so walking
// `Object.entries` would silently reconstruct the wrong — or an empty — object instead.
const hasCanonicalJson = (value: object): boolean =>
  typeof (value as { toJSON?: unknown }).toJSON === 'function';

// A raw BigInt surviving into a stored `previousValues`/`newValues` would fail later — Sequelize
// serializing the JSON column, or Koa serializing an HTTP history response — the same way
// JSON.stringify does above. Recurses through arrays and plain objects (leaving anything with its
// own `toJSON` untouched, see above) since a BigInt can be nested inside a JSON column's value
// rather than being the column's value itself — `pickColumns` hands this a whole column value
// unprocessed by `diff`'s own recursion, and a primitive array is a `diff` leaf kept whole rather
// than walked.
const toJsonSafe = (value: unknown): unknown => {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(toJsonSafe);

  if (value && typeof value === 'object' && !hasCanonicalJson(value)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        toJsonSafe(entry),
      ]),
    );
  }

  return value;
};

type PendingSnapshot = { before: RecordData[]; patch?: RecordData };

// One caller-supplied `Filter` object can be reused across concurrent (or sequential, e.g. a
// continue-on-error bulk loop) operations sharing the same template, so each key holds a queue of
// snapshots rather than a single value — otherwise a second `Before` would overwrite the first
// snapshot and its `After` would silently emit nothing.
const snapshotsByFilter = new WeakMap<object, PendingSnapshot[]>();

function pushSnapshot(key: object, entry: PendingSnapshot): void {
  const queue = snapshotsByFilter.get(key) ?? [];
  queue.push(entry);
  snapshotsByFilter.set(key, queue);
}

// Correlates by `patch` content rather than queue position: if a write throws, its `Before`
// snapshot is never consumed (there is no matching `After` call), so blindly taking the front of
// the queue would hand a later, unrelated operation someone else's stale snapshot instead of its
// own. Delete has no equivalent secondary key, so it falls back to FIFO order — a narrower version
// of the same risk that remains for deletes sharing one `Filter` reference.
function takeSnapshot(key: object, patch?: RecordData): RecordData[] {
  const queue = snapshotsByFilter.get(key);
  if (!queue || queue.length === 0) return [];

  const index = patch ? queue.findIndex(entry => deepEquals(entry.patch, patch)) : 0;
  const [entry] = queue.splice(index === -1 ? 0 : index, 1);

  if (queue.length === 0) snapshotsByFilter.delete(key);

  return entry?.before ?? [];
}

// Must match IdUtils.packId so recordIds align with the rest of Forest.
const toPackedRecordId = (record: RecordData, primaryKeys: string[]): string => {
  if (primaryKeys.length === 0) {
    throw new Error('Cannot audit a collection with no primary key');
  }

  return primaryKeys.map(pk => String(record[pk])).join('|');
};

const pickColumns = (record: RecordData, columns: string[]): Record<string, unknown> =>
  Object.fromEntries(columns.map(column => [column, toJsonSafe(record[column]) ?? null]));

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
    previous: before === undefined ? ABSENT : toJsonSafe(before) ?? null,
    next: after === undefined ? ABSENT : toJsonSafe(after) ?? null,
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
    pushSnapshot(context.filter, { before: before as RecordData[], patch: context.patch });
  });

  collection.addInternalHook(
    'After',
    'Update',
    async (context: HookBeforeUpdateContext) => {
      const before = takeSnapshot(context.filter, context.patch);

      if (before.length === 0) return;

      // Re-read each touched record by its own (possibly patch-changed) identity rather than via
      // `context.filter`: if the update changed a field the filter matched on — including a
      // writable primary key — re-querying with that same filter would find nothing, silently
      // dropping the entry instead of filing it under the record's new id.
      const expectedRecords = before.map(record => ({ ...record, ...context.patch }));
      const expectedIds = expectedRecords.map(record => primaryKeys.map(pk => record[pk]));
      const after = (await context.collection.list(
        { conditionTree: ConditionTreeFactory.matchIds(schema, expectedIds) } as never,
        readProjection as never[],
      )) as RecordData[];
      const afterById = new Map(
        after.map(record => [toPackedRecordId(record, primaryKeys), record]),
      );

      await Promise.all(
        before.map((record, index) => {
          const updated = afterById.get(toPackedRecordId(expectedRecords[index], primaryKeys));

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
    pushSnapshot(context.filter, { before: before as RecordData[] });
  });

  collection.addInternalHook(
    'After',
    'Delete',
    async (context: HookBeforeDeleteContext) => {
      const before = takeSnapshot(context.filter);

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

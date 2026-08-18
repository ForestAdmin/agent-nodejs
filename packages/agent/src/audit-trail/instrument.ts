import type {
  AuditRecordConfirmation,
  AuditSink,
  AuditStore,
  AuditTrailInstrumentOptions,
  PendingAuditRecord,
} from './types';
import type {
  CollectionCustomizer,
  DataSourceCustomizer,
  HookAfterCreateContext,
  HookBeforeCreateContext,
  HookBeforeDeleteContext,
  HookBeforeUpdateContext,
} from '@forestadmin/datasource-customizer';
import type { Caller, Filter, Logger, RecordData } from '@forestadmin/datasource-toolkit';

import {
  ConditionTreeFactory,
  Page,
  PaginatedFilter,
  SchemaUtils,
} from '@forestadmin/datasource-toolkit';

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

// Records touched by a bulk operation, bounded so one write can't hold an unbounded result set in
// memory (or fan out an unbounded number of pending-row inserts). Truncation is logged explicitly
// rather than silently auditing only part of the operation.
const MAX_SNAPSHOT_RECORDS = 1000;

type PendingSnapshot = {
  before: RecordData[];
  patch?: RecordData;
  pendingIds: Array<number | null>;
};

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
function takeSnapshot(key: object, patch?: RecordData): PendingSnapshot | undefined {
  const queue = snapshotsByFilter.get(key);
  if (!queue || queue.length === 0) return undefined;

  const index = patch ? queue.findIndex(entry => deepEquals(entry.patch, patch)) : 0;
  const [entry] = queue.splice(index === -1 ? 0 : index, 1);

  if (queue.length === 0) snapshotsByFilter.delete(key);

  return entry;
}

// Create has no Filter to key by (there's nothing to select yet), but `context.data` is the exact
// same array reference in both the Before and After hook for one `.create()` call — verified via
// `HookBeforeCreateContext`/`HookAfterCreateContext`, which both wrap the literal `data` argument.
const pendingIdsByData = new WeakMap<object, Array<number | null>>();

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

type Delta = { previous: unknown; next: unknown; previousAbsent: boolean; nextAbsent: boolean };

// Returns only the leaves that changed. Plain objects and object-arrays recurse; everything else
// (scalars, primitive arrays, Date, BSON) is compared and kept whole. A leaf that did not exist
// before/after (as opposed to one explicitly set to `null`) is marked `*Absent`, so the caller
// simply omits that key/index from that side rather than writing a placeholder value: the stored
// diff itself never carries a marker, it just doesn't have the key.
const diff = (before: unknown, after: unknown): Delta | null => {
  if (deepEquals(before, after)) return null;

  if (isPlainObject(before) && isPlainObject(after)) {
    const previous: Record<string, unknown> = {};
    const next: Record<string, unknown> = {};

    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
      const subDelta = diff(before[key], after[key]);

      if (subDelta) {
        if (!subDelta.previousAbsent) previous[key] = subDelta.previous;
        if (!subDelta.nextAbsent) next[key] = subDelta.next;
      }
    }

    return { previous, next, previousAbsent: false, nextAbsent: false };
  }

  if (isObjectArray(before) && isObjectArray(after)) {
    const previous: Record<number, unknown> = {};
    const next: Record<number, unknown> = {};

    for (let index = 0; index < Math.max(before.length, after.length); index += 1) {
      const subDelta = diff(before[index], after[index]);

      if (subDelta) {
        if (!subDelta.previousAbsent) previous[index] = subDelta.previous;
        if (!subDelta.nextAbsent) next[index] = subDelta.next;
      }
    }

    return { previous, next, previousAbsent: false, nextAbsent: false };
  }

  return {
    previous: before === undefined ? undefined : toJsonSafe(before) ?? null,
    next: after === undefined ? undefined : toJsonSafe(after) ?? null,
    previousAbsent: before === undefined,
    nextAbsent: after === undefined,
  };
};

// Diffs against the record actually persisted by the write (`after`), not the requested patch, so
// the log reflects normalization/coercion/side effects applied by the datasource or a decorator.
const changedValues = (
  before: RecordData,
  after: RecordData,
  columns: string[],
): { previousValues: Record<string, unknown>; newValues: Record<string, unknown> } => {
  const previousValues: Record<string, unknown> = {};
  const newValues: Record<string, unknown> = {};

  for (const column of columns) {
    const delta = diff(before[column], after[column]);

    if (delta) {
      if (!delta.previousAbsent) previousValues[column] = delta.previous;
      if (!delta.nextAbsent) newValues[column] = delta.next;
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

// Bridges the two-phase pending/confirm protocol (a real `AuditStore`) with the simpler one-shot
// `sink`/console fallback. `confirm` only ever needs the fields that can change once the write
// resolves — identity/timestamp/correlation are fixed at insert time and never revisited — so a
// real store can apply it as a plain `UPDATE`. The sink has no DB row to update, so it retains each
// pending record locally under a synthetic id and merges the confirmation patch into it before
// calling the sink once with the complete record.
export type Recorder = {
  insertPendingBatch(records: PendingAuditRecord[]): Promise<Array<number | null>>;
  confirm(id: number | null, patch: AuditRecordConfirmation): Promise<void>;
};

export function buildRecorder(
  store: AuditStore | undefined,
  sink: AuditSink | undefined,
  critical: boolean,
  logger: Logger | undefined,
): Recorder {
  if (store) {
    return {
      async insertPendingBatch(records) {
        if (records.length === 0) return [];

        try {
          return await store.insertPendingBatch(records);
        } catch (error) {
          // Critical: no unaudited write — refuse the operation before it runs. Non-critical:
          // logged and swallowed, exactly like today's single-shot failures; the write proceeds
          // with nothing to confirm later.
          if (critical) throw error;

          logger?.(
            'Error',
            `[ForestAdmin] Audit trail: unable to record pending entries, continuing: ${error}`,
          );

          return records.map(() => null);
        }
      },
      async confirm(id, patch) {
        if (id === null) return;

        try {
          await store.confirm(id, patch);
        } catch (error) {
          // The write has already happened by now; there is nothing left to refuse.
          logger?.(
            'Error',
            `[ForestAdmin] Audit trail: unable to confirm entry, continuing: ${error}`,
          );
        }
      },
    };
  }

  const emit = sink ?? consoleSink;
  const pendingById = new Map<number, PendingAuditRecord>();
  let nextId = 1;

  return {
    async insertPendingBatch(records) {
      return records.map(record => {
        const id = nextId;
        nextId += 1;
        pendingById.set(id, record);

        return id;
      });
    },
    async confirm(id, patch) {
      if (id === null) return;

      const pending = pendingById.get(id);
      pendingById.delete(id);
      if (!pending) return;

      try {
        await emit({ ...pending, ...patch });
      } catch (error) {
        // The write has already happened by now; there is nothing left to refuse.
        logger?.(
          'Error',
          `[ForestAdmin] Audit trail: unable to confirm entry, continuing: ${error}`,
        );
      }
    },
  };
}

function instrumentCollection(
  collection: CollectionCustomizer,
  recorder: Recorder,
  redactedFields: string[],
  logger: Logger | undefined,
  critical: boolean,
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

  const buildRecord = (
    caller: Caller,
    entry: Pick<PendingAuditRecord, 'operation' | 'recordId' | 'previousValues' | 'newValues'>,
  ): PendingAuditRecord => ({
    timestamp: new Date().toISOString(),
    collection: name,
    userId: caller.id,
    userFirstName: caller.firstName,
    userLastName: caller.lastName,
    userEmail: caller.email,
    actionName: null,
    correlationKey: caller.requestId,
    ...entry,
    previousValues: redactValues(entry.previousValues, redactedFields),
    newValues: redactValues(entry.newValues, redactedFields),
  });

  // Requests one more than the cap: fetching exactly `MAX_SNAPSHOT_RECORDS` can never distinguish
  // "matched exactly the cap" (nothing lost) from "matched more than it" (truncated) — the extra
  // row is what makes that distinguishable, and is dropped again below before anything is audited.
  // Constructs a real `PaginatedFilter` (via `.override`-equivalent spread of `context.filter`'s
  // own fields, which is a plain `Filter` for Update/Delete) rather than merging `page` onto a bare
  // object: the latter would depend on `context.collection.list` happening to reconstruct a proper
  // instance from whatever shape it's handed, which isn't part of its contract.
  const withLimit = (filter: Filter): PaginatedFilter =>
    new PaginatedFilter({ ...filter, page: new Page(0, MAX_SNAPSHOT_RECORDS + 1) });

  // Hitting the cap means the operation may have matched more records than were actually audited.
  // Under `critical: false`, silently dropping the excess would look identical to "everything got
  // audited" — logged instead. Under `critical: true`, that gap is exactly what the option exists
  // to refuse: no unaudited write, so the whole operation is refused rather than let through
  // partially covered.
  const enforceSnapshotCap = (operation: 'update' | 'delete', truncated: boolean): void => {
    if (!truncated) return;

    const message =
      `[ForestAdmin] Audit trail: "${name}" ${operation} matched more than ` +
      `${MAX_SNAPSHOT_RECORDS} records — only the first ${MAX_SNAPSHOT_RECORDS} can be audited.`;

    if (critical) {
      throw new Error(`${message} Refusing the operation because "critical" is enabled.`);
    }

    logger?.('Warn', `${message} The rest were skipped.`);
  };

  collection.addInternalHook('Before', 'Create', async (context: HookBeforeCreateContext) => {
    const pendingRecords = context.data.map(() =>
      buildRecord(context.caller, {
        operation: 'create',
        recordId: null,
        previousValues: {},
        newValues: {},
      }),
    );
    const pendingIds = await recorder.insertPendingBatch(pendingRecords);

    pendingIdsByData.set(context.data, pendingIds);
  });

  collection.addInternalHook('After', 'Create', async (context: HookAfterCreateContext) => {
    const pendingIds = pendingIdsByData.get(context.data) ?? [];
    pendingIdsByData.delete(context.data);

    await Promise.all(
      context.records.map((record, index) =>
        recorder.confirm(pendingIds[index] ?? null, {
          operation: 'create',
          recordId: toPackedRecordId(record, primaryKeys),
          previousValues: {},
          newValues: redactValues(pickColumns(record, writableColumns), redactedFields),
        }),
      ),
    );
  });

  collection.addInternalHook('Before', 'Update', async (context: HookBeforeUpdateContext) => {
    const fetched = (await context.collection.list(
      // `context.filter` is typed as the plain-object `TFilter` shape for customer ergonomics, but
      // is a real (frozen) `Filter` instance at runtime — the same cast the hook decorator itself
      // performs to produce it.
      withLimit(context.filter as unknown as Filter) as never,
      readProjection as never[],
    )) as RecordData[];

    const truncated = fetched.length > MAX_SNAPSHOT_RECORDS;
    enforceSnapshotCap('update', truncated);
    const before = truncated ? fetched.slice(0, MAX_SNAPSHOT_RECORDS) : fetched;

    const pendingRecords = before.map(record =>
      buildRecord(context.caller, {
        operation: 'update',
        recordId: toPackedRecordId(record, primaryKeys),
        previousValues: pickColumns(record, writableColumns),
        newValues: {},
      }),
    );
    const pendingIds = await recorder.insertPendingBatch(pendingRecords);

    pushSnapshot(context.filter, { before, patch: context.patch, pendingIds });
  });

  collection.addInternalHook('After', 'Update', async (context: HookBeforeUpdateContext) => {
    const snapshot = takeSnapshot(context.filter, context.patch);

    if (!snapshot || snapshot.before.length === 0) return;

    const { before, pendingIds } = snapshot;

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
    const afterById = new Map(after.map(record => [toPackedRecordId(record, primaryKeys), record]));

    await Promise.all(
      before.map((record, index) => {
        const updated = afterById.get(toPackedRecordId(expectedRecords[index], primaryKeys));
        const pendingId = pendingIds[index] ?? null;

        if (!updated) return undefined;

        const { previousValues, newValues } = changedValues(record, updated, writableColumns);

        // Confirmed even when empty: the write still ran and resolved, so leaving the pending row
        // unconfirmed would misrepresent a completed no-op write as one that never landed.
        // Packed from the post-update values: if the update changed a writable primary key, the
        // entry is filed under the record's new id, matching what later history lookups use.
        return recorder.confirm(pendingId, {
          operation: 'update',
          recordId: toPackedRecordId(updated, primaryKeys),
          previousValues: redactValues(previousValues, redactedFields),
          newValues: redactValues(newValues, redactedFields),
        });
      }),
    );
  });

  collection.addInternalHook('Before', 'Delete', async (context: HookBeforeDeleteContext) => {
    const fetched = (await context.collection.list(
      // `context.filter` is typed as the plain-object `TFilter` shape for customer ergonomics, but
      // is a real (frozen) `Filter` instance at runtime — the same cast the hook decorator itself
      // performs to produce it.
      withLimit(context.filter as unknown as Filter) as never,
      readProjection as never[],
    )) as RecordData[];

    const truncated = fetched.length > MAX_SNAPSHOT_RECORDS;
    enforceSnapshotCap('delete', truncated);
    const before = truncated ? fetched.slice(0, MAX_SNAPSHOT_RECORDS) : fetched;

    const pendingRecords = before.map(record =>
      buildRecord(context.caller, {
        operation: 'delete',
        recordId: toPackedRecordId(record, primaryKeys),
        previousValues: pickColumns(record, writableColumns),
        newValues: {},
      }),
    );
    const pendingIds = await recorder.insertPendingBatch(pendingRecords);

    pushSnapshot(context.filter, { before, pendingIds });
  });

  collection.addInternalHook('After', 'Delete', async (context: HookBeforeDeleteContext) => {
    const snapshot = takeSnapshot(context.filter);
    if (!snapshot) return;

    const { before, pendingIds } = snapshot;

    await Promise.all(
      before.map((record, index) =>
        recorder.confirm(pendingIds[index] ?? null, {
          operation: 'delete',
          recordId: toPackedRecordId(record, primaryKeys),
          previousValues: redactValues(pickColumns(record, writableColumns), redactedFields),
          newValues: {},
        }),
      ),
    );
  });
}

export default function installAuditTrailHooks(
  dataSourceCustomizer: DataSourceCustomizer,
  _collectionCustomizer: CollectionCustomizer | null,
  options?: AuditTrailInstrumentOptions,
): Promise<void> | void {
  const { sink, store, redact, critical = false, logger } = options ?? {};
  const recorder = buildRecorder(store, sink, critical, logger);

  for (const collection of dataSourceCustomizer.collections) {
    // toPackedRecordId throws for a collection with no primary key — there is nothing to key an
    // audit entry on, so skip instrumenting it entirely rather than installing hooks that would
    // throw on the collection's first write.
    if (SchemaUtils.getPrimaryKeys(collection.schema).length === 0) {
      logger?.(
        'Warn',
        `[ForestAdmin] Audit trail: skipping "${collection.name}" — it has no primary key.`,
      );
    } else {
      instrumentCollection(collection, recorder, redact?.[collection.name] ?? [], logger, critical);
    }
  }

  // Returned so a broken bootstrap fails agent.start() instead of the first write.
  return store?.init?.();
}

import type {
  CollectionCustomizer,
  HookBeforeCreateContext,
  HookBeforeUpdateContext,
  TConditionTree,
} from '@forestadmin/datasource-customizer';

import {
  ColumnSchema,
  ColumnType,
  ConditionTreeFactory,
  SchemaUtils,
} from '@forestadmin/datasource-toolkit';
import hashRecord from 'object-hash';

import { deepUpdateInPlace, getValue, unflattenPathsInPlace } from './helpers';

export function makeField(columnName: string, path: string, schema: ColumnSchema) {
  const columnType = getValue({ [columnName]: schema.columnType }, path) as ColumnType;
  if (!columnType) throw new Error(`Cannot add field '${path}' (dependency not found).`);

  return {
    columnType,
    dependencies: [columnName],
    getValues: records => records.map(r => getValue(r, path)),
  };
}

export function makeWriteHandler(path: string) {
  // We're ignoring this line in coverage because it's not callable: we're adding a write handler
  // only so that the field is marked as writable, but all the writes are handled by the hooks.

  // istanbul ignore next
  return () => {
    throw new Error(`Cannot write on computed field '${path}'. Did you inhibit BeforeHooks?`);
  };
}

export function makeCreateHook(paths: string[]) {
  return async (context: HookBeforeCreateContext) => {
    for (const record of context.data) {
      unflattenPathsInPlace(paths, record);
    }
  };
}

export function makeUpdateHook(
  collection: CollectionCustomizer,
  columnName: string,
  paths: string[],
) {
  return async (context: HookBeforeUpdateContext) => {
    unflattenPathsInPlace(paths, context.patch);

    // We're not updating the nested column, so we don't have anything to do.
    if (!context.patch[columnName]) return;

    // List the records that we're updating, and group them by the patch that we'll need to apply
    const projection = [...SchemaUtils.getPrimaryKeys(collection.schema), columnName];
    const records = await context.collection.list(context.filter, projection);
    const recordsByPatch = new Map();

    for (const record of records) {
      const patchForThatRecord = { [columnName]: record[columnName] };
      deepUpdateInPlace(patchForThatRecord, { [columnName]: context.patch[columnName] });

      const hash = hashRecord(patchForThatRecord);
      if (!recordsByPatch.has(hash))
        recordsByPatch.set(hash, { matches: [], patch: patchForThatRecord });
      recordsByPatch.get(hash).matches.push(record);
    }

    if (recordsByPatch.size === 1) {
      // All records have the same patch!
      // That happened either because we got only one record, or because we got lucky.
      // In any case, we don't need to perform separate requests.
      const { patch } = recordsByPatch.values().next().value;

      context.patch[columnName] = patch[columnName];
    } else {
      // Different patches need to be applied to different groups of records.
      // We need to perform separate requests.
      const promises = [...recordsByPatch.values()].map(({ matches, patch }) => {
        const conditionTree = ConditionTreeFactory.matchRecords(collection.schema, matches);
        const filter = { conditionTree: conditionTree as unknown as TConditionTree };

        return context.collection.update(filter, patch);
      });

      await Promise.all(promises);

      // Tell child decorators that we've already handled the update.
      delete context.patch[columnName];
    }
  };
}

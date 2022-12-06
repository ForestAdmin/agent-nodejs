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
  return {
    columnType: getValue({ [columnName]: schema.columnType }, path) as ColumnType,
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
      const externalPatch = unflattenPathsInPlace(paths, record);
      deepUpdateInPlace(record, externalPatch);
    }
  };
}

export function makeUpdateHook(
  collection: CollectionCustomizer,
  columnName: string,
  paths: string[],
) {
  return async (context: HookBeforeUpdateContext) => {
    const externalPatch = unflattenPathsInPlace(paths, context.patch);
    if (Object.keys(externalPatch).length === 0) return;

    // Generate patches to update the nested column
    const projection = [...SchemaUtils.getPrimaryKeys(collection.schema), columnName];
    const allRecords = await context.collection.list(context.filter, projection);
    const allRecordByPatch = {};

    for (const record of allRecords) {
      const patchForThatRecord = { [columnName]: record[columnName] };
      deepUpdateInPlace(patchForThatRecord, externalPatch);

      const hash = hashRecord(patchForThatRecord);
      allRecordByPatch[hash] ??= { records: [], patch: patchForThatRecord };
      allRecordByPatch[hash].records.push(record);
    }

    // Update the nested column by grouping records by patch
    // This is done to avoid too many requests to the database (we do one per distinct patch
    // instead of one per record)
    const promises = Object.values(allRecordByPatch).map(async ({ records, patch }) => {
      const conditionTree = ConditionTreeFactory.matchRecords(collection.schema, records);

      await context.collection.update(
        { conditionTree: conditionTree as unknown as TConditionTree },
        patch,
      );
    });

    await Promise.all(promises);
  };
}

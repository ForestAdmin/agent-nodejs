import {
  Caller,
  CollectionSchema,
  ColumnSchema,
  Filter,
  RecordData,
  RecordValidator,
} from '@forestadmin/datasource-toolkit';

import CollectionDecorator from '../../collection-decorator';
import DataSourceDecorator from '../../datasource-decorator';
import WriteCustomizationContext from './context';
import { WriteDefinition } from './types';

export default class WriteReplacerCollectionDecorator extends CollectionDecorator {
  private handlers: Record<string, WriteDefinition> = {};
  override readonly dataSource: DataSourceDecorator<WriteReplacerCollectionDecorator>;

  replaceFieldWriting(fieldName: string, definition: WriteDefinition): void {
    if (!Object.keys(this.schema.fields).includes(fieldName)) {
      throw new Error(
        `The given field "${fieldName}" does not exist on the ${this.name} collection.`,
      );
    }

    this.handlers[fieldName] = definition;
    this.markSchemaAsDirty();
  }

  protected override refineSchema(childSchema: CollectionSchema): CollectionSchema {
    const schema = { ...childSchema, fields: { ...childSchema.fields } };

    for (const name of Object.keys(this.handlers)) {
      (schema.fields[name] as ColumnSchema).isReadOnly = false;
    }

    return schema;
  }

  override async create(caller: Caller, records: RecordData[]): Promise<RecordData[]> {
    const promises = records.map(record => this.rewritePatch(caller, 'create', record));
    const newRecords = await Promise.all(promises);

    return this.childCollection.create(caller, newRecords);
  }

  override async update(caller: Caller, filter: Filter, patch: RecordData): Promise<void> {
    const newPatch = await this.rewritePatch(caller, 'update', patch);

    this.childCollection.update(caller, filter, newPatch);
  }

  /**
   * Takes a patch and recursively applies all rewriting rules to it.
   */
  private async rewritePatch(
    caller: Caller,
    action: 'create' | 'update',
    patch: RecordData,
    usedHandlers: string[] = [],
  ): Promise<RecordData> {
    const keys = Object.keys(patch);

    // Either call our field handlers or delegate everything to relation.
    const context = new WriteCustomizationContext(this, caller, action, patch);
    const noRecursionPatch = {};
    const recursionPatches = keys.map(async key => {
      const schema = this.schema.fields[key];

      // Handle common errors with proper messages.
      if (!schema) throw new Error(`Unknown field: "${key}"`);
      if (usedHandlers.includes(key))
        throw new Error(`Cycle detected: ${usedHandlers.join(' -> ')}.`);

      // Handle column case
      if (schema?.type === 'Column') {
        const handler = this.handlers[key] ?? (v => ({ [key]: v }));
        const fieldPatch = ((await handler(patch[key], context)) ?? {}) as RecordData[];

        if (fieldPatch && fieldPatch.constructor !== Object)
          throw new Error(`The write handler of ${key} should return an object or nothing.`);

        // Isolate changes from handlers that change their own value.
        if (fieldPatch[key] !== undefined) {
          noRecursionPatch[key] = fieldPatch[key];
          delete fieldPatch[key];
        }

        // Recurse for the remaining changes.
        return this.rewritePatch(caller, action, fieldPatch, [...usedHandlers, key]);
      }

      // Completely delegate rewriting to the relation itself.
      noRecursionPatch[key] = await this.dataSource
        .getCollection(schema.foreignCollection)
        .rewritePatch(caller, action, patch[key]);

      return {};
    });

    const finalPatch = this.deepMerge(noRecursionPatch, ...(await Promise.all(recursionPatches)));
    if (Object.keys(finalPatch).length > 0) RecordValidator.validate(this, finalPatch);

    return finalPatch;
  }

  /**
   * Recursively merge patches into a single one ensuring that there is no conflict.
   */
  private deepMerge(...patches: RecordData[]): RecordData {
    const acc = {};

    for (const patch of patches) {
      for (const [key, value] of Object.entries(patch)) {
        if (acc[key] === undefined) {
          acc[key] = value;
        } else if (
          value &&
          typeof value === 'object' &&
          Object.getPrototypeOf(value) === Object.prototype
        ) {
          // We could check that this is a relation field but we choose to only check for objects
          // to allow customers to use this for JSON fields.
          acc[key] = this.deepMerge(acc[key], value);
        } else {
          throw new Error(`Conflict value on the field "${key}". It received several values.`);
        }
      }
    }

    return acc;
  }
}

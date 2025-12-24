import type { WriteDefinition } from './types';
import type {
  Caller,
  CollectionSchema,
  DataSourceDecorator,
  Filter,
  RecordData,
} from '@forestadmin/datasource-toolkit';

import {
  CollectionDecorator,
  FieldValidator,
  RecordValidator,
  SchemaUtils,
} from '@forestadmin/datasource-toolkit';

import WriteCustomizationContext from './context';

export default class WriteReplacerCollectionDecorator extends CollectionDecorator {
  private handlers: Record<string, WriteDefinition> = {};
  override readonly dataSource: DataSourceDecorator<WriteReplacerCollectionDecorator>;

  replaceFieldWriting(fieldName: string, definition: WriteDefinition): void {
    if (!definition) {
      throw new Error('A new writing method should be provided to replace field writing');
    }

    FieldValidator.validate(this, fieldName);
    this.handlers[fieldName] = definition;
    this.markSchemaAsDirty();
  }

  protected override refineSchema(childSchema: CollectionSchema): CollectionSchema {
    const schema = { ...childSchema, fields: { ...childSchema.fields } };

    for (const [fieldName, handler] of Object.entries(this.handlers)) {
      schema.fields[fieldName] = {
        ...SchemaUtils.getColumn(schema, fieldName, this.name),
        isReadOnly: handler === null,
      };
    }

    return schema;
  }

  override async create(caller: Caller, records: RecordData[]): Promise<RecordData[]> {
    const promises = records.map(record => this.rewritePatch(caller, 'create', record));
    const newRecords = await Promise.all(promises);

    return this.childCollection.create(caller, newRecords);
  }

  override async update(caller: Caller, filter: Filter, patch: RecordData): Promise<void> {
    const newPatch = await this.rewritePatch(caller, 'update', patch, [], filter);

    return this.childCollection.update(caller, filter, newPatch);
  }

  /**
   * Takes a patch and recursively applies all rewriting rules to it.
   */
  private async rewritePatch(
    caller: Caller,
    action: 'create' | 'update',
    patch: RecordData,
    usedHandlers: string[] = [],
    filter?: Filter,
  ): Promise<RecordData> {
    // We rewrite the patch by applying all handlers on each field.
    const context = new WriteCustomizationContext(this, caller, action, patch, filter);
    const patches = await Promise.all(
      Object.keys(patch).map(key => this.rewriteKey(context, key, usedHandlers)),
    );

    // We now have a list of patches (one per field) that we can merge.
    const newPatch = this.deepMerge(...patches);

    // Check that the customer handlers did not introduce invalid data.
    if (Object.keys(newPatch).length > 0) RecordValidator.validate(this, newPatch);

    return newPatch;
  }

  private async rewriteKey(
    context: WriteCustomizationContext,
    key: string,
    used: string[],
  ): Promise<RecordData> {
    // Guard against infinite recursion.
    if (used.includes(key)) throw new Error(`Cycle detected: ${used.join(' -> ')}.`);

    const { record, action, caller } = context;
    const schema = SchemaUtils.getField(this.schema, key, this.name);

    // Handle Column fields.
    if (schema?.type === 'Column') {
      // We either call the customer handler or a default one that does nothing.
      const handler = this.handlers[key] ?? (v => ({ [key]: v }));
      const fieldPatch = ((await handler(record[key], context)) ?? {}) as RecordData;

      if (fieldPatch && !this.isObject(fieldPatch)) {
        throw new Error(`The write handler of ${key} should return an object or nothing.`);
      }

      // Isolate change to our own value (which should not recurse) and the rest which should
      // trigger the other handlers.
      const { [key]: value, ...recursionPatch } = fieldPatch;
      const newPatch = await this.rewritePatch(caller, action, recursionPatch, [...used, key]);

      return value !== undefined ? this.deepMerge({ [key]: value }, newPatch) : newPatch;
    }

    // Handle relation fields.
    if (schema?.type === 'ManyToOne' || schema?.type === 'OneToOne') {
      // Delegate relations to the appropriate collection.
      const relation = this.dataSource.getCollection(schema.foreignCollection);

      return { [key]: await relation.rewritePatch(caller, action, record[key]) };
    }
  }

  /**
   * Recursively merge patches into a single one ensuring that there is no conflict.
   */
  private deepMerge(...patches: RecordData[]): RecordData {
    const acc = {};

    for (const patch of patches) {
      for (const [key, value] of Object.entries(patch)) {
        // We could check that this is a relation field but we choose to only check for objects
        // to allow customers to use this for JSON fields.
        if (acc[key] === undefined) acc[key] = value;
        else if (this.isObject(value)) acc[key] = this.deepMerge(acc[key], value);
        else throw new Error(`Conflict value on the field "${key}". It received several values.`);
      }
    }

    return acc;
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;
  }
}

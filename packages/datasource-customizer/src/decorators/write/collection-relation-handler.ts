import {
  Caller,
  CollectionSchema,
  ColumnSchema,
  ConditionTreeLeaf,
  FieldTypes,
  Filter,
  ManyToOneSchema,
  OneToOneSchema,
  Projection,
  RecordData,
  RecordValidator,
  RelationSchema,
  SchemaUtils,
} from '@forestadmin/datasource-toolkit';

import CollectionDecorator from '../collection-decorator';
import DataSourceDecorator from '../datasource-decorator';
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

    return this.createRecordsWithRelations(caller, newRecords);
  }

  override async update(caller: Caller, filter: Filter, patch: RecordData): Promise<void> {
    const updatedPatch = await this.rewritePatch(caller, 'update', patch);
    const relations = this.getRelationFields(updatedPatch, ['OneToOne', 'ManyToOne']);
    const idsList = await this.getImpactedRecordByUpdate(caller, relations, filter);

    await Promise.all([
      ...this.updateAllRelations(caller, idsList, updatedPatch),
      this.childCollection.update(
        caller,
        filter,
        this.getPatchWithoutRelations(updatedPatch, relations),
      ),
    ]);
  }

  private async createRecordsWithRelations(
    caller: Caller,
    records: RecordData[],
  ): Promise<RecordData[]> {
    // Step 1: Remove all relations from records, and store them in a map
    const recordsByRelation: Record<string, Array<{ subRecord: RecordData; index: number }>> = {};

    for (const [index, record] of records.entries()) {
      for (const [key, subRecord] of Object.entries(record)) {
        if (this.schema.fields[key].type !== 'Column') {
          recordsByRelation[key] ??= [];
          recordsByRelation[key].push({ subRecord, index });
          delete record[key];
        }
      }
    }

    // Step 2: Create the many-to-one relations, and put the foreign keys in the records
    await Promise.all(
      Object.entries(recordsByRelation).map(async ([key, relatedEntries]) => {
        if (this.schema.fields[key].type === 'ManyToOne') {
          // Step 2: Create the relations
          const schema = this.schema.fields[key] as ManyToOneSchema;
          const relation = this.dataSource.getCollection(schema.foreignCollection);
          const relatedRecords = await relation.createRecordsWithRelations(
            caller,
            relatedEntries.map(({ subRecord }) => subRecord),
          );

          // Step 3: Set the foreign keys from the created relations
          for (const { index } of relatedEntries)
            records[index][schema.foreignKey] = relatedRecords[index][schema.foreignKeyTarget];
        }
      }),
    );

    // Step 3: Create the records
    const finalRecords = await this.childCollection.create(caller, records);

    // Step 4: Create the one-to-one relations
    await Promise.all(
      Object.entries(recordsByRelation).map(async ([key, relatedEntries]) => {
        if (this.schema.fields[key].type === 'OneToOne') {
          const schema = this.schema.fields[key] as OneToOneSchema;
          const relation = this.dataSource.getCollection(schema.foreignCollection);

          // Set origin key in the related record
          const subRecords = relatedEntries.map(({ index, subRecord }) => ({
            ...subRecord,
            [schema.originKey]: records[index][schema.originKeyTarget],
          }));

          await relation.createRecordsWithRelations(caller, subRecords);
        }
      }),
    );

    return finalRecords;
  }

  private updateAllRelations(
    caller: Caller,
    listIds: RecordData[][],
    patch: RecordData,
  ): Promise<void | RecordData[]>[] {
    const updates: Promise<void | RecordData[]>[] = [];
    const relations = this.getRelationFields(patch, ['OneToOne', 'ManyToOne']);

    for (const recordIds of listIds) {
      const relationName = relations.shift();
      const relationSchema = this.schema.fields[relationName] as RelationSchema;
      const relation = this.dataSource.getCollection(relationSchema.foreignCollection);

      const ids = recordIds.map(field => Object.values(field)[0]);
      let key: string | number;

      if (relationSchema.type === 'OneToOne') {
        key = relationSchema.originKey;
      } else {
        [key] = SchemaUtils.getPrimaryKeys(relation.schema);
      }

      const idsFilter = new Filter({ conditionTree: new ConditionTreeLeaf(key, 'In', ids) });
      updates.push(relation.update(caller, idsFilter, patch[relationName] as RecordData));
    }

    return updates;
  }

  private async getImpactedRecordByUpdate(
    caller: Caller,
    relations: string[],
    filter: Filter,
  ): Promise<RecordData[][]> {
    const records: Promise<RecordData[]>[] = [];

    for (const relationName of relations) {
      const relationSchema = this.schema.fields[relationName] as RelationSchema;
      let projection: Projection;

      if (relationSchema.type === 'OneToOne') {
        projection = new Projection(...SchemaUtils.getPrimaryKeys(this.schema));
      } else if (relationSchema.type === 'ManyToOne') {
        projection = new Projection(relationSchema.foreignKey);
      }

      records.push(this.list(caller, filter, projection));
    }

    return Promise.all(records);
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
          // We could check that this is a relation field but checking for objects instead allows
          // customers to use this for JSON fields.
          acc[key] = this.deepMerge(acc[key], value);
        } else {
          throw new Error(`Conflict value on the field "${key}". It received several values.`);
        }
      }
    }

    return acc;
  }

  private getRelationFields(patch: RecordData, types: FieldTypes[]): string[] {
    return Object.keys(patch).filter(field => types.includes(this.schema.fields[field]?.type));
  }

  private getPatchWithoutRelations(patch: RecordData, relations: string[]): RecordData {
    const copy = { ...patch };
    relations.forEach(relation => delete copy[relation]);

    return copy;
  }
}

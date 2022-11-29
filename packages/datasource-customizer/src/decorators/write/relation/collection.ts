/* eslint-disable no-await-in-loop */
import {
  Caller,
  ConditionTreeFactory,
  ConditionTreeLeaf,
  FieldTypes,
  Filter,
  ManyToOneSchema,
  OneToOneSchema,
  Projection,
  RecordData,
  RelationSchema,
  SchemaUtils,
} from '@forestadmin/datasource-toolkit';

import CollectionDecorator from '../../collection-decorator';
import DataSourceDecorator from '../../datasource-decorator';

export default class RelationWriterCollectionDecorator extends CollectionDecorator {
  override readonly dataSource: DataSourceDecorator<RelationWriterCollectionDecorator>;

  override async create(caller: Caller, records: RecordData[]): Promise<RecordData[]> {
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
          const relatedRecords = await relation.create(
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

          await relation.create(caller, subRecords);
        }
      }),
    );

    return finalRecords;
  }

  override async update(caller: Caller, filter: Filter, patch: RecordData): Promise<void> {
    // Early return if there is no relation to update
    if (Object.keys(patch).every(key => this.schema.fields[key].type === 'Column')) {
      return this.childCollection.update(caller, filter, patch);
    }

    // {
    //   title: 'Hello World',
    //   author: { firstName: 'John' }, // many to one
    //   editor: { firstName: 'Jane' } // one to one
    // }

    // Step 1: Get the records to update with the relevant keys
    let projection = new Projection().withPks(this);

    for (const key of Object.keys(patch)) {
      const schema = this.schema.fields[key];

      if (schema.type === 'ManyToOne') {
        projection = projection
          .union(new Projection(schema.foreignKey))
          .union(new Projection(schema.foreignKeyTarget).nest(key));
      }

      if (schema.type === 'OneToOne') {
        projection = projection
          .union(new Projection(schema.originKeyTarget))
          .union(new Projection(schema.originKey).nest(key));
      }
    }

    const records = await this.list(caller, filter, projection);

    for (const key of Object.keys(patch).filter(k => this.schema.fields[k].type !== 'Column')) {
      const schema = this.schema.fields[key] as RelationSchema;
      const relation = this.dataSource.getCollection(schema.foreignCollection);
      const creates = records.filter(r => r[key] === null);
      const updates = records.filter(r => r[key] !== null);

      if (schema.type === 'ManyToOne') {
        if (creates.length > 0) {
          // Step 2: Create the many-to-one relations that don't already exist and put the foreign
          // keys in the records
          const [subRecord] = await relation.create(caller, [patch[key]]);

          await this.update(
            caller,
            new Filter({ conditionTree: ConditionTreeFactory.matchRecords(this.schema, creates) }),
            { [schema.foreignKey]: subRecord[0][schema.foreignKeyTarget] },
          );
        }

        if (updates.length > 0) {
          // Step 3: Update the many-to-one relations that already exist
          const conditionTree = new ConditionTreeLeaf(schema.foreignKeyTarget, 'In', [
            ...new Set(updates.map(r => r[schema.foreignKey])),
          ]);

          await relation.update(caller, new Filter({ conditionTree }), patch[key]);
        }
      }

      if (schema.type === 'OneToOne') {
        if (creates.length > 0) {
          // Step 2: Create the one-to-one relations that don't already exist
          // (we need to create as many records as there are records to update...)
          await relation.create(
            caller,
            creates.map(r => ({ ...patch[key], [schema.originKey]: r[schema.originKeyTarget] })),
          );
        }

        if (updates.length > 0) {
          // Step 3: Update the one-to-one relations that already exist
          const conditionTree = new ConditionTreeLeaf(schema.originKey, 'In', [
            ...new Set(updates.map(r => r[schema.originKeyTarget])),
          ]);

          await relation.update(caller, new Filter({ conditionTree }), patch[key]);
        }
      }
    }
  }

  private updateAllRelations(
    caller: Caller,
    listIds: RecordData[][],
    patch: RecordData,
  ): Promise<void>[] {
    const updates: Promise<void>[] = [];
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

  private getRelationFields(patch: RecordData, types: FieldTypes[]): string[] {
    return Object.keys(patch).filter(field => types.includes(this.schema.fields[field]?.type));
  }

  private getPatchWithoutRelations(patch: RecordData, relations: string[]): RecordData {
    const copy = { ...patch };
    relations.forEach(relation => delete copy[relation]);

    return copy;
  }
}

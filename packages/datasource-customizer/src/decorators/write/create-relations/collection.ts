/* eslint-disable no-await-in-loop */
import {
  Caller,
  ConditionTreeLeaf,
  Filter,
  ManyToOneSchema,
  OneToOneSchema,
  RecordData,
} from '@forestadmin/datasource-toolkit';

import CollectionDecorator from '../../collection-decorator';

type RecordWithIndex = { subRecord: RecordData; index: number };

export default class CreateRelationsCollectionDecorator extends CollectionDecorator {
  override async create(caller: Caller, records: RecordData[]): Promise<RecordData[]> {
    // Step 1: Remove all relations from records, and store them in a map
    // Note: the extractRelations method modifies the records array in place!
    const recordsByRelation = this.extractRelations(records);

    // Step 2: Create the many-to-one relations, and put the foreign keys in the records
    await Promise.all(
      Object.entries(recordsByRelation)
        .filter(([key]) => this.schema.fields[key].type === 'ManyToOne')
        .map(([key, entries]) => this.createManyToOneRelation(caller, records, key, entries)),
    );

    // Step 3: Create the records
    const recordsWithPk = await this.childCollection.create(caller, records);

    // Step 4: Create the one-to-one relations
    // Note: the createOneToOneRelation method modifies the recordsWithPk array in place!
    await Promise.all(
      Object.entries(recordsByRelation)
        .filter(([key]) => this.schema.fields[key].type === 'OneToOne')
        .map(([key, entries]) => this.createOneToOneRelation(caller, recordsWithPk, key, entries)),
    );

    return recordsWithPk;
  }

  private extractRelations(records: RecordData[]): Record<string, RecordWithIndex[]> {
    const recordsByRelation: Record<string, RecordWithIndex[]> = {};

    for (const [index, record] of records.entries()) {
      for (const [key, subRecord] of Object.entries(record)) {
        if (this.schema.fields[key].type !== 'Column') {
          recordsByRelation[key] ??= [];
          recordsByRelation[key].push({ subRecord, index });
          delete record[key];
        }
      }
    }

    return recordsByRelation;
  }

  private async createManyToOneRelation(
    caller: Caller,
    records: RecordData[],
    key: string,
    entries: RecordWithIndex[],
  ): Promise<void> {
    const schema = this.schema.fields[key] as ManyToOneSchema;
    const relation = this.dataSource.getCollection(schema.foreignCollection);
    const creations = entries.filter(({ index }) => !records[index][schema.foreignKey]);
    const updates = entries.filter(({ index }) => records[index][schema.foreignKey]);

    // Create the relations when the fk is not present
    if (creations.length) {
      const subRecords = entries.map(({ subRecord }) => subRecord);
      const relatedRecords = await relation.create(caller, subRecords);

      for (const { index } of entries)
        records[index][schema.foreignKey] = relatedRecords[index][schema.foreignKeyTarget];
    }

    // Update the relations when the fk is present
    await Promise.all(
      updates.map(async ({ index, subRecord }) => {
        const value = records[index][schema.foreignKey];
        const conditionTree = new ConditionTreeLeaf(schema.foreignKeyTarget, 'Equal', value);

        return relation.update(caller, new Filter({ conditionTree }), subRecord);
      }),
    );
  }

  private async createOneToOneRelation(
    caller: Caller,
    records: RecordData[],
    key: string,
    entries: RecordWithIndex[],
  ): Promise<void> {
    const schema = this.schema.fields[key] as OneToOneSchema;
    const relation = this.dataSource.getCollection(schema.foreignCollection);

    // Set origin key in the related record
    const subRecords = entries.map(({ index, subRecord }) => ({
      ...subRecord,
      [schema.originKey]: records[index][schema.originKeyTarget],
    }));

    await relation.create(caller, subRecords);
  }
}

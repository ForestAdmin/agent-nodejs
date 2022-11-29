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

export default class CreateRelationsCollectionDecorator extends CollectionDecorator {
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
      Object.entries(recordsByRelation).map(async ([key, entries]) => {
        if (this.schema.fields[key].type === 'ManyToOne') {
          const schema = this.schema.fields[key] as ManyToOneSchema;
          const relation = this.dataSource.getCollection(schema.foreignCollection);
          const creations = entries.filter(({ index }) => !records[index][schema.foreignKey]);
          const updates = entries.filter(({ index }) => records[index][schema.foreignKey]);

          // Create the relations when the fk is not present
          if (creations.length) {
            const relatedRecords = await relation.create(
              caller,
              entries.map(({ subRecord }) => subRecord),
            );

            for (const { index } of entries)
              records[index][schema.foreignKey] = relatedRecords[index][schema.foreignKeyTarget];
          }

          // Update the relations when the fk is present
          await Promise.all(
            updates.map(async ({ index, subRecord }) => {
              const conditionTree = new ConditionTreeLeaf(
                schema.foreignKeyTarget,
                'Equal',
                records[index][schema.foreignKey],
              );

              return relation.update(caller, new Filter({ conditionTree }), subRecord);
            }),
          );
        }
      }),
    );

    // Step 3: Create the records
    const finalRecords = await this.childCollection.create(caller, records);

    // Step 4: Create the one-to-one relations
    await Promise.all(
      Object.entries(recordsByRelation).map(async ([key, entries]) => {
        if (this.schema.fields[key].type === 'OneToOne') {
          const schema = this.schema.fields[key] as OneToOneSchema;
          const relation = this.dataSource.getCollection(schema.foreignCollection);

          // Set origin key in the related record
          const subRecords = entries.map(({ index, subRecord }) => ({
            ...subRecord,
            [schema.originKey]: finalRecords[index][schema.originKeyTarget],
          }));

          await relation.create(caller, subRecords);
        }
      }),
    );

    return finalRecords;
  }
}

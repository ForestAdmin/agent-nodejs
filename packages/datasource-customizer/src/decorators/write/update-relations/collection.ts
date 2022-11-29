/* eslint-disable no-await-in-loop */
import {
  Caller,
  ConditionTreeFactory,
  Filter,
  ManyToOneSchema,
  OneToOneSchema,
  Projection,
  RecordData,
} from '@forestadmin/datasource-toolkit';

import CollectionDecorator from '../../collection-decorator';

export default class UpdateRelationCollectionDecorator extends CollectionDecorator {
  override async update(caller: Caller, filter: Filter, patch: RecordData): Promise<void> {
    // Step 1: Perform the normal update
    if (Object.keys(patch).some(key => this.schema.fields[key].type === 'Column')) {
      const patchWithoutRelations = Object.keys(patch).reduce((memo, key) => {
        return this.schema.fields[key].type === 'Column' ? { ...memo, [key]: patch[key] } : memo;
      }, {});

      await this.childCollection.update(caller, filter, patchWithoutRelations);
    }

    // Step 2: Perform additional updates for relations
    if (Object.keys(patch).some(key => this.schema.fields[key].type !== 'Column')) {
      // Fetch the records that will be updated, to know which relations need to be created/updated
      const projection = this.buildProjection(patch);
      const records = await this.list(caller, filter, projection);

      // Perform the updates for each relation
      await Promise.all(
        Object.keys(patch)
          .filter(key => this.schema.fields[key].type !== 'Column')
          .map(key => this.createOrUpdateRelation(caller, records, key, patch[key])),
      );
    }
  }

  /**
   * Build a projection that has enough information to know
   * - which relations need to be created/updated
   * - the values that will be used to build filters to target records
   * - the values that will be used to create/update the relations
   */
  private buildProjection(patch: RecordData): Projection {
    let projection = new Projection().withPks(this);

    for (const key of Object.keys(patch)) {
      const schema = this.schema.fields[key];

      if (schema.type !== 'Column') {
        const relation = this.dataSource.getCollection(schema.foreignCollection);

        projection = projection.union(new Projection().withPks(relation).nest(key));
        if (schema.type === 'ManyToOne')
          projection = projection.union(new Projection(schema.foreignKeyTarget).nest(key));
        if (schema.type === 'OneToOne')
          projection = projection.union(new Projection(schema.originKeyTarget));
      }
    }

    return projection;
  }

  /**
   * Create or update the relation provided in the key parameter according to the patch.
   */
  private async createOrUpdateRelation(
    caller: Caller,
    records: RecordData[],
    key: string,
    patch: RecordData,
  ): Promise<void> {
    const schema = this.schema.fields[key] as ManyToOneSchema | OneToOneSchema;
    const relation = this.dataSource.getCollection(schema.foreignCollection);
    const creates = records.filter(r => r[key] === null);
    const updates = records.filter(r => r[key] !== null);

    if (creates.length > 0) {
      if (schema.type === 'ManyToOne') {
        // Create many-to-one relations
        const [subRecord] = await relation.create(caller, [patch]);

        // Set foreign key on the parent records
        const conditionTree = ConditionTreeFactory.matchRecords(this.schema, creates);
        const parentPatch = { [schema.foreignKey]: subRecord[schema.foreignKeyTarget] };

        await this.update(caller, new Filter({ conditionTree }), parentPatch);
      } else {
        // Create the one-to-one relations that don't already exist
        await relation.create(
          caller,
          creates.map(record => ({ ...patch, [schema.originKey]: record[schema.originKeyTarget] })),
        );
      }
    }

    // Update the relations that already exist
    if (updates.length > 0) {
      const subRecords = updates.map(record => record[key]);
      const conditionTree = ConditionTreeFactory.matchRecords(relation.schema, subRecords);

      await relation.update(caller, new Filter({ conditionTree }), patch);
    }
  }
}

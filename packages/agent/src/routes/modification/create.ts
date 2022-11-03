import {
  CollectionUtils,
  CompositeId,
  ConditionTreeFactory,
  ConditionTreeLeaf,
  Filter,
  ManyToOneSchema,
  RecordData,
  RecordValidator,
  RelationSchema,
  SchemaUtils,
} from '@forestadmin/datasource-toolkit';
import Router from '@koa/router';
import { Context } from 'koa';

import QueryStringParser from '../../utils/query-string';
import CollectionRoute from '../collection-route';

export default class CreateRoute extends CollectionRoute {
  setupRoutes(router: Router): void {
    router.post(`/${this.collection.name}`, this.handleCreate.bind(this));
  }

  public async handleCreate(context: Context) {
    await this.services.authorization.assertCanAdd(context, this.collection.name);

    const { serializer } = this.services;
    const rawRecord = serializer.deserialize(this.collection, context.request.body);

    const [record, relations] = await this.makeRecord(context, rawRecord);
    const newRecord = await this.createRecord(context, record);

    await this.linkOneToOneRelations(context, newRecord, relations);

    context.response.body = serializer.serialize(this.collection, { ...newRecord, ...relations });
  }

  private async makeRecord(
    context: Context,
    record: RecordData,
  ): Promise<[RecordData, Record<string, RecordData>]> {
    const patch: RecordData = {};
    const relations: Record<string, RecordData> = {};

    const promises = Object.entries(record).map(async ([field, value]) => {
      const schema = this.collection.schema.fields[field];

      if (schema?.type === 'OneToOne' || schema?.type === 'ManyToOne') {
        relations[field] = this.getRelationRecord(field, value as CompositeId);
      }

      if (schema?.type === 'ManyToOne') {
        patch[schema.foreignKey] = await this.getManyToOneTarget(
          context,
          field,
          value as CompositeId,
        );
      }

      if (schema?.type === 'Column') {
        patch[field] = value;
      }
    });

    await Promise.all(promises);

    return [patch, relations];
  }

  private async createRecord(context: Context, patch: RecordData): Promise<RecordData> {
    const caller = QueryStringParser.parseCaller(context);

    if (Object.keys(patch).length) {
      RecordValidator.validate(this.collection, patch);
    }

    const [record] = await this.collection.create(caller, [patch]);

    return record;
  }

  private async linkOneToOneRelations(
    context: Context,
    record: RecordData,
    relations: Record<string, RecordData>,
  ): Promise<void> {
    const caller = QueryStringParser.parseCaller(context);

    const promises = Object.entries(relations).map(async ([field, linked]) => {
      const relation = this.collection.schema.fields[field];
      if (linked === null || relation.type !== 'OneToOne') return;

      // Permissions
      const foreignCollection = this.dataSource.getCollection(relation.foreignCollection);
      const scope = await this.services.authorization.getScope(foreignCollection, context);
      await this.services.authorization.assertCanEdit(context, this.collection.name);

      // Load the value that will be used as originKey (=== parentId[0] most of the time)
      const originValue = record[relation.originKeyTarget];

      // Break old relation (may update zero or one records).
      const oldFkOwner = new ConditionTreeLeaf(relation.originKey, 'Equal', originValue);
      await foreignCollection.update(
        caller,
        new Filter({ conditionTree: ConditionTreeFactory.intersect(oldFkOwner, scope) }),
        { [relation.originKey]: null },
      );

      // Create new relation (will update exactly one record).
      const newFkOwner = ConditionTreeFactory.matchRecords(foreignCollection.schema, [linked]);
      await foreignCollection.update(
        caller,
        new Filter({ conditionTree: ConditionTreeFactory.intersect(newFkOwner, scope) }),
        { [relation.originKey]: originValue },
      );
    });

    await Promise.all(promises);
  }

  private getRelationRecord(field: string, id: CompositeId): RecordData {
    if (id === null) return null;

    const schema = this.collection.schema.fields[field] as RelationSchema;
    const foreignCollection = this.dataSource.getCollection(schema.foreignCollection);
    const pkName = SchemaUtils.getPrimaryKeys(foreignCollection.schema);

    return pkName.reduce((memo, key, index) => ({ ...memo, [key]: id[index] }), {});
  }

  private async getManyToOneTarget(
    context: Context,
    field: string,
    id: CompositeId,
  ): Promise<unknown> {
    if (id === null) return null;

    const caller = QueryStringParser.parseCaller(context);
    const schema = this.collection.schema.fields[field] as ManyToOneSchema;
    const foreignCollection = this.dataSource.getCollection(schema.foreignCollection);

    return CollectionUtils.getValue(foreignCollection, caller, id, schema.foreignKeyTarget);
  }
}

import {
  CollectionUtils,
  CompositeId,
  ConditionTreeFactory,
  ConditionTreeLeaf,
  FieldTypes,
  Filter,
  ManyToOneSchema,
  Operator,
  RecordData,
  RecordValidator,
  RelationSchema,
  SchemaUtils,
} from '@forestadmin/datasource-toolkit';
import { Context } from 'koa';
import Router from '@koa/router';

import CollectionRoute from '../collection-route';
import QueryStringParser from '../../utils/query-string';

export default class CreateRoute extends CollectionRoute {
  setupRoutes(router: Router): void {
    router.post(`/${this.collection.name}`, this.handleCreate.bind(this));
  }

  public async handleCreate(context: Context) {
    await this.services.permissions.can(context, `add:${this.collection.name}`);

    const { serializer } = this.services;
    const rawRecord = serializer.deserialize(this.collection, context.request.body);

    const [record, relations] = await this.makeRecord(rawRecord);
    const newRecord = await this.createRecord(record);

    await this.linkOneToOneRelations(context, record, relations);

    context.response.body = serializer.serialize(this.collection, { ...newRecord, ...relations });
  }

  private async makeRecord(record: RecordData): Promise<[RecordData, Record<string, RecordData>]> {
    const patch: RecordData = {};
    const relations: Record<string, RecordData> = {};

    const promises = Object.entries(record).map(async ([field, value]) => {
      const schema = this.collection.schema.fields[field];

      if (schema?.type === FieldTypes.OneToOne || schema?.type === FieldTypes.ManyToOne) {
        relations[field] = this.getRelationRecord(field, value as CompositeId);
      }

      if (schema?.type === FieldTypes.ManyToOne) {
        patch[schema.foreignKey] = await this.getManyToOneTarget(field, value as CompositeId);
      }

      if (schema?.type === FieldTypes.Column) {
        patch[field] = value;
      }
    });

    await Promise.all(promises);

    return [patch, relations];
  }

  private async createRecord(patch: RecordData): Promise<RecordData> {
    if (Object.keys(patch).length) {
      RecordValidator.validate(this.collection, patch);
    }

    const [record] = await this.collection.create([patch]);

    return record;
  }

  private async linkOneToOneRelations(
    context: Context,
    record: RecordData,
    relations: Record<string, RecordData>,
  ): Promise<void> {
    const timezone = QueryStringParser.parseTimezone(context);

    const promises = Object.entries(relations).map(async ([field, linked]) => {
      const relation = this.collection.schema.fields[field];
      if (relation.type !== FieldTypes.OneToOne) return;

      // Permissions
      const foreignCollection = this.dataSource.getCollection(relation.foreignCollection);
      const scope = await this.services.permissions.getScope(foreignCollection, context);
      await this.services.permissions.can(context, `edit:${foreignCollection.name}`);

      // Load the value that will be used as originKey (=== parentId[0] most of the time)
      const originValue = record[relation.originKeyTarget];

      // Break old relation (may update zero or one records).
      const oldFkOwner = new ConditionTreeLeaf(relation.originKey, Operator.Equal, originValue);
      await foreignCollection.update(
        new Filter({ conditionTree: ConditionTreeFactory.intersect(oldFkOwner, scope), timezone }),
        { [relation.originKey]: null },
      );

      // Create new relation (will update exactly one record).
      const newFkOwner = ConditionTreeFactory.matchRecords(foreignCollection.schema, [linked]);
      await foreignCollection.update(
        new Filter({ conditionTree: ConditionTreeFactory.intersect(newFkOwner, scope), timezone }),
        { [relation.originKey]: originValue },
      );
    });

    await Promise.all(promises);
  }

  getRelationRecord(field: string, id: CompositeId): RecordData {
    const schema = this.collection.schema.fields[field] as RelationSchema;
    const foreignCollection = this.dataSource.getCollection(schema.foreignCollection);
    const pkName = SchemaUtils.getPrimaryKeys(foreignCollection.schema);

    return pkName.reduce((memo, key, index) => ({ ...memo, [key]: id[index] }), {});
  }

  async getManyToOneTarget(field: string, id: CompositeId): Promise<unknown> {
    const schema = this.collection.schema.fields[field] as ManyToOneSchema;
    const foreignCollection = this.dataSource.getCollection(schema.foreignCollection);

    return CollectionUtils.getValue(foreignCollection, id, schema.foreignKeyTarget);
  }
}

import type {
  CompositeId,
  ManyToOneSchema,
  OneToOneSchema,
  RecordData,
} from '@forestadmin/datasource-toolkit';
import type Router from '@koa/router';
import type { Context } from 'koa';

import {
  CollectionUtils,
  ConditionTreeFactory,
  ConditionTreeLeaf,
  Filter,
  RecordValidator,
  SchemaUtils,
} from '@forestadmin/datasource-toolkit';

import QueryStringParser from '../../utils/query-string';
import CollectionRoute from '../collection-route';

export default class CreateRoute extends CollectionRoute {
  setupRoutes(router: Router): void {
    router.post(`/${this.collectionUrlSlug}`, this.handleCreate.bind(this));
  }

  public async handleCreate(context: Context) {
    await this.services.authorization.assertCanAdd(context, this.collection.name);

    const { serializer } = this.services;
    const rawRecord = serializer.deserialize(this.collection, context.request.body);

    const [record, relations] = await this.makeRecord(context, rawRecord);

    await this.assertCanEditLinkedOneToOneRelations(context, relations);

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
      const schema = SchemaUtils.getField(this.collection.schema, field, this.collection.name);

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

  private getLinkedOneToOneRelations(
    relations: Record<string, RecordData>,
  ): Array<{ linked: RecordData; relation: OneToOneSchema }> {
    return Object.entries(relations)
      .map(([field, linked]) => ({
        linked,
        relation: SchemaUtils.getRelation(this.collection.schema, field, this.collection.name),
      }))
      .filter(
        (entry): entry is { linked: RecordData; relation: OneToOneSchema } =>
          entry.linked !== null && entry.relation.type === 'OneToOne',
      );
  }

  private async assertCanEditLinkedOneToOneRelations(
    context: Context,
    relations: Record<string, RecordData>,
  ): Promise<void> {
    await Promise.all(
      this.getLinkedOneToOneRelations(relations).map(({ relation }) =>
        this.services.authorization.assertCanEdit(context, relation.foreignCollection),
      ),
    );
  }

  private async linkOneToOneRelations(
    context: Context,
    record: RecordData,
    relations: Record<string, RecordData>,
  ): Promise<void> {
    const caller = QueryStringParser.parseCaller(context);

    const promises = this.getLinkedOneToOneRelations(relations).map(
      async ({ linked, relation }) => {
        const foreignCollection = this.dataSource.getCollection(relation.foreignCollection);
        const scope = await this.services.authorization.getScope(foreignCollection, context);

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
      },
    );

    await Promise.all(promises);
  }

  private getRelationRecord(field: string, id: CompositeId): RecordData {
    if (id === null) return null;

    const schema = SchemaUtils.getRelation(this.collection.schema, field, this.collection.name);
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
    const schema = SchemaUtils.getRelation(
      this.collection.schema,
      field,
      this.collection.name,
    ) as ManyToOneSchema;
    const foreignCollection = this.dataSource.getCollection(schema.foreignCollection);

    return CollectionUtils.getValue(foreignCollection, caller, id, schema.foreignKeyTarget);
  }
}

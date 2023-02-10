import {
  Caller,
  CollectionUtils,
  CompositeId,
  ConditionTree,
  ConditionTreeLeaf,
  ManyToManySchema,
  OneToManySchema,
  SchemaUtils,
} from '@forestadmin/datasource-toolkit';
import Router from '@koa/router';
import { Context } from 'koa';

import { HttpCode } from '../../types';
import IdUtils from '../../utils/id';
import CallerParser from '../../utils/query-parser/caller';
import FilterParser from '../../utils/query-parser/filter';
import RelationRoute from '../relation-route';

export default class AssociateRelatedRoute extends RelationRoute {
  setupRoutes(router: Router): void {
    router.post(
      `/${this.collection.name}/:parentId/relationships/${this.relationName}`,
      this.handleAssociateRelatedRoute.bind(this),
    );
  }

  public async handleAssociateRelatedRoute(context: Context): Promise<void> {
    await this.services.authorization.assertCanEdit(context, this.collection.name);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = context.request.body as any;
    const parentId = IdUtils.unpackId(this.collection.schema, context.params.parentId);
    const targetedRelationId = IdUtils.unpackId(this.foreignCollection.schema, body?.data[0].id);
    const scope = await this.services.authorization.getScope(this.foreignCollection, context);
    const relation = SchemaUtils.getToManyRelation(this.collection.schema, this.relationName);
    const caller = CallerParser.fromCtx(context);

    if (relation.type === 'OneToMany') {
      await this.associateOneToMany(caller, scope, relation, parentId, targetedRelationId, context);
    } else {
      await this.associateManyToMany(caller, relation, parentId, targetedRelationId);
    }

    context.response.status = HttpCode.NoContent;
  }

  async associateOneToMany(
    caller: Caller,
    scope: ConditionTree,
    relation: OneToManySchema,
    parentId: CompositeId,
    targetedRelationId: CompositeId,
    context: Context,
  ) {
    const [id] = SchemaUtils.getPrimaryKeys(this.foreignCollection.schema);
    let value = await CollectionUtils.getValue(
      this.foreignCollection,
      caller,
      targetedRelationId,
      id,
    );
    const filter = FilterParser.multiple(this.collection, context)
      .intersectWith(scope)
      .intersectWith(new ConditionTreeLeaf(id, 'Equal', value));

    value = await CollectionUtils.getValue(
      this.collection,
      caller,
      parentId,
      relation.originKeyTarget,
    );
    await this.foreignCollection.update(caller, filter, { [relation.originKey]: value });
  }

  async associateManyToMany(
    caller: Caller,
    relation: ManyToManySchema,
    parentId: CompositeId,
    targetedRelationId: CompositeId,
  ) {
    let [id] = SchemaUtils.getPrimaryKeys(this.foreignCollection.schema);
    const foreign = await CollectionUtils.getValue(
      this.foreignCollection,
      caller,
      targetedRelationId,
      id,
    );
    [id] = SchemaUtils.getPrimaryKeys(this.collection.schema);
    const origin = await CollectionUtils.getValue(this.collection, caller, parentId, id);
    const record = { [relation.originKey]: origin, [relation.foreignKey]: foreign };

    const throughCollection = this.dataSource.getCollection(relation.throughCollection);
    await throughCollection.create(caller, [record]);
  }
}

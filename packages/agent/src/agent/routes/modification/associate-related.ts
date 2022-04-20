import {
  CollectionUtils,
  CompositeId,
  ConditionTree,
  ConditionTreeFactory,
  ConditionTreeLeaf,
  ManyToManySchema,
  OneToManySchema,
  QueryRecipient,
  SchemaUtils,
} from '@forestadmin/datasource-toolkit';
import { Context } from 'koa';
import Router from '@koa/router';

import { HttpCode } from '../../types';
import ContextFilterFactory from '../../utils/context-filter-factory';
import IdUtils from '../../utils/id';
import QueryStringParser from '../../utils/query-string';
import RelationRoute from '../relation-route';

export default class AssociateRelatedRoute extends RelationRoute {
  setupRoutes(router: Router): void {
    router.post(
      `/${this.collection.name}/:parentId/relationships/${this.relationName}`,
      this.handleAssociateRelatedRoute.bind(this),
    );
  }

  public async handleAssociateRelatedRoute(context: Context): Promise<void> {
    await this.services.permissions.can(context, `edit:${this.collection.name}`);
    const parentId = IdUtils.unpackId(this.collection.schema, context.params.parentId);
    const targetedRelationId = IdUtils.unpackId(
      this.foreignCollection.schema,
      context.request.body?.data[0].id,
    );
    const scope = await this.services.permissions.getScope(this.foreignCollection, context);
    const relation = SchemaUtils.getToManyRelation(this.collection.schema, this.relationName);
    const recipient = QueryStringParser.parseRecipient(context);

    if (relation.type === 'OneToMany') {
      await this.associateOneToMany(
        recipient,
        scope,
        relation,
        parentId,
        targetedRelationId,
        context,
      );
    } else {
      await this.associateManyToMany(recipient, relation, parentId, targetedRelationId);
    }

    context.response.status = HttpCode.NoContent;
  }

  async associateOneToMany(
    recipient: QueryRecipient,
    scope: ConditionTree,
    relation: OneToManySchema,
    parentId: CompositeId,
    targetedRelationId: CompositeId,
    context: Context,
  ) {
    const [id] = SchemaUtils.getPrimaryKeys(this.foreignCollection.schema);
    let value = await CollectionUtils.getValue(
      this.foreignCollection,
      recipient,
      targetedRelationId,
      id,
    );
    const filter = ContextFilterFactory.build(this.collection, context, scope, {
      conditionTree: ConditionTreeFactory.intersect(
        new ConditionTreeLeaf(id, 'Equal', value),
        scope,
      ),
    });
    value = await CollectionUtils.getValue(
      this.collection,
      recipient,
      parentId,
      relation.originKeyTarget,
    );
    await this.foreignCollection.update(recipient, filter, { [relation.originKey]: value });
  }

  async associateManyToMany(
    recipient: QueryRecipient,
    relation: ManyToManySchema,
    parentId: CompositeId,
    targetedRelationId: CompositeId,
  ) {
    let [id] = SchemaUtils.getPrimaryKeys(this.foreignCollection.schema);
    const foreign = await CollectionUtils.getValue(
      this.foreignCollection,
      recipient,
      targetedRelationId,
      id,
    );
    [id] = SchemaUtils.getPrimaryKeys(this.collection.schema);
    const origin = await CollectionUtils.getValue(this.collection, recipient, parentId, id);
    const record = { [relation.originKey]: origin, [relation.foreignKey]: foreign };

    const throughCollection = this.dataSource.getCollection(relation.throughCollection);
    await throughCollection.create(recipient, [record]);
  }
}

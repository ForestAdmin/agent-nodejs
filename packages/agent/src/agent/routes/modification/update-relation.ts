import {
  CollectionUtils,
  CompositeId,
  ConditionTreeFactory,
  ConditionTreeLeaf,
  Filter,
  ManyToOneSchema,
  OneToOneSchema,
  QueryRecipient,
} from '@forestadmin/datasource-toolkit';
import { Context } from 'koa';
import Router from '@koa/router';

import { HttpCode } from '../../types';
import IdUtils from '../../utils/id';
import QueryStringParser from '../../utils/query-string';
import RelationRoute from '../relation-route';

export default class UpdateRelation extends RelationRoute {
  setupRoutes(router: Router): void {
    router.put(
      `/${this.collection.name}/:parentId/relationships/${this.relationName}`,
      this.handleUpdateRelationRoute.bind(this),
    );
  }

  public async handleUpdateRelationRoute(context: Context): Promise<void> {
    const relation = this.collection.schema.fields[this.relationName];
    const recipient = QueryStringParser.parseRecipient(context);
    const parentId = IdUtils.unpackId(this.collection.schema, context.params.parentId);
    const linkedId = IdUtils.unpackId(this.foreignCollection.schema, context.request.body?.data.id);

    if (relation.type === 'ManyToOne') {
      await this.updateManyToOne(context, relation, parentId, linkedId, recipient);
    } else if (relation.type === 'OneToOne') {
      await this.updateOneToOne(context, relation, parentId, linkedId, recipient);
    }

    context.response.status = HttpCode.NoContent;
  }

  private async updateManyToOne(
    context: Context,
    relation: ManyToOneSchema,
    parentId: CompositeId,
    linkedId: CompositeId,
    recipient: QueryRecipient,
  ): Promise<void> {
    // Perms
    const scope = await this.services.permissions.getScope(this.collection, context);
    await this.services.permissions.can(context, `edit:${this.collection.name}`);

    // Load the value that will be used as foreignKey (=== linkedId[0] most of the time)
    const foreignValue = await CollectionUtils.getValue(
      this.foreignCollection,
      recipient,
      linkedId,
      relation.foreignKeyTarget,
    );

    // Overwrite old foreign key with new one (only one query needed).
    const fkOwner = ConditionTreeFactory.matchIds(this.collection.schema, [parentId]);

    await this.collection.update(
      recipient,
      new Filter({ conditionTree: ConditionTreeFactory.intersect(fkOwner, scope) }),
      { [relation.foreignKey]: foreignValue },
    );
  }

  private async updateOneToOne(
    context: Context,
    relation: OneToOneSchema,
    parentId: CompositeId,
    linkedId: CompositeId,
    recipient: QueryRecipient,
  ): Promise<void> {
    // Permissions
    const scope = await this.services.permissions.getScope(this.foreignCollection, context);
    await this.services.permissions.can(context, `edit:${this.foreignCollection.name}`);

    // Load the value that will be used as originKey (=== parentId[0] most of the time)
    const originValue = await CollectionUtils.getValue(
      this.collection,
      recipient,
      parentId,
      relation.originKeyTarget,
    );

    // Break old relation (may update zero or one records).
    const oldFkOwner = new ConditionTreeLeaf(relation.originKey, 'Equal', originValue);
    await this.foreignCollection.update(
      recipient,
      new Filter({ conditionTree: ConditionTreeFactory.intersect(oldFkOwner, scope) }),
      { [relation.originKey]: null },
    );

    // Create new relation (will update exactly one record).
    const newFkOwner = ConditionTreeFactory.matchIds(this.foreignCollection.schema, [linkedId]);
    await this.foreignCollection.update(
      recipient,
      new Filter({ conditionTree: ConditionTreeFactory.intersect(newFkOwner, scope) }),
      { [relation.originKey]: originValue },
    );
  }
}

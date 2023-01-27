import {
  Caller,
  CollectionUtils,
  CompositeId,
  ConditionTreeFactory,
  ConditionTreeLeaf,
  Filter,
  ManyToOneSchema,
  OneToOneSchema,
} from '@forestadmin/datasource-toolkit';
import Router from '@koa/router';
import { Context } from 'koa';

import { HttpCode } from '../../types';
import IdUtils from '../../utils/id';
import CallerParser from '../../utils/query-parser/caller';
import RelationRoute from '../relation-route';

export default class UpdateRelation extends RelationRoute {
  setupRoutes(router: Router): void {
    router.put(
      `/${this.collection.name}/:parentId/relationships/${this.relationName}`,
      this.handleUpdateRelationRoute.bind(this),
    );
  }

  public async handleUpdateRelationRoute(context: Context): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = context.request.body as any;
    const relation = this.collection.schema.fields[this.relationName];
    const caller = CallerParser.fromCtx(context);
    const parentId = IdUtils.unpackId(this.collection.schema, context.params.parentId);

    const linkedId = body?.data?.id
      ? IdUtils.unpackId(this.foreignCollection.schema, body.data.id)
      : null;

    if (relation.type === 'ManyToOne') {
      await this.updateManyToOne(context, relation, parentId, linkedId, caller);
    } else if (relation.type === 'OneToOne') {
      await this.updateOneToOne(context, relation, parentId, linkedId, caller);
    }

    context.response.status = HttpCode.NoContent;
  }

  private async updateManyToOne(
    context: Context,
    relation: ManyToOneSchema,
    parentId: CompositeId,
    linkedId: CompositeId,
    caller: Caller,
  ): Promise<void> {
    // Perms
    const scope = await this.services.authorization.getScope(this.collection, context);
    await this.services.authorization.assertCanEdit(context, this.collection.name);

    // Load the value that will be used as foreignKey (=== linkedId[0] most of the time)
    const foreignValue = linkedId
      ? await CollectionUtils.getValue(
          this.foreignCollection,
          caller,
          linkedId,
          relation.foreignKeyTarget,
        )
      : null;

    // Overwrite old foreign key with new one (only one query needed).
    const fkOwner = ConditionTreeFactory.matchIds(this.collection.schema, [parentId]);

    await this.collection.update(
      caller,
      new Filter({ conditionTree: ConditionTreeFactory.intersect(fkOwner, scope) }),
      { [relation.foreignKey]: foreignValue },
    );
  }

  private async updateOneToOne(
    context: Context,
    relation: OneToOneSchema,
    parentId: CompositeId,
    linkedId: CompositeId,
    caller: Caller,
  ): Promise<void> {
    // Permissions
    const scope = await this.services.authorization.getScope(this.foreignCollection, context);
    await this.services.authorization.assertCanEdit(context, this.foreignCollection.name);

    // Load the value that will be used as originKey (=== parentId[0] most of the time)
    const originValue = await CollectionUtils.getValue(
      this.collection,
      caller,
      parentId,
      relation.originKeyTarget,
    );

    // Break old relation (may update zero or one records).
    const oldFkOwner = new ConditionTreeLeaf(relation.originKey, 'Equal', originValue);
    await this.foreignCollection.update(
      caller,
      new Filter({ conditionTree: ConditionTreeFactory.intersect(oldFkOwner, scope) }),
      { [relation.originKey]: null },
    );

    // Create new relation (will update exactly one record).
    if (linkedId) {
      const newFkOwner = ConditionTreeFactory.matchIds(this.foreignCollection.schema, [linkedId]);
      await this.foreignCollection.update(
        caller,
        new Filter({ conditionTree: ConditionTreeFactory.intersect(newFkOwner, scope) }),
        { [relation.originKey]: originValue },
      );
    }
  }
}

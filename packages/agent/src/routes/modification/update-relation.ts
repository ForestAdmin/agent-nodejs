import type {
  Caller,
  CompositeId,
  ConditionTree,
  ManyToOneSchema,
  OneToOneSchema,
} from '@forestadmin/datasource-toolkit';
import type Router from '@koa/router';
import type { Context } from 'koa';

import {
  Aggregation,
  CollectionUtils,
  ConditionTreeFactory,
  ConditionTreeLeaf,
  Filter,
  SchemaUtils,
} from '@forestadmin/datasource-toolkit';

import { HttpCode } from '../../types';
import IdUtils from '../../utils/id';
import QueryStringParser from '../../utils/query-string';
import RelationRoute from '../relation-route';

export default class UpdateRelation extends RelationRoute {
  setupRoutes(router: Router): void {
    router.put(
      `/${this.collectionUrlSlug}/:parentId/relationships/${this.relationUrlSlug}`,
      this.handleUpdateRelationRoute.bind(this),
    );
  }

  public async handleUpdateRelationRoute(context: Context): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = context.request.body as any;
    const relation = SchemaUtils.getRelation(
      this.collection.schema,
      this.relationName,
      this.collection.name,
    );
    const caller = QueryStringParser.parseCaller(context);
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

    await this.breakOldOneToOneRelationship(scope, relation, originValue, linkedId, caller);

    await this.createNewOneToOneRelationship(scope, relation, originValue, linkedId, caller);
  }

  /**
   * Create new relation (will update exactly one record).
   */
  private async createNewOneToOneRelationship(
    scope: ConditionTree,
    relation: OneToOneSchema,
    originValue: unknown,
    linkedId: CompositeId,
    caller: Caller,
  ) {
    if (linkedId) {
      const newFkOwner = ConditionTreeFactory.matchIds(this.foreignCollection.schema, [linkedId]);
      await this.foreignCollection.update(
        caller,
        new Filter({ conditionTree: ConditionTreeFactory.intersect(newFkOwner, scope) }),
        { [relation.originKey]: originValue },
      );
    }
  }

  /**
   * Break old relation (may update zero or one records).
   */
  async breakOldOneToOneRelationship(
    scope: ConditionTree,
    relation: OneToOneSchema,
    originValue: unknown,
    linkedId: CompositeId,
    caller: Caller,
  ): Promise<void> {
    const oldFkOwnerToRemoveFilter = new Filter({
      conditionTree: ConditionTreeFactory.intersect(
        new ConditionTreeLeaf(relation.originKey, 'Equal', originValue),
        // Don't set the new record's field to null
        // if it's already initialized with the right value
        ...(linkedId
          ? [ConditionTreeFactory.matchIds(this.foreignCollection.schema, [linkedId]).inverse()]
          : []),
        scope,
      ),
    });

    const [count] = await this.foreignCollection.aggregate(
      caller,
      oldFkOwnerToRemoveFilter,
      new Aggregation({ operation: 'Count' }),
      1,
    );

    if ((count.value as number) > 0) {
      // Avoids updating records to null if it's not authorized by the ORM
      // and if there is no record to update (the filter returns no record)
      await this.foreignCollection.update(caller, oldFkOwnerToRemoveFilter, {
        [relation.originKey]: null,
      });
    }
  }
}

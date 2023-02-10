import {
  Caller,
  CompositeId,
  Filter,
  FilterFactory,
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

export default class DissociateDeleteRelatedRoute extends RelationRoute {
  setupRoutes(router: Router): void {
    router.delete(
      `/${this.collection.name}/:parentId/relationships/${this.relationName}`,
      this.handleDissociateDeleteRelatedRoute.bind(this),
    );
  }

  public async handleDissociateDeleteRelatedRoute(context: Context): Promise<void> {
    await this.services.authorization.assertCanDelete(context, this.collection.name);

    // Parse route params
    const parentId = IdUtils.unpackId(this.collection.schema, context.params.parentId);
    const isDeleteMode = Boolean(context.request.query?.delete);
    const scope = await this.services.authorization.getScope(this.foreignCollection, context);
    const caller = CallerParser.fromCtx(context);
    const filter = FilterParser.multiple(this.foreignCollection, context).intersectWith(scope);

    // Dissociating a one to many or many many is quite a different job => delegate
    const relation = SchemaUtils.getToManyRelation(this.collection.schema, this.relationName);

    if (relation.type === 'OneToMany') {
      await this.dissociateOrDeleteOneToMany(caller, relation, parentId, isDeleteMode, filter);
    } else {
      await this.dissociateOrDeleteManyToMany(caller, relation, parentId, isDeleteMode, filter);
    }

    context.response.status = HttpCode.NoContent;
  }

  private async dissociateOrDeleteOneToMany(
    caller: Caller,
    schema: OneToManySchema,
    parentId: CompositeId,
    isDeleteMode: boolean,
    baseTargetFilter: Filter,
  ): Promise<void> {
    // Restrict baseTargetFilter to match only records under the parent record
    const foreignFilter = await this.makeForeignFilter(caller, parentId, baseTargetFilter);

    if (isDeleteMode) {
      await this.foreignCollection.delete(caller, foreignFilter);
    } else {
      await this.foreignCollection.update(caller, foreignFilter, { [schema.originKey]: null });
    }
  }

  private async dissociateOrDeleteManyToMany(
    caller: Caller,
    schema: ManyToManySchema,
    parentId: CompositeId,
    isDeleteMode: boolean,
    baseTargetFilter: Filter,
  ): Promise<void> {
    const throughCollection = this.collection.dataSource.getCollection(schema.throughCollection);

    if (isDeleteMode) {
      // Generate filters _BEFORE_ deleting stuff, otherwise things break.
      const throughFilter = await this.makeThroughFilter(caller, parentId, baseTargetFilter);
      const foreignFilter = await this.makeForeignFilter(caller, parentId, baseTargetFilter);

      // Delete records from through collection
      await throughCollection.delete(caller, throughFilter);

      // Let the datasource crash when:
      // - the records in the foreignCollection are linked to other records in the origin collection
      // - the underlying database/api is not cascading deletes
      await this.foreignCollection.delete(caller, foreignFilter);
    } else {
      // Only delete records from through collection
      const thoughFilter = await this.makeThroughFilter(caller, parentId, baseTargetFilter);
      await throughCollection.delete(caller, thoughFilter);
    }
  }

  /** Wrapper around the util to simplify the call */
  private makeForeignFilter(
    caller: Caller,
    parentId: CompositeId,
    baseForeignFilter: Filter,
  ): Promise<Filter> {
    return FilterFactory.makeForeignFilter(
      this.collection,
      parentId,
      this.relationName,
      caller,
      baseForeignFilter,
    );
  }

  /** Wrapper around the util to simplify the call */
  private makeThroughFilter(
    caller: Caller,
    parentId: CompositeId,
    baseForeignFilter: Filter,
  ): Promise<Filter> {
    return FilterFactory.makeThroughFilter(
      this.collection,
      parentId,
      this.relationName,
      caller,
      baseForeignFilter,
    );
  }
}

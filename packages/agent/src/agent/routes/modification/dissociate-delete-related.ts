import {
  Caller,
  CompositeId,
  ConditionTreeFactory,
  Filter,
  FilterFactory,
  ManyToManySchema,
  OneToManySchema,
  SchemaUtils,
  ValidationError,
} from '@forestadmin/datasource-toolkit';
import { Context } from 'koa';
import Router from '@koa/router';

import { CollectionActionEvent } from '../../services/authorization';
import { HttpCode } from '../../types';
import BodyParser from '../../utils/body-parser';
import ContextFilterFactory from '../../utils/context-filter-factory';
import IdUtils from '../../utils/id';
import QueryStringParser from '../../utils/query-string';
import RelationRoute from '../relation-route';

export default class DissociateDeleteRelatedRoute extends RelationRoute {
  setupRoutes(router: Router): void {
    router.delete(
      `/${this.collection.name}/:parentId/relationships/${this.relationName}`,
      this.handleDissociateDeleteRelatedRoute.bind(this),
    );
  }

  public async handleDissociateDeleteRelatedRoute(context: Context): Promise<void> {
    await this.services.authorization.assertCanOnCollection(
      context,
      CollectionActionEvent.Delete,
      this.collection.name,
    );

    // Parse route params
    const parentId = IdUtils.unpackId(this.collection.schema, context.params.parentId);
    const isDeleteMode = Boolean(context.request.query?.delete);
    const caller = QueryStringParser.parseCaller(context);
    const filter = await this.getBaseForeignFilter(context);

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

  /**
   * Match selected records in the related data panel.
   * The filter that is generated by this condition it _not_ restricted by the parent record
   */
  private async getBaseForeignFilter(context: Context): Promise<Filter> {
    const selectionIds = BodyParser.parseSelectionIds(this.foreignCollection.schema, context);
    let selectedIds = ConditionTreeFactory.matchIds(
      this.foreignCollection.schema,
      selectionIds.ids,
    );
    if (selectionIds.areExcluded) selectedIds = selectedIds.inverse();

    if (selectionIds.ids.length === 0 && !selectionIds.areExcluded) {
      throw new ValidationError('Expected no empty id list');
    }

    return ContextFilterFactory.build(this.foreignCollection, context, null, {
      conditionTree: ConditionTreeFactory.intersect(
        await this.services.permissions.getScope(this.foreignCollection, context),
        QueryStringParser.parseConditionTree(this.foreignCollection, context),
        selectedIds,
      ),
    });
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

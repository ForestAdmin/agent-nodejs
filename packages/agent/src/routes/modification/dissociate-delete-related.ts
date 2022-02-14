import {
  Aggregator,
  Collection,
  CollectionUtils,
  CompositeId,
  ConditionTree,
  ConditionTreeBranch,
  ConditionTreeFactory,
  ConditionTreeLeaf,
  FieldTypes,
  Filter,
  ManyToManySchema,
  OneToManySchema,
  Operator,
  ValidationError,
} from '@forestadmin/datasource-toolkit';
import { Context } from 'koa';
import Router from '@koa/router';
import SchemaUtils from '@forestadmin/datasource-toolkit/dist/src/utils/schema';

import { AllRecordsMode } from '../../utils/forest-http-api';
import { HttpCode } from '../../types';
import Data from '../../utils/data';
import IdUtils from '../../utils/id';
import QueryStringParser from '../../utils/query-string';
import RelationRoute from '../relation-route';

export default class DissociateDeleteRelatedRoute extends RelationRoute {
  override setupPrivateRoutes(router: Router): void {
    router.delete(
      `/${this.collection.name}/:parentId/relationships/${this.relationName}`,

      this.handleDissociateDeleteRelatedRoute.bind(this),
    );
  }

  public async handleDissociateDeleteRelatedRoute(context: Context): Promise<void> {
    return this.handleDissociateRelatedRoute(context);
  }

  private async handleDissociateRelatedRoute(context: Context): Promise<void> {
    const data = context.request.body?.data;
    const allRecordsMode = Data.parseAllRecordsMode(context);

    const parentId = IdUtils.unpackId(this.collection.schema, context.params.parentId);
    const ids = IdUtils.unpackIds(
      this.foreignCollection.schema,
      allRecordsMode.isActivated ? allRecordsMode.excludedIds : data.map(r => r.id),
    );

    if (ids.length === 0 && !allRecordsMode.isActivated) {
      throw new ValidationError('Expected no empty id list');
    }

    const filter = new Filter({
      conditionTree: ConditionTreeFactory.intersect(
        QueryStringParser.parseConditionTree(this.foreignCollection, context),
        await this.services.scope.getConditionTree(this.foreignCollection, context),
      ),
      segment: QueryStringParser.parseSegment(this.foreignCollection, context),
      timezone: QueryStringParser.parseTimezone(context),
    });

    const schemaRelation = CollectionUtils.getRelationOrThrowError(
      this.collection,
      this.relationName,
    );
    await this.dissociateTheRelations(schemaRelation, ids, parentId, filter, allRecordsMode);
    context.response.status = HttpCode.NoContent;
  }

  private async dissociateTheRelations(
    schemaRelation: ManyToManySchema | OneToManySchema,
    ids: CompositeId[],
    parentId: CompositeId,
    filter: Filter,
    allRecordsMode: AllRecordsMode,
  ) {
    if (schemaRelation.type === FieldTypes.ManyToMany) {
      return this.dissociateManyToManyRelations(
        schemaRelation,
        filter,
        ids,
        allRecordsMode,
        parentId,
      );
    }

    return this.dissociateManyToOneRelations(ids, filter, allRecordsMode, schemaRelation, parentId);
  }

  private dissociateManyToManyRelations(
    schemaRelation: ManyToManySchema,
    filter: Filter,
    ids: CompositeId[],
    allRecordsMode: AllRecordsMode,
    parentId: CompositeId,
  ): Promise<void> {
    const manyToManyCollection = this.collection.dataSource.getCollection(
      schemaRelation.throughCollection,
    );

    const conditionTree = ConditionTreeFactory.intersect(
      filter.conditionTree?.nest(schemaRelation.targetRelation),
      DissociateDeleteRelatedRoute.generateConditionsToMatchRecords(
        ids,
        allRecordsMode,
        manyToManyCollection,
        schemaRelation,
        parentId,
      ),
    );

    return manyToManyCollection.delete(filter.override({ conditionTree }));
  }

  private dissociateManyToOneRelations(
    ids: CompositeId[],
    filter: Filter,
    allRecordsMode: AllRecordsMode,
    schemaRelation: OneToManySchema,
    parentId: CompositeId,
  ): Promise<void> {
    const condition = ConditionTreeFactory.matchIds(this.foreignCollection.schema, ids);

    const conditionTree = ConditionTreeFactory.intersect(
      filter.conditionTree,
      allRecordsMode.isActivated ? condition.inverse() : condition,
      new ConditionTreeLeaf(schemaRelation.foreignKey, Operator.Equal, parentId[0]),
    );

    return this.foreignCollection.update(filter.override({ conditionTree }), {
      [schemaRelation.foreignKey]: null,
    });
  }

  private static generateConditionsToMatchRecords(
    ids: CompositeId[],
    allRecordsMode: AllRecordsMode,
    manyToManyCollection: Collection,
    schemaRelation: ManyToManySchema,
    parentId: CompositeId,
  ): ConditionTree {
    const originRelation = manyToManyCollection.schema.fields[
      schemaRelation.originRelation
    ] as OneToManySchema;

    if (ids.length === 0 && allRecordsMode.isActivated) {
      return new ConditionTreeLeaf(originRelation.foreignKey, Operator.Equal, parentId[0]);
    }

    const inCondition = new ConditionTreeLeaf(
      SchemaUtils.getForeignKeyName(manyToManyCollection.schema, schemaRelation.targetRelation),
      Operator.In,
      ids.flat(),
    );

    return new ConditionTreeBranch(Aggregator.And, [
      new ConditionTreeLeaf(
        SchemaUtils.getForeignKeyName(manyToManyCollection.schema, schemaRelation.originRelation),
        Operator.Equal,
        parentId[0],
      ),
      allRecordsMode.isActivated ? inCondition.inverse() : inCondition,
    ]);
  }
}

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
  PaginatedFilter,
  Projection,
  RecordData,
  SchemaUtils,
  ValidationError,
} from '@forestadmin/datasource-toolkit';
import { Context } from 'koa';
import Router from '@koa/router';

import { AllRecordsMode } from '../../utils/forest-http-api';
import { HttpCode } from '../../types';
import BodyString from '../../utils/body-string';
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
    const data = context.request.body?.data;
    const isDeleteMode = Boolean(context.request.query?.delete);
    const allRecordsMode = BodyString.parseAllRecordsMode(context);

    const parentId = IdUtils.unpackId(this.collection.schema, context.params.parentId);
    const ids = IdUtils.unpackIds(
      this.foreignCollection.schema,
      allRecordsMode.isActivated ? allRecordsMode.excludedIds : data.map(r => r.id),
    );

    if (ids.length === 0 && !allRecordsMode.isActivated) {
      throw new ValidationError('Expected no empty id list');
    }

    const filter = new PaginatedFilter({
      conditionTree: ConditionTreeFactory.intersect(
        QueryStringParser.parseConditionTree(this.foreignCollection, context),
        await this.services.permissions.getScope(this.foreignCollection, context),
      ),
      segment: QueryStringParser.parseSegment(this.foreignCollection, context),
      timezone: QueryStringParser.parseTimezone(context),
      page: QueryStringParser.parsePagination(context),
      sort: QueryStringParser.parseSort(this.foreignCollection, context),
    });

    await this.dissociateOrDeleteData(filter, ids, allRecordsMode, isDeleteMode, parentId);
    context.response.status = HttpCode.NoContent;
  }

  private async dissociateOrDeleteData(
    filter: PaginatedFilter,
    ids: CompositeId[],
    allRecordsMode: AllRecordsMode,
    isDeleteMode: boolean,
    parentId: CompositeId,
  ): Promise<void> {
    // throw error if it is not a many to many or a one to many relation
    const schema = CollectionUtils.getRelationOrThrowError(this.collection, this.relationName);

    if (schema.type === FieldTypes.ManyToMany)
      return this.applyForManyToMany(schema, filter, ids, allRecordsMode, parentId, isDeleteMode);

    const condition = ConditionTreeFactory.matchIds(this.foreignCollection.schema, ids);
    const conditionTree = ConditionTreeFactory.intersect(
      filter.conditionTree,
      allRecordsMode.isActivated ? condition.inverse() : condition,
      new ConditionTreeLeaf(schema.foreignKey, Operator.Equal, parentId[0]),
    );
    const updatedFilter = filter.override({ conditionTree });

    if (isDeleteMode) return this.foreignCollection.delete(updatedFilter);

    await this.foreignCollection.update(updatedFilter, { [schema.foreignKey]: null });
  }

  private async applyForManyToMany(
    schemaRelation: ManyToManySchema,
    filter: Filter,
    ids: CompositeId[],
    allRecordsMode: AllRecordsMode,
    parentId: CompositeId,
    deleteMode: boolean,
  ): Promise<void> {
    const { dataSource } = this.collection;
    const manyToManyCollection = dataSource.getCollection(schemaRelation.throughCollection);

    let conditionTree = ConditionTreeFactory.intersect(
      filter.conditionTree?.nest(schemaRelation.targetRelation),
      DissociateDeleteRelatedRoute.generateConditionsToMatchRecords(
        ids,
        allRecordsMode.isActivated,
        manyToManyCollection,
        schemaRelation,
        parentId,
      ),
    );
    const updatedFilter = filter.override({ conditionTree });

    if (deleteMode) {
      const { schema } = manyToManyCollection;
      const fkName = SchemaUtils.getForeignKeyName(schema, schemaRelation.targetRelation);
      const records = await manyToManyCollection.list(updatedFilter, new Projection(fkName));
      await manyToManyCollection.delete(updatedFilter);
      conditionTree = this.matchIds(records, fkName);
      const { segment, timezone } = updatedFilter;

      return this.foreignCollection.delete(new Filter({ conditionTree, segment, timezone }));
    }

    return manyToManyCollection.delete(updatedFilter);
  }

  private matchIds(records: RecordData[], fkName: string): ConditionTree {
    const fkSchema = this.foreignCollection.schema;
    const keys = records.map(r => String(r[fkName]));

    return ConditionTreeFactory.matchIds(fkSchema, IdUtils.unpackIds(fkSchema, keys));
  }

  private static generateConditionsToMatchRecords(
    ids: CompositeId[],
    areIdsExcluded: boolean,
    manyToManyCollection: Collection,
    schemaRelation: ManyToManySchema,
    parentId: CompositeId,
  ): ConditionTree {
    const originRelation = manyToManyCollection.schema.fields[
      schemaRelation.originRelation
    ] as OneToManySchema;

    if (ids.length === 0 && areIdsExcluded)
      return new ConditionTreeLeaf(originRelation.foreignKey, Operator.Equal, parentId[0]);

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
      areIdsExcluded ? inCondition.inverse() : inCondition,
    ]);
  }
}

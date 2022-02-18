import {
  CollectionUtils,
  CompositeId,
  ConditionTreeFactory,
  FieldTypes,
  Filter,
  ValidationError,
} from '@forestadmin/datasource-toolkit';
import { Context } from 'koa';
import Router from '@koa/router';

import { AllRecordsMode } from '../../utils/forest-http-api';
import { HttpCode } from '../../types';
import Data from '../../utils/data';
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
    const isDelete = Boolean(context.request.query.delete);
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

    await this.dissociateDeleteData(filter, ids, allRecordsMode, parentId, isDelete);
    context.response.status = HttpCode.NoContent;
  }

  private async dissociateDeleteData(
    filter: Filter,
    ids: CompositeId[],
    allRecordsMode: AllRecordsMode,
    parentId: CompositeId,
    isDelete: boolean,
  ) {
    const schemaRelation = CollectionUtils.getRelationOrThrowError(
      this.collection,
      this.relationName,
    );

    if (schemaRelation.type === FieldTypes.ManyToMany) {
      const manyToManyCollection = this.collection.dataSource.getCollection(
        schemaRelation.throughCollection,
      );
      let conditionTree = CollectionUtils.matchRecordsManyToMany(
        schemaRelation,
        filter,
        ids,
        allRecordsMode.isActivated,
        parentId,
        manyToManyCollection,
      );

      await manyToManyCollection.delete(filter.override({ conditionTree }));

      if (isDelete) {
        conditionTree = CollectionUtils.matchRecordForeignManyToMany(
          schemaRelation,
          filter,
          ids,
          allRecordsMode.isActivated,
          parentId,
          manyToManyCollection,
          this.foreignCollection,
        );
        await this.foreignCollection.delete(filter.override({ conditionTree }));
      }
    } else if (schemaRelation.type === FieldTypes.OneToMany) {
      const conditionTree = CollectionUtils.matchRecordsOneToMany(
        schemaRelation,
        filter,
        ids,
        allRecordsMode.isActivated,
        parentId,
        this.foreignCollection,
      );

      if (isDelete) {
        await this.foreignCollection.delete(filter.override({ conditionTree }));
      } else {
        await this.foreignCollection.update(filter.override({ conditionTree }), {
          [schemaRelation.foreignKey]: null,
        });
      }
    }
  }
}

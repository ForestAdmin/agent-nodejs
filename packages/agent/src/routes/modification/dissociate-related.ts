import {
  Collection,
  CollectionUtils,
  CompositeId,
  ConditionTreeFactory,
  FieldTypes,
  Filter,
  ValidationError,
} from '@forestadmin/datasource-toolkit';
import { Context } from 'koa';

import { AllRecordsMode } from '../../utils/forest-http-api';
import { ForestAdminHttpDriverServices } from '../../services';
import { HttpCode } from '../../types';
import Data from '../../utils/data';
import IdUtils from '../../utils/id';
import QueryStringParser from '../../utils/query-string';

export default class DissociateRelated {
  services: ForestAdminHttpDriverServices;
  collection: Collection;
  foreignCollection: Collection;
  relationName: string;

  constructor(
    services: ForestAdminHttpDriverServices,
    collection: Collection,
    foreignCollection: Collection,
    relationName: string,
  ) {
    this.collection = collection;
    this.foreignCollection = foreignCollection;
    this.services = services;
    this.relationName = relationName;
  }

  async handleDissociateRelatedRoute(context: Context): Promise<void> {
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
    await this.dissociateTheRelations(ids, parentId, filter, allRecordsMode);
    context.response.status = HttpCode.NoContent;
  }

  private async dissociateTheRelations(
    ids: CompositeId[],
    parentId: CompositeId,
    filter: Filter,
    allRecordsMode: AllRecordsMode,
  ) {
    const schemaRelation = CollectionUtils.getRelationOrThrowError(
      this.collection,
      this.relationName,
    );

    if (schemaRelation.type === FieldTypes.ManyToMany) {
      const manyToManyCollection = this.collection.dataSource.getCollection(
        schemaRelation.throughCollection,
      );
      const conditionTree = CollectionUtils.generateDissociateManyToManyCondition(
        schemaRelation,
        filter,
        ids,
        allRecordsMode.isActivated,
        parentId,
        manyToManyCollection,
      );

      return manyToManyCollection.delete(filter.override({ conditionTree }));
    }

    const conditionTree = CollectionUtils.generateDissociateOneToManyCondition(
      schemaRelation,
      filter,
      ids,
      allRecordsMode.isActivated,
      parentId,
      this.foreignCollection,
    );

    return this.foreignCollection.update(filter.override({ conditionTree }), {
      [schemaRelation.foreignKey]: null,
    });
  }
}

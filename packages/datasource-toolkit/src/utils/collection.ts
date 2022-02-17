import { Aggregator, ConditionTreeBranch, Filter } from '../index';
import { Collection } from '../interfaces/collection';
import { CompositeId, RecordData } from '../interfaces/record';
import {
  FieldSchema,
  FieldTypes,
  ManyToManySchema,
  OneToManySchema,
  RelationSchema,
} from '../interfaces/schema';
import Aggregation, { AggregateResult } from '../interfaces/query/aggregation';
import ConditionTree from '../interfaces/query/condition-tree/nodes/base';
import ConditionTreeFactory from '../interfaces/query/condition-tree/factory';
import ConditionTreeLeaf, { Operator } from '../interfaces/query/condition-tree/nodes/leaf';
import PaginatedFilter from '../interfaces/query/filter/paginated';
import Projection from '../interfaces/query/projection';
import SchemaUtils from './schema';

export default class CollectionUtils {
  static getRelation(collection: Collection, path: string): Collection {
    if (path?.length) {
      const [field, ...subPath] = path.split(':');
      const schema = collection.schema.fields[field];

      if (!schema)
        throw new Error(`Relation '${field}' not found on collection '${collection.name}'`);

      if (schema.type !== FieldTypes.ManyToOne && schema.type !== FieldTypes.OneToOne)
        throw new Error(`Invalid relation type: ${schema.type}`);

      const association = collection.dataSource.getCollection(schema.foreignCollection);

      return CollectionUtils.getRelation(association, subPath.join(':'));
    }

    return collection;
  }

  static getFieldSchema(collection: Collection, path: string): FieldSchema {
    const associationPath = path.split(':');
    const columnPath = associationPath.pop();
    const association = CollectionUtils.getRelation(collection, associationPath.join(':'));

    if (!association.schema.fields[columnPath]) {
      throw new Error(`Field '${columnPath}' not found on collection '${association.name}'`);
    }

    return association.schema.fields[columnPath];
  }

  static getInverseRelation(collection: Collection, relationName: string): string {
    const relation = collection.schema.fields[relationName] as RelationSchema;
    const foreignCollection = collection.dataSource.getCollection(relation.foreignCollection);
    const inverse = Object.entries(foreignCollection.schema.fields).find(
      ([, field]: [string, RelationSchema]) => {
        const isManyToManyInverse =
          field.type === FieldTypes.ManyToMany &&
          relation.type === FieldTypes.ManyToMany &&
          field.otherField === relation.foreignKey &&
          field.throughCollection === relation.throughCollection &&
          field.foreignKey === relation.otherField;

        const isManyToOneInverse =
          field.type === FieldTypes.ManyToOne &&
          (relation.type === FieldTypes.OneToMany || relation.type === FieldTypes.OneToOne) &&
          field.foreignKey === relation.foreignKey;

        const isOtherInverse =
          (field.type === FieldTypes.OneToMany || field.type === FieldTypes.OneToOne) &&
          relation.type === FieldTypes.ManyToOne &&
          field.foreignKey === relation.foreignKey;

        return (
          (isManyToManyInverse || isManyToOneInverse || isOtherInverse) &&
          field.foreignCollection === collection.name
        );
      },
    ) as [string, RelationSchema];

    return inverse ? inverse[0] : null;
  }

  static async listRelation(
    collection: Collection,
    id: CompositeId,
    relationName: string,
    paginatedFilter: PaginatedFilter,
    projection: Projection,
  ): Promise<RecordData[]> {
    const relation = CollectionUtils.getRelationOrThrowError(collection, relationName);
    const relationCollection = CollectionUtils.getCollectionFromRelation(collection, relation);
    const conditionTree = CollectionUtils.buildConditionTreeFromRelation(
      relation,
      id,
      paginatedFilter.conditionTree,
    );

    if (relation.type === FieldTypes.OneToMany) {
      return relationCollection.list(paginatedFilter.override({ conditionTree }), projection);
    }

    const records = await relationCollection.list(
      paginatedFilter.override({
        conditionTree,
        sort: paginatedFilter.sort?.nest(relation.targetRelation),
      }),
      projection.nest(relation.targetRelation),
    );

    return records.map(r => r[relation.targetRelation] as RecordData);
  }

  static getRelationOrThrowError(
    collection: Collection,
    relationName: string,
  ): ManyToManySchema | OneToManySchema {
    const relationFieldSchema = collection.schema.fields[relationName];

    if (
      relationFieldSchema.type !== FieldTypes.OneToMany &&
      relationFieldSchema.type !== FieldTypes.ManyToMany
    ) {
      throw new Error(
        'This method can only be used with ' +
          `${FieldTypes.OneToMany} and ${FieldTypes.ManyToMany} relations`,
      );
    }

    return collection.schema.fields[relationName] as ManyToManySchema | OneToManySchema;
  }

  static async aggregateRelation(
    collection: Collection,
    id: CompositeId,
    relationName: string,
    paginatedFilter: PaginatedFilter,
    aggregation: Aggregation,
  ): Promise<AggregateResult[]> {
    const relation = CollectionUtils.getRelationOrThrowError(collection, relationName);
    const relationCollection = CollectionUtils.getCollectionFromRelation(collection, relation);
    const conditionTree = CollectionUtils.buildConditionTreeFromRelation(
      relation,
      id,
      paginatedFilter.conditionTree,
    );

    if (relation.type === FieldTypes.OneToMany) {
      return relationCollection.aggregate(paginatedFilter.override({ conditionTree }), aggregation);
    }

    const aggregateResults = await relationCollection.aggregate(
      paginatedFilter.override({ conditionTree }),
      aggregation.nest(relation.targetRelation),
    );

    return CollectionUtils.removePrefixesInResults(aggregateResults, relation);
  }

  static generateDissociateOneToManyCondition(
    schemaRelation: OneToManySchema,
    filter: Filter,
    ids: CompositeId[],
    isExcludedIds: boolean,
    parentId: CompositeId,
    foreignCollection: Collection,
  ) {
    const condition = ConditionTreeFactory.matchIds(foreignCollection.schema, ids);

    return ConditionTreeFactory.intersect(
      filter.conditionTree,
      isExcludedIds ? condition.inverse() : condition,
      new ConditionTreeLeaf(schemaRelation.foreignKey, Operator.Equal, parentId[0]),
    );
  }

  static generateDissociateManyToManyCondition(
    schemaRelation: ManyToManySchema,
    filter: Filter,
    ids: CompositeId[],
    isExcludedIds: boolean,
    parentId: CompositeId,
    manyToManyCollection: Collection,
  ) {
    return ConditionTreeFactory.intersect(
      filter.conditionTree?.nest(schemaRelation.targetRelation),
      CollectionUtils.generateConditionsToMatchRecords(
        ids,
        isExcludedIds,
        manyToManyCollection,
        schemaRelation,
        parentId,
      ),
    );
  }

  private static getCollectionFromRelation(
    collection: Collection,
    relation: ManyToManySchema | OneToManySchema,
  ): Collection {
    if (relation.type === FieldTypes.OneToMany) {
      return collection.dataSource.getCollection(relation.foreignCollection);
    }

    return collection.dataSource.getCollection(relation.throughCollection);
  }

  private static buildConditionTreeFromRelation(
    relation: ManyToManySchema | OneToManySchema,
    id: CompositeId,
    conditionTree: ConditionTree,
  ): ConditionTree {
    const isOneToMany = relation.type === FieldTypes.OneToMany;
    const conditionToMatchId = new ConditionTreeLeaf(
      isOneToMany ? relation.foreignKey : relation.otherField,
      Operator.Equal,
      id[0],
    );

    const computedConditionTree = isOneToMany
      ? conditionTree
      : conditionTree?.nest(relation.targetRelation);

    return ConditionTreeFactory.intersect(computedConditionTree, conditionToMatchId);
  }

  private static removePrefixesInResults(
    aggregateResults: AggregateResult[],
    schema: ManyToManySchema,
  ): AggregateResult[] {
    return aggregateResults.map(aggregateResult => {
      const newResult: AggregateResult = {
        value: aggregateResult.value,
        group: {},
      };

      Object.entries(aggregateResult.group).forEach(([field, result]) => {
        if (field.startsWith(schema.originRelation)) {
          const suffix = field.substring(schema.originRelation.length + ':'.length);
          newResult.group[suffix] = result;
        } else {
          throw new Error(
            `This field ${field} does not have the right expected prefix: ${schema.originRelation}`,
          );
        }
      });

      return newResult;
    });
  }

  private static generateConditionsToMatchRecords(
    ids: CompositeId[],
    isExcludedIds: boolean,
    manyToManyCollection: Collection,
    schemaRelation: ManyToManySchema,
    parentId: CompositeId,
  ): ConditionTree {
    const originRelation = manyToManyCollection.schema.fields[
      schemaRelation.originRelation
    ] as OneToManySchema;

    if (ids.length === 0 && isExcludedIds) {
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
      isExcludedIds ? inCondition.inverse() : inCondition,
    ]);
  }
}

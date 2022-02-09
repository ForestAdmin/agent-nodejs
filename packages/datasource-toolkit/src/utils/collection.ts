import { Collection } from '../interfaces/collection';
import Aggregation, { AggregateResult } from '../interfaces/query/aggregation';
import ConditionTreeFactory from '../interfaces/query/condition-tree/factory';
import ConditionTreeLeaf, { Operator } from '../interfaces/query/condition-tree/nodes/leaf';
import PaginatedFilter from '../interfaces/query/filter/paginated';
import { CompositeId } from '../interfaces/record';
import { FieldSchema, FieldTypes, ManyToManySchema, RelationSchema } from '../interfaces/schema';

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

  static async aggregateRelation(
    collection: Collection,
    id: CompositeId,
    relationName: string,
    paginatedFilter: PaginatedFilter,
    aggregation: Aggregation,
  ): Promise<AggregateResult[]> {
    const relationFieldSchema = collection.schema.fields[relationName];
    const isOneToMany = relationFieldSchema.type === FieldTypes.OneToMany;
    const isManyToMany = relationFieldSchema.type === FieldTypes.ManyToMany;

    if (!isOneToMany && !isManyToMany) {
      throw new Error(
        'aggregateRelation method can only be used with ' +
          `${FieldTypes.OneToMany} and ${FieldTypes.ManyToMany} relations`,
      );
    }

    if (isOneToMany) {
      const foreignCollection = collection.dataSource.getCollection(
        relationFieldSchema.foreignCollection,
      );
      const conditionTree = ConditionTreeFactory.intersect(
        paginatedFilter.conditionTree,
        new ConditionTreeLeaf(relationFieldSchema.foreignKey, Operator.Equal, id[0]),
      );

      return foreignCollection.aggregate(paginatedFilter.override({ conditionTree }), aggregation);
    }

    return CollectionUtils.getAggregateResultsForManyToMany(
      collection,
      id,
      relationFieldSchema,
      paginatedFilter,
      aggregation,
    );
  }

  private static async getAggregateResultsForManyToMany(
    collection: Collection,
    id: CompositeId,
    relationFieldSchema: ManyToManySchema,
    paginatedFilter: PaginatedFilter,
    aggregation: Aggregation,
  ): Promise<AggregateResult[]> {
    const throughCollection = collection.dataSource.getCollection(
      relationFieldSchema.throughCollection,
    );
    const conditionTree = ConditionTreeFactory.intersect(
      paginatedFilter.conditionTree?.nest(relationFieldSchema.originRelation),
      new ConditionTreeLeaf(relationFieldSchema.otherField, Operator.Equal, id[0]),
    );

    const aggregateResults = await throughCollection.aggregate(
      paginatedFilter.override({ conditionTree }),
      aggregation.nest(relationFieldSchema.originRelation),
    );

    return CollectionUtils.removePrefixesInResults(aggregateResults, relationFieldSchema);
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
}

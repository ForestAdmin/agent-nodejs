import { Collection, DataSource } from '../interfaces/collection';
import {
  FieldSchema,
  FieldTypes,
  ManyToManySchema,
  OneToManySchema,
  RelationSchema,
} from '../interfaces/schema';
import PaginatedFilter from '../interfaces/query/filter/paginated';
import Aggregation, { AggregateResult } from '../interfaces/query/aggregation';
import ConditionTreeUtils from './condition-tree';
import ConditionTreeLeaf, { Operator } from '../interfaces/query/condition-tree/leaf';

export default class CollectionUtils {
  static async aggregateRelation(
    paginatedFilter: PaginatedFilter,
    id: number,
    collection: Collection,
    relationName: string,
    aggregation: Aggregation,
    datasource: DataSource,
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

    const foreignCollection = await datasource.getCollection(relationFieldSchema.foreignCollection);

    if (isOneToMany) {
      const filter = CollectionUtils.buildFilterOneToMany(relationFieldSchema, id, paginatedFilter);

      return foreignCollection.aggregate(filter, aggregation);
    }

    const filter = CollectionUtils.buildFilterManyToMany(paginatedFilter, relationFieldSchema, id);
    const aggregateResults = await foreignCollection.aggregate(
      filter,
      aggregation.nest(relationFieldSchema.otherField),
    );

    return CollectionUtils.removePrefixes(aggregateResults, relationFieldSchema);
  }

  private static buildFilterManyToMany(
    paginatedFilter: PaginatedFilter,
    relationFieldSchema: ManyToManySchema,
    id: number,
  ): PaginatedFilter {
    const filter = this.buildFilterOneToMany(relationFieldSchema, id, paginatedFilter);

    return filter.override({
      conditionTree: ConditionTreeUtils.intersect(
        filter.conditionTree,
        paginatedFilter.conditionTree.nest(relationFieldSchema.otherField),
      ),
    });
  }

  private static buildFilterOneToMany(
    relationFieldSchema: ManyToManySchema | OneToManySchema,
    id: number,
    paginatedFilter: PaginatedFilter,
  ): PaginatedFilter {
    const conditionToMatchId = new ConditionTreeLeaf({
      field: relationFieldSchema.foreignKey,
      operator: Operator.Equal,
      value: id,
    });

    return paginatedFilter.override({
      conditionTree: ConditionTreeUtils.intersect(
        paginatedFilter.conditionTree,
        conditionToMatchId,
      ),
    });
  }

  private static removePrefixes(
    aggregateResults: AggregateResult[],
    schema: ManyToManySchema,
  ): AggregateResult[] {
    return aggregateResults.map(aggregateResult => {
      const newResult: AggregateResult = {
        value: aggregateResult.value,
        group: aggregateResult.group,
      };

      Object.entries(aggregateResult.group).forEach(([field, result]) => {
        if (field.startsWith(schema.otherField)) {
          const suffix = field.substring(schema.otherField.length + ':'.length);
          newResult.group[suffix] = result;
        }
      });

      return newResult;
    });
  }

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
}

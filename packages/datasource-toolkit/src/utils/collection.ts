import { Collection } from '../interfaces/collection';
import { CompositeId, RecordData } from '../interfaces/record';
import { FieldSchema, FieldTypes, RelationSchema } from '../interfaces/schema';
import Aggregation, { AggregateResult } from '../interfaces/query/aggregation';
import ConditionTreeFactory from '../interfaces/query/condition-tree/factory';
import Filter from '../interfaces/query/filter/unpaginated';
import FilterFactory from '../interfaces/query/filter/factory';
import PaginatedFilter from '../interfaces/query/filter/paginated';
import Projection from '../interfaces/query/projection';
import SchemaUtils from './schema';

export default class CollectionUtils {
  static getFieldSchema(collection: Collection, path: string): FieldSchema {
    const { fields } = collection.schema;
    const index = path.indexOf(':');

    if (index === -1) {
      if (!fields[path]) throw new Error(`Column not found '${collection.name}.${path}'`);

      return fields[path];
    }

    const associationName = path.substring(0, index);
    const schema = fields[associationName] as RelationSchema;

    if (!schema) {
      throw new Error(`Relation not found '${collection.name}.${associationName}'`);
    }

    if (schema.type !== FieldTypes.ManyToOne && schema.type !== FieldTypes.OneToOne) {
      throw new Error(
        `Unexpected field type '${schema.type}': '${collection.name}.${associationName}'`,
      );
    }

    return CollectionUtils.getFieldSchema(
      collection.dataSource.getCollection(schema.foreignCollection),
      path.substring(index + 1),
    );
  }

  static getInverseRelation(collection: Collection, relationName: string): string {
    const relation = collection.schema.fields[relationName] as RelationSchema;
    const foreignCollection = collection.dataSource.getCollection(relation.foreignCollection);
    const inverse = Object.entries(foreignCollection.schema.fields).find(
      ([, field]: [string, RelationSchema]) => {
        const isManyToManyInverse =
          field.type === FieldTypes.ManyToMany &&
          relation.type === FieldTypes.ManyToMany &&
          field.originKey === relation.foreignKey &&
          field.throughCollection === relation.throughCollection &&
          field.foreignKey === relation.originKey;

        const isManyToOneInverse =
          field.type === FieldTypes.ManyToOne &&
          (relation.type === FieldTypes.OneToMany || relation.type === FieldTypes.OneToOne) &&
          field.foreignKey === relation.originKey;

        const isOtherInverse =
          (field.type === FieldTypes.OneToMany || field.type === FieldTypes.OneToOne) &&
          relation.type === FieldTypes.ManyToOne &&
          field.originKey === relation.foreignKey;

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
    foreignFilter: PaginatedFilter,
    projection: Projection,
  ): Promise<RecordData[]> {
    const relation = SchemaUtils.getToManyRelation(collection.schema, relationName);
    const foreign = collection.dataSource.getCollection(relation.foreignCollection);

    // Optimization for many to many when there is not search/segment.
    if (
      relation.type === FieldTypes.ManyToMany &&
      relation.foreignRelation &&
      foreignFilter.isNestable
    ) {
      const through = collection.dataSource.getCollection(relation.throughCollection);
      const records = await through.list(
        await FilterFactory.makeThroughFilter(collection, id, relationName, foreignFilter),
        projection.nest(relation.foreignRelation),
      );

      return records.map(r => r[relation.foreignRelation] as RecordData);
    }

    // Otherwise fetch the target table (this works with both relation types)
    return foreign.list(
      await FilterFactory.makeForeignFilter(collection, id, relationName, foreignFilter),
      projection,
    );
  }

  static async aggregateRelation(
    collection: Collection,
    id: CompositeId,
    relationName: string,
    foreignFilter: Filter,
    aggregation: Aggregation,
    limit?: number,
  ): Promise<AggregateResult[]> {
    const relation = SchemaUtils.getToManyRelation(collection.schema, relationName);
    const foreign = collection.dataSource.getCollection(relation.foreignCollection);

    // Optimization for many to many when there is not search/segment (saves one query)
    if (
      relation.type === FieldTypes.ManyToMany &&
      relation.foreignRelation &&
      foreignFilter.isNestable
    ) {
      const through = collection.dataSource.getCollection(relation.throughCollection);
      const records = await through.aggregate(
        await FilterFactory.makeThroughFilter(collection, id, relationName, foreignFilter),
        aggregation.nest(relation.foreignRelation),
        limit,
      );

      // unnest aggregation result
      return records.map(({ value, group }) => ({
        value,
        group: Object.entries(group)
          .map<[string, unknown]>(([key, v]) => [key.substring(key.indexOf(':') + 1), v])
          .reduce((memo, [key, v]) => ({ ...memo, [key]: v }), {}),
      }));
    }

    // Otherwise fetch the target table (this works with both relation types)
    return foreign.aggregate(
      await FilterFactory.makeForeignFilter(collection, id, relationName, foreignFilter),
      aggregation,
      limit,
    );
  }

  static async getValue(collection: Collection, id: CompositeId, field: string): Promise<unknown> {
    const index = SchemaUtils.getPrimaryKeys(collection.schema).indexOf(field);
    if (index !== -1) return id[index];

    const [record] = await collection.list(
      new Filter({ conditionTree: ConditionTreeFactory.matchIds(collection.schema, [id]) }),
      new Projection(field),
    );

    return record[field];
  }
}

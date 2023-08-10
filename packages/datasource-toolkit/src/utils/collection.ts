import SchemaUtils from './schema';
import { Caller } from '../interfaces/caller';
import { Collection } from '../interfaces/collection';
import Aggregation, { AggregateResult } from '../interfaces/query/aggregation';
import ConditionTreeFactory from '../interfaces/query/condition-tree/factory';
import FilterFactory from '../interfaces/query/filter/factory';
import PaginatedFilter from '../interfaces/query/filter/paginated';
import Filter from '../interfaces/query/filter/unpaginated';
import Projection from '../interfaces/query/projection';
import { CompositeId, RecordData } from '../interfaces/record';
import { FieldSchema, RelationSchema } from '../interfaces/schema';

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

    if (schema.type !== 'ManyToOne' && schema.type !== 'OneToOne') {
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
          field.type === 'ManyToMany' &&
          relation.type === 'ManyToMany' &&
          field.originKey === relation.foreignKey &&
          field.throughCollection === relation.throughCollection &&
          field.foreignKey === relation.originKey;

        const isManyToOneInverse =
          field.type === 'ManyToOne' &&
          (relation.type === 'OneToMany' || relation.type === 'OneToOne') &&
          field.foreignKey === relation.originKey;

        const isOtherInverse =
          (field.type === 'OneToMany' || field.type === 'OneToOne') &&
          relation.type === 'ManyToOne' &&
          field.originKey === relation.foreignKey;

        return (
          (isManyToManyInverse || isManyToOneInverse || isOtherInverse) &&
          field.foreignCollection === collection.name
        );
      },
    ) as [string, RelationSchema];

    return inverse ? inverse[0] : null;
  }

  static getThroughOrigin(collection: Collection, relationName: string): string {
    const relation = collection.schema.fields[relationName];
    if (relation.type !== 'ManyToMany') throw new Error('Relation must be many to many');

    const throughCollection = collection.dataSource.getCollection(relation.throughCollection);
    const originRelation = Object.entries(throughCollection.schema.fields).find(
      ([, field]: [string, RelationSchema]) => {
        return (
          field.type === 'ManyToOne' &&
          field.foreignCollection === collection.name &&
          field.foreignKey === relation.originKey &&
          field.foreignKeyTarget === relation.originKeyTarget
        );
      },
    ) as [string, RelationSchema];

    return originRelation ? originRelation[0] : null;
  }

  static getThroughTarget(collection: Collection, relationName: string): string {
    const relation = collection.schema.fields[relationName];
    if (relation.type !== 'ManyToMany') throw new Error('Relation must be many to many');

    const throughCollection = collection.dataSource.getCollection(relation.throughCollection);
    const foreignRelation = Object.entries(throughCollection.schema.fields).find(
      ([, field]: [string, RelationSchema]) => {
        return (
          field.type === 'ManyToOne' &&
          field.foreignCollection === relation.foreignCollection &&
          field.foreignKey === relation.foreignKey &&
          field.foreignKeyTarget === relation.foreignKeyTarget
        );
      },
    ) as [string, RelationSchema];

    return foreignRelation ? foreignRelation[0] : null;
  }

  static async listRelation(
    collection: Collection,
    id: CompositeId,
    relationName: string,
    caller: Caller,
    foreignFilter: PaginatedFilter,
    projection: Projection,
  ): Promise<RecordData[]> {
    const relation = SchemaUtils.getToManyRelation(collection.schema, relationName);

    // Optimization for many to many when there is not search/segment.
    if (relation.type === 'ManyToMany' && foreignFilter.isNestable) {
      const foreignRelation = CollectionUtils.getThroughTarget(collection, relationName);

      if (foreignRelation) {
        const through = collection.dataSource.getCollection(relation.throughCollection);
        const records = await through.list(
          caller,
          await FilterFactory.makeThroughFilter(
            collection,
            id,
            relationName,
            caller,
            foreignFilter,
          ),
          projection.nest(foreignRelation),
        );

        // Exclude null records, which may happen in case of a broken relation.
        // This happens on databases that don't support enforced foreign keys (e.g. Mongo)
        return records.map(r => r[foreignRelation] as RecordData).filter(Boolean);
      }
    }

    // Otherwise fetch the target table (this works with both relation types)
    return collection.dataSource
      .getCollection(relation.foreignCollection)
      .list(
        caller,
        await FilterFactory.makeForeignFilter(collection, id, relationName, caller, foreignFilter),
        projection,
      );
  }

  static async aggregateRelation(
    collection: Collection,
    id: CompositeId,
    relationName: string,
    caller: Caller,
    foreignFilter: Filter,
    aggregation: Aggregation,
    limit?: number,
  ): Promise<AggregateResult[]> {
    const relation = SchemaUtils.getToManyRelation(collection.schema, relationName);

    // Optimization for many to many when there is not search/segment (saves one query)
    if (relation.type === 'ManyToMany' && foreignFilter.isNestable) {
      const foreignRelation = CollectionUtils.getThroughTarget(collection, relationName);

      if (foreignRelation) {
        const through = collection.dataSource.getCollection(relation.throughCollection);
        const records = await through.aggregate(
          caller,
          await FilterFactory.makeThroughFilter(
            collection,
            id,
            relationName,
            caller,
            foreignFilter,
          ),
          aggregation.nest(foreignRelation),
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
    }

    // Otherwise fetch the target table (this works with both relation types)
    return collection.dataSource
      .getCollection(relation.foreignCollection)
      .aggregate(
        caller,
        await FilterFactory.makeForeignFilter(collection, id, relationName, caller, foreignFilter),
        aggregation,
        limit,
      );
  }

  static async getValue(
    collection: Collection,
    caller: Caller,
    id: CompositeId,
    field: string,
  ): Promise<unknown> {
    const index = SchemaUtils.getPrimaryKeys(collection.schema).indexOf(field);
    if (index !== -1) return id[index];

    const [record] = await collection.list(
      caller,
      new Filter({ conditionTree: ConditionTreeFactory.matchIds(collection.schema, [id]) }),
      new Projection(field),
    );

    return record[field];
  }
}

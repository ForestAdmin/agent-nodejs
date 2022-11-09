import CollectionSchema from './collection-schema';
import DataSource from './datasource';
import { ActionField, ActionResult } from './interfaces/action';
import { Caller } from './interfaces/caller';
import { Chart } from './interfaces/chart';
import Aggregation, { AggregateResult } from './interfaces/query/aggregation';
import ConditionTreeFactory from './interfaces/query/condition-tree/factory';
import FilterFactory from './interfaces/query/filter/factory';
import PaginatedFilter from './interfaces/query/filter/paginated';
import Filter from './interfaces/query/filter/unpaginated';
import Projection from './interfaces/query/projection';
import { CompositeId, RecordData } from './interfaces/record';
import { FieldSchema, RelationSchema } from './interfaces/schema';

export default abstract class Collection {
  abstract get dataSource(): DataSource;
  abstract get name(): string;
  abstract get schema(): CollectionSchema;

  abstract execute(
    caller: Caller,
    name: string,
    formValues: RecordData,
    filter?: Filter,
  ): Promise<ActionResult>;

  abstract getForm(
    caller: Caller,
    name: string,
    formValues?: RecordData,
    filter?: Filter,
  ): Promise<ActionField[]>;

  abstract create(caller: Caller, data: RecordData[]): Promise<RecordData[]>;

  abstract list(
    caller: Caller,
    filter: PaginatedFilter,
    projection: Projection,
  ): Promise<RecordData[]>;

  abstract update(caller: Caller, filter: Filter, patch: RecordData): Promise<void>;

  abstract delete(caller: Caller, filter: Filter): Promise<void>;

  abstract aggregate(
    caller: Caller,
    filter: Filter,
    aggregation: Aggregation,
    limit?: number,
  ): Promise<AggregateResult[]>;

  abstract renderChart(caller: Caller, name: string, recordId: CompositeId): Promise<Chart>;

  getFieldSchema(path: string): FieldSchema {
    const { fields } = this.schema;
    const index = path.indexOf(':');

    if (index === -1) {
      if (!fields[path]) throw new Error(`Column not found '${this.name}.${path}'`);

      return fields[path];
    }

    const associationName = path.substring(0, index);
    const schema = fields[associationName] as RelationSchema;

    if (!schema) {
      throw new Error(`Relation not found '${this.name}.${associationName}'`);
    }

    if (schema.type !== 'ManyToOne' && schema.type !== 'OneToOne') {
      throw new Error(`Unexpected field type '${schema.type}': '${this.name}.${associationName}'`);
    }

    return this.dataSource
      .getCollection(schema.foreignCollection)
      .getFieldSchema(path.substring(index + 1));
  }

  getInverseRelation(relationName: string): string {
    const relation = this.schema.fields[relationName] as RelationSchema;
    const foreignCollection = this.dataSource.getCollection(relation.foreignCollection);
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
          field.foreignCollection === this.name
        );
      },
    ) as [string, RelationSchema];

    return inverse ? inverse[0] : null;
  }

  getThroughOrigin(relationName: string): string {
    const relation = this.schema.fields[relationName];
    if (relation.type !== 'ManyToMany') throw new Error('Relation must be many to many');

    const throughCollection = this.dataSource.getCollection(relation.throughCollection);
    const originRelation = Object.entries(throughCollection.schema.fields).find(
      ([, field]: [string, RelationSchema]) => {
        return (
          field.type === 'ManyToOne' &&
          field.foreignCollection === this.name &&
          field.foreignKey === relation.originKey &&
          field.foreignKeyTarget === relation.originKeyTarget
        );
      },
    ) as [string, RelationSchema];

    return originRelation ? originRelation[0] : null;
  }

  getThroughTarget(relationName: string): string {
    const relation = this.schema.fields[relationName];
    if (relation.type !== 'ManyToMany') throw new Error('Relation must be many to many');

    const throughCollection = this.dataSource.getCollection(relation.throughCollection);
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

  async listRelation(
    id: CompositeId,
    relationName: string,
    caller: Caller,
    foreignFilter: PaginatedFilter,
    projection: Projection,
  ): Promise<RecordData[]> {
    const relation = this.schema.getToManyRelation(relationName);
    const foreign = this.dataSource.getCollection(relation.foreignCollection);

    // Optimization for many to many when there is not search/segment.
    if (relation.type === 'ManyToMany' && foreignFilter.isNestable) {
      const foreignRelation = this.getThroughTarget(relationName);

      if (foreignRelation) {
        const through = this.dataSource.getCollection(relation.throughCollection);
        const records = await through.list(
          caller,
          await FilterFactory.makeThroughFilter(this, id, relationName, caller, foreignFilter),
          projection.nest(foreignRelation),
        );

        return records.map(r => r[foreignRelation] as RecordData);
      }
    }

    // Otherwise fetch the target table (this works with both relation types)
    return foreign.list(
      caller,
      await FilterFactory.makeForeignFilter(this, id, relationName, caller, foreignFilter),
      projection,
    );
  }

  async aggregateRelation(
    id: CompositeId,
    relationName: string,
    caller: Caller,
    foreignFilter: Filter,
    aggregation: Aggregation,
    limit?: number,
  ): Promise<AggregateResult[]> {
    const relation = this.schema.getToManyRelation(relationName);
    const foreign = this.dataSource.getCollection(relation.foreignCollection);

    // Optimization for many to many when there is not search/segment (saves one query)
    if (relation.type === 'ManyToMany' && foreignFilter.isNestable) {
      const foreignRelation = this.getThroughTarget(relationName);

      if (foreignRelation) {
        const through = this.dataSource.getCollection(relation.throughCollection);
        const records = await through.aggregate(
          caller,
          await FilterFactory.makeThroughFilter(this, id, relationName, caller, foreignFilter),
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
    return foreign.aggregate(
      caller,
      await FilterFactory.makeForeignFilter(this, id, relationName, caller, foreignFilter),
      aggregation,
      limit,
    );
  }

  async getValue(caller: Caller, id: CompositeId, field: string): Promise<unknown> {
    const index = this.schema.primaryKeys.indexOf(field);
    if (index !== -1) return id[index];

    const [record] = await this.list(
      caller,
      new Filter({ conditionTree: ConditionTreeFactory.matchIds(this.schema, [id]) }),
      new Projection(field),
    );

    return record[field];
  }
}

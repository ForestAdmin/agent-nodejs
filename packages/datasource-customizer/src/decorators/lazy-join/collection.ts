import type {
  AggregateResult,
  Aggregation,
  Caller,
  FieldSchema,
  Filter,
  ManyToOneSchema,
  PaginatedFilter,
  Projection,
  RecordData,
} from '@forestadmin/datasource-toolkit';

import { CollectionDecorator } from '@forestadmin/datasource-toolkit';

export default class LazyJoinDecorator extends CollectionDecorator {
  override async list(
    caller: Caller,
    filter: PaginatedFilter,
    projection: Projection,
  ): Promise<RecordData[]> {
    const { relations } = projection;
    const refinedProjection = projection.replace(field => this.refineField(field, relations));
    const refinedFilter = await this.refineFilter(caller, filter);

    const records = await this.childCollection.list(caller, refinedFilter, refinedProjection);

    this.refineResults(relations, (relationName, foreignKey, foreignKeyTarget) => {
      records.forEach(record => {
        if (record[foreignKey]) {
          record[relationName] = { [foreignKeyTarget]: record[foreignKey] };
        }

        if (!projection.includes(foreignKey)) delete record[foreignKey];
      });
    });

    return records;
  }

  override async aggregate(
    caller: Caller,
    filter: Filter,
    aggregation: Aggregation,
    limit?: number,
  ): Promise<AggregateResult[]> {
    const { relations } = aggregation.projection;
    const refinedAggregation = aggregation.replaceFields(field =>
      this.refineField(field, relations),
    );
    const refinedFilter = await this.refineFilter(caller, filter);

    const results = await this.childCollection.aggregate(
      caller,
      refinedFilter,
      refinedAggregation,
      limit,
    );

    this.refineResults(relations, (relationName, foreignKey, foreignKeyTarget) => {
      results.forEach(result => {
        if (result.group[foreignKey]) {
          result.group[`${relationName}:${foreignKeyTarget}`] = result.group[foreignKey];
        }

        delete result.group[foreignKey];
      });
    });

    return results;
  }

  private isLazyRelationProjection(relation: FieldSchema, relationProjection: Projection) {
    return (
      relation.type === 'ManyToOne' &&
      relationProjection.length === 1 &&
      relationProjection[0] === relation.foreignKeyTarget
    );
  }

  private refineField(field: string, relations: Record<string, Projection>): string {
    if (!field.includes(':')) return field;

    const relationName = field.split(':')[0];
    const relation = this.schema.fields[relationName] as ManyToOneSchema;
    const relationProjection = relations[relationName];

    return this.isLazyRelationProjection(relation, relationProjection)
      ? relation.foreignKey
      : field;
  }

  override async refineFilter(caller: Caller, filter?: PaginatedFilter): Promise<PaginatedFilter> {
    if (filter?.conditionTree) {
      const { relations } = filter.conditionTree.projection;
      filter.conditionTree = filter.conditionTree.replaceFields(field =>
        this.refineField(field, relations),
      );
    }

    return filter;
  }

  private refineResults(
    relations: Record<string, Projection>,
    handler: (relationName: string, foreignKey: string, foreignKeyTarget: string) => void,
  ) {
    Object.entries(relations).forEach(([relationName, relationProjection]) => {
      const relation = this.schema.fields[relationName] as ManyToOneSchema;

      if (this.isLazyRelationProjection(relation, relationProjection)) {
        const { foreignKeyTarget, foreignKey } = relation;
        handler(relationName, foreignKey, foreignKeyTarget);
      }
    });
  }
}

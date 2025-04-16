import {
  AggregateResult,
  Aggregation,
  Caller,
  CollectionDecorator,
  FieldSchema,
  Filter,
  ManyToOneSchema,
  PaginatedFilter,
  Projection,
  RecordData,
} from '@forestadmin/datasource-toolkit';

export default class LazyJoinDecorator extends CollectionDecorator {
  override async list(
    caller: Caller,
    filter: PaginatedFilter,
    projection: Projection,
  ): Promise<RecordData[]> {
    const refinedProjection = projection.replace(field => this.refineField(field, projection));
    const refinedFilter = await this.refineFilter(caller, filter);

    const records = await this.childCollection.list(caller, refinedFilter, refinedProjection);

    this.refineResults(projection, (relationName, foreignKey, foreignKeyTarget) => {
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
    const refinedAggregation = aggregation.replaceFields(field =>
      this.refineField(field, aggregation.projection),
    );
    const refinedFilter = await this.refineFilter(caller, filter);

    const results = await this.childCollection.aggregate(
      caller,
      refinedFilter,
      refinedAggregation,
      limit,
    );

    this.refineResults(aggregation.projection, (relationName, foreignKey, foreignKeyTarget) => {
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

  private refineField(field: string, projection: Projection): string {
    const relationName = field.split(':')[0];
    const relation = this.schema.fields[relationName] as ManyToOneSchema;
    const relationProjection = projection.relations[relationName];

    return this.isLazyRelationProjection(relation, relationProjection)
      ? relation.foreignKey
      : field;
  }

  override async refineFilter(caller: Caller, filter?: PaginatedFilter): Promise<PaginatedFilter> {
    if (filter?.conditionTree) {
      filter.conditionTree = filter.conditionTree.replaceFields(field =>
        this.refineField(field, filter.conditionTree.projection),
      );
    }

    return filter;
  }

  private refineResults(
    projection: Projection,
    handler: (relationName: string, foreignKey: string, foreignKeyTarget: string) => void,
  ) {
    Object.entries(projection.relations).forEach(([relationName, relationProjection]) => {
      const relation = this.schema.fields[relationName] as ManyToOneSchema;

      if (this.isLazyRelationProjection(relation, relationProjection)) {
        const { foreignKeyTarget, foreignKey } = relation;
        handler(relationName, foreignKey, foreignKeyTarget);
      }
    });
  }
}

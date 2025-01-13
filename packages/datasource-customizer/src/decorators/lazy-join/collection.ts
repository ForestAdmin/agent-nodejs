import {
  Caller,
  CollectionDecorator,
  FieldSchema,
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
    const refinedProjection = this.refineProjection(projection);
    const refinedFilter = await this.refineFilter(caller, filter);

    const records = await this.childCollection.list(caller, refinedFilter, refinedProjection);

    return this.refineRecords(records, projection);
  }

  private isLazyRelationProjection(relation: FieldSchema, relationProjection: Projection) {
    return (
      relation.type === 'ManyToOne' &&
      relationProjection.length === 1 &&
      relationProjection[0] === relation.foreignKeyTarget
    );
  }

  private refineProjection(projection: Projection): Projection {
    const newProjection = new Projection(...projection);

    Object.entries(newProjection.relations).forEach(([relationName, relationProjection]) => {
      const relation = this.schema.fields[relationName] as ManyToOneSchema;

      if (this.isLazyRelationProjection(relation, relationProjection)) {
        const index = newProjection.findIndex(p => p.startsWith(relationName));

        newProjection[index] = relation.foreignKey;
      }
    });

    return newProjection;
  }

  override async refineFilter(caller: Caller, filter: PaginatedFilter): Promise<PaginatedFilter> {
    if (filter.conditionTree) {
      const relationToRefine: Record<string, ManyToOneSchema> = Object.entries(
        filter.conditionTree.projection.relations,
      ).reduce((relations, [relationName, relationProjection]) => {
        const relation = this.schema.fields[relationName] as ManyToOneSchema;

        if (this.isLazyRelationProjection(relation, relationProjection)) {
          relations[relationName] = relation;
        }

        return relations;
      }, {});

      filter.conditionTree.replaceLeafs(leaf => {
        const relationName = Object.keys(leaf.projection.relations)[0];

        if (relationName && relationToRefine[relationName]) {
          leaf.field = relationToRefine[relationName].foreignKey;
        }

        return leaf;
      });
    }

    return filter;
  }

  private refineRecords(records: RecordData[], projection: Projection): RecordData[] {
    Object.entries(projection.relations).forEach(([relationName, relationProjection]) => {
      const relation = this.schema.fields[relationName] as ManyToOneSchema;

      if (this.isLazyRelationProjection(relation, relationProjection)) {
        const { foreignKeyTarget, foreignKey } = relation;

        records.forEach(record => {
          if (record[foreignKey]) {
            record[relationName] = { [foreignKeyTarget]: record[foreignKey] };
          }

          delete record[foreignKey];
        });
      }
    });

    return records;
  }
}

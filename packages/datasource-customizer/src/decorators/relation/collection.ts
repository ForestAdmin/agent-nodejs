import {
  AggregateResult,
  Aggregation,
  Caller,
  Collection,
  CollectionDecorator,
  CollectionSchema,
  CollectionUtils,
  ColumnSchema,
  ConditionTree,
  ConditionTreeLeaf,
  DataSourceDecorator,
  Filter,
  MissingFieldError,
  PaginatedFilter,
  Projection,
  RecordData,
  RecordUtils,
  RelationSchema,
  SchemaUtils,
} from '@forestadmin/datasource-toolkit';

import { RelationDefinition } from './types';

export default class RelationCollectionDecorator extends CollectionDecorator {
  override readonly dataSource: DataSourceDecorator<RelationCollectionDecorator>;
  protected relations: Record<string, RelationSchema> = {};

  addRelation(name: string, partialJoint: RelationDefinition): void {
    const relation = this.relationWithOptionalFields(partialJoint);
    this.checkForeignKeys(relation);
    this.checkOriginKeys(relation);

    this.relations[name] = relation;
    this.markSchemaAsDirty();
  }

  override async list(
    caller: Caller,
    filter: PaginatedFilter,
    projection: Projection,
  ): Promise<RecordData[]> {
    const newFilter = await this.refineFilter(caller, filter);
    const newProjection = projection.replace(this.rewriteField, this).withPks(this);
    const records = await this.childCollection.list(caller, newFilter, newProjection);
    if (newProjection.equals(projection)) return records;

    await this.reprojectInPlace(caller, records, projection);

    return projection.apply(records);
  }

  override async aggregate(
    caller: Caller,
    filter: Filter,
    aggregation: Aggregation,
    limit?: number,
  ): Promise<AggregateResult[]> {
    const newFilter = await this.refineFilter(caller, filter);

    // No emulated relations are used in the aggregation
    if (Object.keys(aggregation.projection.relations).every(prefix => !this.relations[prefix])) {
      return this.childCollection.aggregate(caller, newFilter, aggregation, limit);
    }

    // Fallback to full emulation.
    return aggregation.apply(
      await this.list(caller, filter, aggregation.projection),
      caller.timezone,
      limit,
    );
  }

  protected override refineSchema(subSchema: CollectionSchema): CollectionSchema {
    const schema = { ...subSchema, fields: { ...subSchema.fields } };

    for (const [name, relation] of Object.entries(this.relations)) {
      schema.fields[name] = relation;
    }

    return schema;
  }

  protected override async refineFilter(
    caller: Caller,
    filter: PaginatedFilter,
  ): Promise<PaginatedFilter> {
    return filter?.override({
      conditionTree: await filter.conditionTree?.replaceLeafsAsync(
        leaf => this.rewriteLeaf(caller, leaf),
        this,
      ),

      // Replace sort in emulated relations to
      // - sorting by the fk of the relation for many to one
      // - removing the sort altogether for one to one
      //
      // This is far from ideal, but the best that can be done without taking a major
      // performance hit.
      // Customers which want proper sorting should enable emulation in the associated
      // middleware
      sort: filter.sort?.replaceClauses(clause =>
        this.rewriteField(clause.field).map(field => ({ ...clause, field })),
      ),
    });
  }

  private relationWithOptionalFields(partialJoint: RelationDefinition): RelationSchema {
    const relation = { ...partialJoint };
    const target = this.dataSource.getCollection(relation.foreignCollection);

    if (relation.type === 'ManyToOne') {
      relation.foreignKeyTarget ??= SchemaUtils.getPrimaryKeys(target.schema)[0];
    } else if (relation.type === 'OneToOne' || relation.type === 'OneToMany') {
      relation.originKeyTarget ??= SchemaUtils.getPrimaryKeys(this.schema)[0];
    } else if (relation.type === 'ManyToMany') {
      relation.originKeyTarget ??= SchemaUtils.getPrimaryKeys(this.schema)[0];
      relation.foreignKeyTarget ??= SchemaUtils.getPrimaryKeys(target.schema)[0];
    }

    return relation as RelationSchema;
  }

  private checkForeignKeys(relation: RelationSchema): void {
    if (relation.type === 'ManyToOne' || relation.type === 'ManyToMany') {
      RelationCollectionDecorator.checkKeys(
        relation.type === 'ManyToMany'
          ? this.dataSource.getCollection(relation.throughCollection)
          : this,
        this.dataSource.getCollection(relation.foreignCollection),
        relation.foreignKey,
        relation.foreignKeyTarget,
      );
    }
  }

  private checkOriginKeys(relation: RelationSchema): void {
    if (
      relation.type === 'OneToMany' ||
      relation.type === 'OneToOne' ||
      relation.type === 'ManyToMany'
    ) {
      RelationCollectionDecorator.checkKeys(
        relation.type === 'ManyToMany'
          ? this.dataSource.getCollection(relation.throughCollection)
          : this.dataSource.getCollection(relation.foreignCollection),
        this,
        relation.originKey,
        relation.originKeyTarget,
      );
    }
  }

  private static checkKeys(
    owner: Collection,
    targetOwner: Collection,
    keyName: string,
    targetName: string,
  ): void {
    RelationCollectionDecorator.checkColumn(owner, keyName);
    RelationCollectionDecorator.checkColumn(targetOwner, targetName);

    const key = owner.schema.fields[keyName] as ColumnSchema;
    const target = targetOwner.schema.fields[targetName] as ColumnSchema;

    if (key.columnType !== target.columnType) {
      throw new Error(
        `Types from '${owner.name}.${keyName}' and ` +
          `'${targetOwner.name}.${targetName}' do not match.`,
      );
    }
  }

  private static checkColumn(owner: Collection, name: string): void {
    const column = owner.schema.fields[name];

    if (!column || column.type !== 'Column') {
      throw new MissingFieldError(name, owner.name);
    }

    if (!column.filterOperators?.has('In')) {
      throw new Error(`Column does not support the In operator: '${owner.name}.${name}'`);
    }
  }

  private rewriteField(field: string): string[] {
    const prefix = field.split(':').shift();
    const schema = this.schema.fields[prefix];
    if (schema.type === 'Column') return [field];

    const relation = this.dataSource.getCollection(schema.foreignCollection);
    let result = [] as string[];

    if (!this.relations[prefix]) {
      result = relation
        .rewriteField(field.substring(prefix.length + 1))
        .map(subField => `${prefix}:${subField}`);
    } else if (schema.type === 'ManyToOne') {
      result = [schema.foreignKey];
    } else if (
      schema.type === 'OneToOne' ||
      schema.type === 'OneToMany' ||
      schema.type === 'ManyToMany'
    ) {
      result = [schema.originKeyTarget];
    }

    return result;
  }

  private async rewriteLeaf(caller: Caller, leaf: ConditionTreeLeaf): Promise<ConditionTree> {
    const prefix = leaf.field.split(':').shift();
    const schema = this.schema.fields[prefix];
    if (schema.type === 'Column') return leaf;

    const relation = this.dataSource.getCollection(schema.foreignCollection);
    const result = leaf as ConditionTree;

    if (!this.relations[prefix]) {
      return (await relation.rewriteLeaf(caller, leaf.unnest())).nest(prefix);
    }

    if (schema.type === 'ManyToOne') {
      const leafSchema = CollectionUtils.getFieldSchema(
        this.childCollection,
        schema.foreignKey,
      ) as ColumnSchema;

      if (leafSchema.filterOperators.has('NotIn') && leaf.operator === 'NotEqual') {
        // Possible optimization NotEqual
        // We compute the inverse list and use NotIn to build the relation with the target

        const records = await relation.list(
          caller,
          new Filter({ conditionTree: leaf.unnest().inverse() }),
          new Projection(schema.foreignKeyTarget),
        );

        return new ConditionTreeLeaf(schema.foreignKey, 'NotIn', [
          ...new Set(
            records
              .map(record => RecordUtils.getFieldValue(record, schema.foreignKeyTarget))
              .filter(v => v !== null),
          ),
        ]);
      }

      if (!leafSchema.filterOperators.has('NotIn') && leaf.operator === 'NotEqual') {
        console.warn(
          `Performances could be improved by implementing the NotIn operator on ${schema.foreignKey} (use replaceFieldOperator)`,
        );
      }

      const records = await relation.list(
        caller,
        new Filter({ conditionTree: leaf.unnest() }),
        new Projection(schema.foreignKeyTarget),
      );

      return new ConditionTreeLeaf(schema.foreignKey, 'In', [
        ...new Set(
          records
            .map(record => RecordUtils.getFieldValue(record, schema.foreignKeyTarget))
            .filter(v => v !== null),
        ),
      ]);
    }

    if (schema.type === 'OneToOne') {
      const records = await relation.list(
        caller,
        new Filter({ conditionTree: leaf.unnest() }),
        new Projection(schema.originKey),
      );

      return new ConditionTreeLeaf(schema.originKeyTarget, 'In', [
        ...new Set(
          records
            .map(record => RecordUtils.getFieldValue(record, schema.originKey))
            .filter(v => v !== null),
        ),
      ]);
    }

    return result;
  }

  private async reprojectInPlace(
    caller: Caller,
    records: RecordData[],
    projection: Projection,
  ): Promise<void> {
    const promises = Object.entries(projection.relations).map(async ([prefix, subProjection]) =>
      this.reprojectRelationInPlace(caller, records, prefix, subProjection),
    );

    await Promise.all(promises);
  }

  private async reprojectRelationInPlace(
    caller: Caller,
    records: RecordData[],
    name: string,
    projection: Projection,
  ): Promise<void> {
    const schema = this.schema.fields[name] as RelationSchema;
    const association = this.dataSource.getCollection(schema.foreignCollection);

    if (!this.relations[name]) {
      await association.reprojectInPlace(
        caller,
        records.map(r => r[name]).filter(Boolean) as RecordData[],
        projection,
      );
    } else if (schema.type === 'ManyToOne') {
      const ids = records.map(record => record[schema.foreignKey]).filter(fk => fk !== null);
      const subFilter = new Filter({
        conditionTree: new ConditionTreeLeaf(schema.foreignKeyTarget, 'In', [...new Set(ids)]),
      });
      const subRecords = await association.list(
        caller,
        subFilter,
        projection.union([schema.foreignKeyTarget]),
      );

      for (const record of records) {
        record[name] = subRecords.find(
          sr => sr[schema.foreignKeyTarget] === record[schema.foreignKey],
        );
      }
    } else if (schema.type === 'OneToOne' || schema.type === 'OneToMany') {
      const ids = records.map(record => record[schema.originKeyTarget]).filter(okt => okt !== null);
      const subFilter = new Filter({
        conditionTree: new ConditionTreeLeaf(schema.originKey, 'In', [...new Set(ids)]),
      });
      const subRecords = await association.list(
        caller,
        subFilter,
        projection.union([schema.originKey]),
      );

      for (const record of records) {
        record[name] = subRecords.find(
          sr => sr[schema.originKey] === record[schema.originKeyTarget],
        );
      }
    }
  }
}

// eslint-disable-next-line max-classes-per-file
import {
  AggregateResult,
  Aggregation,
  Caller,
  Collection,
  CollectionDecorator,
  CollectionSchema,
  ColumnSchema,
  ConditionTree,
  ConditionTreeLeaf,
  DataSourceDecorator,
  FieldValidator,
  Filter,
  PaginatedFilter,
  Projection,
  RecordData,
  RecordUtils,
  RelationSchema,
  SchemaUtils,
} from '@forestadmin/datasource-toolkit';
import { resolve } from 'path';

import computeFromRecords from './helpers/compute-fields';
import { ComputedDefinition, RelationDefinition } from './types';
import CollectionCustomizationContext from '../../context/collection-context';

class MapWithDefault<K, V> extends Map<K, V> {
  default: () => V;

  constructor(defaultFunction) {
    super();
    this.default = defaultFunction;
  }

  override get(key) {
    if (!this.has(key)) {
      this.set(key, this.default());
    }

    return super.get(key);
  }
}

/** Decorator injects computed fields */
export default class ComputedCollection extends CollectionDecorator {
  override readonly dataSource: DataSourceDecorator<ComputedCollection>;
  protected computeds: Record<string, ComputedDefinition> = {};
  protected relations: Record<string, RelationSchema> = {};

  public registerComputed(name: string, computed: ComputedDefinition): void {
    FieldValidator.validateName(this.name, name);

    // Check that all dependencies exist and are columns
    for (const field of computed.dependencies) {
      FieldValidator.validate(this, field);
    }

    if (computed.dependencies.length <= 0) {
      throw new Error(`Computed field '${this.name}.${name}' must have at least one dependency.`);
    }

    this.computeds[name] = computed;
    this.markSchemaAsDirty();
  }

  public addRelation(name: string, partialJoint: RelationDefinition): void {
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
    try {
      const dependencyMap = new MapWithDefault<string, { dependencies: Set<string>; resolve: any }>(
        () => ({ dependencies: new Set(), resolve: {} }),
      );
      // Build the dependency tree for this projection
      this.buildTree(projection, dependencyMap);

      const datasourceProjection = new Projection();

      for (const [fieldName, resolver] of dependencyMap.entries()) {
        if (resolver.dependencies.size === 1 && resolver.dependencies.has(fieldName))
          datasourceProjection.push(fieldName);
      }

      const records = await this.childCollection.list(caller, filter, datasourceProjection);
      if (datasourceProjection.equals(projection)) return records;

      const context = new CollectionCustomizationContext(this, caller);

      return await computeFromRecords(context, this, datasourceProjection, projection, records);
    } catch (err) {
      console.error(err);
    }
  }

  override async aggregate(
    caller: Caller,
    filter: Filter,
    aggregation: Aggregation,
    limit?: number,
  ): Promise<AggregateResult[]> {
    // No computed are used in the aggregation => just delegate to the underlying DS.
    // No emulated relations are used in the aggregation => just delegate to the underlying DS.
    if (
      !aggregation.projection.some(field => this.getComputed(field)) &&
      Object.keys(aggregation.projection.relations).every(prefix => !this.relations[prefix])
    ) {
      return this.childCollection.aggregate(caller, filter, aggregation, limit);
    }

    // Fallback to full emulation.
    return aggregation.apply(
      await this.list(caller, filter, aggregation.projection),
      caller.timezone,
      limit,
    );
  }

  protected override refineSchema(childSchema: CollectionSchema): CollectionSchema {
    const schema = { ...childSchema, fields: { ...childSchema.fields } };

    for (const [name, computed] of Object.entries(this.computeds)) {
      schema.fields[name] = {
        columnType: computed.columnType,
        defaultValue: computed.defaultValue,
        enumValues: computed.enumValues,
        filterOperators: new Set(),
        isPrimaryKey: false,
        isReadOnly: true,
        isSortable: false,
        type: 'Column',
      };
    }

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

  private buildTree(
    projections: Projection,
    dependencyMap: MapWithDefault<string, { dependencies: Set<string>; resolve: any }>,
  ) {
    // TODO look at projection.columns projection.relations

    const dependencyTree = projections.reduce((acc, projection) => {
      // avoid recompute dependencies
      if (acc.has(projection)) return acc;

      // A relation
      if (projection.includes(':')) {
        const relationName = projection.split(':').shift();
        const currentRelationResolver = acc.get(relationName);

        const schema = this.schema.fields[relationName] as RelationSchema;

        // Is it computed ?
        if (this.relations[relationName]) {
          // dependencies due to keys
          switch (schema.type) {
            case 'OneToOne':
            case 'OneToMany':
              currentRelationResolver.dependencies.add(schema.originKeyTarget);
              break;

            case 'ManyToOne':
            default:
              currentRelationResolver.dependencies.add(schema.foreignKey);
          }

          this.buildTree([...currentRelationResolver.dependencies] as Projection, dependencyMap);

          currentRelationResolver.projection.push(projection.split(':')[0]);

          // What about projection sub Projections ??? projection.relations[relationName]
          // I know that not this collection but still we could query computed yes and it will be handle by his ComputedCollection.
        }
        // Or native
        else {
          currentRelationResolver.dependencies.add(projection);
          // What about projection sub Projections ??? projection.relations[relationName]
          // I know that not this collection but still we could query computed yes and it will be handle by his ComputedCollection.
        }
      }
      // A field
      else {
        const currentFieldResolver = acc.get(projection);

        // Is it computed ?
        if (this.computeds[projection]) {
          this.computeds[projection].dependencies.forEach(item =>
            currentFieldResolver.dependencies.add(item),
          );

          this.buildTree(this.computeds[projection].dependencies as Projection, dependencyMap);
        }
        // Or native
        else {
          currentFieldResolver.dependencies.add(projection);
        }
      }

      return acc;
    }, dependencyMap);

    return dependencyTree;
  }

  /** @internal */
  getComputed(path: string): ComputedDefinition {
    const index = path.indexOf(':');
    if (index === -1) return this.computeds[path];

    const { foreignCollection } = this.schema.fields[path.substring(0, index)] as RelationSchema;
    const association = this.dataSource.getCollection(foreignCollection);

    return association.getComputed(path.substring(index + 1));
  }

  // ---- Relations definition validation

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
      this.checkKeys(
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
      this.checkKeys(
        relation.type === 'ManyToMany'
          ? this.dataSource.getCollection(relation.throughCollection)
          : this.dataSource.getCollection(relation.foreignCollection),
        this,
        relation.originKey,
        relation.originKeyTarget,
      );
    }
  }

  private checkKeys(
    owner: Collection,
    targetOwner: Collection,
    keyName: string,
    targetName: string,
  ): void {
    this.checkColumn(owner, keyName);
    this.checkColumn(targetOwner, targetName);

    const key = owner.schema.fields[keyName] as ColumnSchema;
    const target = targetOwner.schema.fields[targetName] as ColumnSchema;

    if (key.columnType !== target.columnType) {
      throw new Error(
        `Types from '${owner.name}.${keyName}' and ` +
          `'${targetOwner.name}.${targetName}' do not match.`,
      );
    }
  }

  private checkColumn(owner: Collection, name: string): void {
    const column = owner.schema.fields[name];

    if (!column || column.type !== 'Column') {
      throw new Error(`Column not found: '${owner.name}.${name}'`);
    }

    // Pitrerie
    if (!column.filterOperators?.has('In') && !this.getComputed(name)) {
      throw new Error(`Column does not support the In operator: '${owner.name}.${name}'`);
    }
  }

  // Filtering

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
    let result = leaf as ConditionTree;

    if (!this.relations[prefix]) {
      result = (await relation.rewriteLeaf(caller, leaf.unnest())).nest(prefix);
    } else if (schema.type === 'ManyToOne') {
      const records = await relation.list(
        caller,
        new Filter({ conditionTree: leaf.unnest() }),
        new Projection(schema.foreignKeyTarget),
      );

      result = new ConditionTreeLeaf(schema.foreignKey, 'In', [
        ...new Set(
          records
            .map(record => RecordUtils.getFieldValue(record, schema.foreignKeyTarget))
            .filter(v => v !== null),
        ),
      ]);
    } else if (schema.type === 'OneToOne') {
      const records = await relation.list(
        caller,
        new Filter({ conditionTree: leaf.unnest() }),
        new Projection(schema.originKey),
      );

      result = new ConditionTreeLeaf(schema.originKeyTarget, 'In', [
        ...new Set(
          records
            .map(record => RecordUtils.getFieldValue(record, schema.originKey))
            .filter(v => v !== null),
        ),
      ]);
    }

    return result;
  }

  private async relationResolver(
    caller: Caller,
    records: RecordData[],
    name: string,
    projection: Projection,
  ): Promise<void> {
    const schema = this.schema.fields[name] as RelationSchema;
    const association = this.dataSource.getCollection(schema.foreignCollection);

    if (!this.relations[name]) {
      console.log('WHY AM I EVEN HERE ???');
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

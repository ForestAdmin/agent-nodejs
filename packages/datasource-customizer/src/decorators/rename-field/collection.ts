import {
  AggregateResult,
  Aggregation,
  Caller,
  CollectionDecorator,
  CollectionSchema,
  DataSourceDecorator,
  FieldSchema,
  FieldValidator,
  Filter,
  PaginatedFilter,
  Projection,
  RecordData,
  SchemaUtils,
} from '@forestadmin/datasource-toolkit';

/**
 * This decorator renames fields.
 *
 * It works on one side, by rewriting all references to fields in aggregations, filters, projections
 * and on the other, by rewriting records and aggregation results which are returned by the
 * subCollection.
 */
export default class RenameFieldCollectionDecorator extends CollectionDecorator {
  override readonly dataSource: DataSourceDecorator<RenameFieldCollectionDecorator>;

  private readonly fromChildCollection: { [subName: string]: string } = {};
  private readonly toChildCollection: { [thisName: string]: string } = {};

  /** Rename a field from the collection */
  renameField(currentName: string, newName: string): void {
    SchemaUtils.throwIfMissingField(this.schema, currentName, this.name);

    let initialName = currentName;

    FieldValidator.validateName(this.name, newName);

    // Revert previous renaming (avoids conflicts and need to recurse on this.toSubCollection).
    if (this.toChildCollection[currentName]) {
      const childName = this.toChildCollection[currentName];
      delete this.toChildCollection[currentName];
      delete this.fromChildCollection[childName];
      initialName = childName;
      this.markAllSchemaAsDirty();
    }

    // Do not update arrays if renaming is a no-op (ie: customer is cancelling a previous rename).
    if (initialName !== newName) {
      this.fromChildCollection[initialName] = newName;
      this.toChildCollection[newName] = initialName;
      this.markAllSchemaAsDirty();
    }
  }

  protected override refineSchema(childSchema: CollectionSchema): CollectionSchema {
    const fields: Record<string, FieldSchema> = {};

    for (const [oldName, oldSchema] of Object.entries(childSchema.fields)) {
      const schema = { ...oldSchema };

      if (schema.type === 'ManyToOne') {
        const relation = this.dataSource.getCollection(schema.foreignCollection);
        schema.foreignKey = this.fromChildCollection[schema.foreignKey] ?? schema.foreignKey;
        schema.foreignKeyTarget =
          relation.fromChildCollection[schema.foreignKeyTarget] ?? schema.foreignKeyTarget;
      } else if (schema.type === 'OneToMany' || schema.type === 'OneToOne') {
        const relation = this.dataSource.getCollection(schema.foreignCollection);
        schema.originKey = relation.fromChildCollection[schema.originKey] ?? schema.originKey;
        schema.originKeyTarget =
          this.fromChildCollection[schema.originKeyTarget] ?? schema.originKeyTarget;
      } else if (schema.type === 'ManyToMany') {
        const through = this.dataSource.getCollection(schema.throughCollection);
        const relation = this.dataSource.getCollection(schema.foreignCollection);
        schema.foreignKey = through.fromChildCollection[schema.foreignKey] ?? schema.foreignKey;
        schema.originKey = through.fromChildCollection[schema.originKey] ?? schema.originKey;
        schema.originKeyTarget =
          this.fromChildCollection[schema.originKeyTarget] ?? schema.originKeyTarget;
        schema.foreignKeyTarget =
          relation.fromChildCollection[schema.foreignKeyTarget] ?? schema.foreignKeyTarget;
      }

      fields[this.fromChildCollection[oldName] ?? oldName] = schema;
    }

    return { ...childSchema, fields };
  }

  protected override async refineFilter(
    caller: Caller,
    filter?: PaginatedFilter,
  ): Promise<PaginatedFilter> {
    return filter?.override({
      conditionTree: filter.conditionTree?.replaceFields(field =>
        this.pathToChildCollection(field),
      ),
      sort: filter.sort?.replaceClauses(clause => ({
        field: this.pathToChildCollection(clause.field),
        ascending: clause.ascending,
      })),
    });
  }

  override async create(caller: Caller, records: RecordData[]): Promise<RecordData[]> {
    const newRecords = await super.create(
      caller,
      records.map(record => this.recordToChildCollection(record)),
    );

    return newRecords.map(record => this.recordFromChildCollection(record));
  }

  override async list(
    caller: Caller,
    filter: PaginatedFilter,
    projection: Projection,
  ): Promise<RecordData[]> {
    const childProjection = projection.replace(field => this.pathToChildCollection(field));
    const records = await super.list(caller, filter, childProjection);
    if (childProjection.equals(projection)) return records;

    return records.map(record => this.recordFromChildCollection(record));
  }

  override async update(caller: Caller, filter: Filter, patch: RecordData): Promise<void> {
    return super.update(caller, filter, this.recordToChildCollection(patch));
  }

  override async aggregate(
    caller: Caller,
    filter: Filter,
    aggregation: Aggregation,
    limit?: number,
  ): Promise<AggregateResult[]> {
    const rows = await super.aggregate(
      caller,
      filter,
      aggregation.replaceFields(f => this.pathToChildCollection(f)),
      limit,
    );

    return rows.map(row => ({
      value: row.value,
      group: Object.entries(row.group).reduce(
        (memo, [path, value]) => ({ ...memo, [this.pathFromChildCollection(path)]: value }),
        {},
      ),
    }));
  }

  private markAllSchemaAsDirty(): void {
    for (const collection of this.dataSource.collections) {
      collection.markSchemaAsDirty();
    }
  }

  /** Convert field path from child collection to this collection */
  private pathFromChildCollection(childPath: string): string {
    if (childPath.includes(':')) {
      const dotIndex = childPath.indexOf(':');
      const childField = childPath.substring(0, dotIndex);
      const thisField = this.fromChildCollection[childField] ?? childField;
      const schema = SchemaUtils.getRelation(this.schema, thisField, this.name);
      const relation = this.dataSource.getCollection(schema.foreignCollection);

      return `${thisField}:${relation.pathFromChildCollection(childPath.substring(dotIndex + 1))}`;
    }

    return this.fromChildCollection[childPath] ?? childPath;
  }

  /** Convert field path from this collection to child collection */
  private pathToChildCollection(thisPath: string): string {
    if (thisPath.includes(':')) {
      const dotIndex = thisPath.indexOf(':');
      const thisField = thisPath.substring(0, dotIndex);
      const schema = SchemaUtils.getRelation(this.schema, thisField, this.name);
      const relation = this.dataSource.getCollection(schema.foreignCollection);
      const childField = this.toChildCollection[thisField] ?? thisField;

      return `${childField}:${relation.pathToChildCollection(thisPath.substring(dotIndex + 1))}`;
    }

    return this.toChildCollection[thisPath] ?? thisPath;
  }

  /** Convert record from this collection to the child collection */
  private recordToChildCollection(thisRecord: RecordData): RecordData {
    const childRecord: RecordData = {};

    for (const [thisField, value] of Object.entries(thisRecord)) {
      childRecord[this.toChildCollection[thisField] ?? thisField] = value;
    }

    return childRecord;
  }

  /** Convert record from the child collection to this collection */
  private recordFromChildCollection(childRecord: RecordData): RecordData {
    const { schema } = this;
    const thisRecord: RecordData = {};

    for (const [childField, value] of Object.entries(childRecord)) {
      const thisField = this.fromChildCollection[childField] ?? childField;
      const fieldSchema = SchemaUtils.getField(schema, thisField, this.name);

      // Perform the mapping, recurse for relations.
      if (fieldSchema.type === 'Column') {
        thisRecord[thisField] = value;
      } else if (value === null) {
        thisRecord[thisField] = value;
      } else {
        const relation = this.dataSource.getCollection(fieldSchema.foreignCollection);
        thisRecord[thisField] = relation.recordFromChildCollection(value as RecordData);
      }
    }

    return thisRecord;
  }
}

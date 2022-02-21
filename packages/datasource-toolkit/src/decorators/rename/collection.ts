import { CollectionSchema, FieldSchema, FieldTypes, RelationSchema } from '../../interfaces/schema';
import { CompositeId, RecordData } from '../../interfaces/record';
import Aggregation, { AggregateResult } from '../../interfaces/query/aggregation';
import CollectionDecorator from '../collection-decorator';
import DataSourceDecorator from '../datasource-decorator';
import Filter from '../../interfaces/query/filter/unpaginated';
import PaginatedFilter from '../../interfaces/query/filter/paginated';
import Projection from '../../interfaces/query/projection';

/**
 * This decorator renames fields.
 *
 * It works on one side, by rewriting all references to fields in aggregations, filters, projections
 * and on the other, by rewriting records and aggregation results which are returned by the
 * subCollection.
 */
export default class RenameCollectionDecorator extends CollectionDecorator {
  override readonly dataSource: DataSourceDecorator<RenameCollectionDecorator>;

  private readonly fromChildCollection: { [subName: string]: string } = {};
  private readonly toChildCollection: { [thisName: string]: string } = {};

  /** Rename a field from the collection */
  renameField(currentName: string, newName: string): void {
    if (!this.schema.fields[currentName]) {
      throw new Error(`No such field '${currentName}'`);
    }

    let initialName = currentName;

    // Revert previous renaming (avoids conflicts and need to recurse on this.toSubCollection).
    if (this.toChildCollection[currentName]) {
      const childName = this.toChildCollection[currentName];
      delete this.toChildCollection[currentName];
      delete this.fromChildCollection[childName];
      initialName = childName;
    }

    // Do not update arrays if renaming is a no-op (ie: customer is cancelling a previous rename).
    if (initialName !== newName) {
      this.fromChildCollection[initialName] = newName;
      this.toChildCollection[newName] = initialName;
    }
  }

  protected refineSchema(childSchema: CollectionSchema): CollectionSchema {
    const fields: Record<string, FieldSchema> = {};

    for (const [oldName, oldSchema] of Object.entries(childSchema.fields)) {
      const schema = { ...oldSchema };

      if (schema.type === FieldTypes.ManyToOne) {
        schema.foreignKey = this.fromChildCollection[schema.foreignKey] ?? schema.foreignKey;
      } else if (schema.type === FieldTypes.OneToMany || schema.type === FieldTypes.OneToOne) {
        const relation = this.dataSource.getCollection(schema.foreignCollection);
        schema.foreignKey = relation.fromChildCollection[schema.foreignKey] ?? schema.foreignKey;
      } else if (schema.type === FieldTypes.ManyToMany) {
        const through = this.dataSource.getCollection(schema.throughCollection);
        schema.foreignKey = through.fromChildCollection[schema.foreignKey] ?? schema.foreignKey;
        schema.otherField = through.fromChildCollection[schema.otherField] ?? schema.otherField;
      }

      fields[this.fromChildCollection[oldName] ?? oldName] = schema;
    }

    return { ...childSchema, fields };
  }

  protected override async refineFilter(filter?: PaginatedFilter): Promise<PaginatedFilter> {
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

  override async getById(id: CompositeId, projection: Projection): Promise<RecordData> {
    const childProjection = projection.replace(field => this.pathToChildCollection(field));
    const record = await this.childCollection.getById(id, childProjection);

    return record ? this.recordFromChildCollection(record) : null;
  }

  override async create(records: RecordData[]): Promise<RecordData[]> {
    const newRecords = await super.create(
      records.map(record => this.recordToChildCollection(record)),
    );

    return newRecords.map(record => this.recordFromChildCollection(record));
  }

  override async list(filter: PaginatedFilter, projection: Projection): Promise<RecordData[]> {
    const childProjection = projection.replace(field => this.pathToChildCollection(field));
    const records = await super.list(filter, childProjection);

    return records.map(record => this.recordFromChildCollection(record));
  }

  override async update(filter: Filter, patch: RecordData): Promise<void> {
    return super.update(filter, this.recordToChildCollection(patch));
  }

  override async aggregate(
    filter: Filter,
    aggregation: Aggregation,
    limit?: number,
  ): Promise<AggregateResult[]> {
    const rows = await super.aggregate(
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

  /** Convert field path from child collection to this collection */
  private pathFromChildCollection(childPath: string): string {
    if (childPath.includes(':')) {
      const dotIndex = childPath.indexOf(':');
      const childField = childPath.substring(0, dotIndex);
      const thisField = this.fromChildCollection[childField] ?? childField;
      const schema = this.schema.fields[thisField] as RelationSchema;
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
      const schema = this.schema.fields[thisField] as RelationSchema;
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
      const fieldSchema = schema.fields[thisField];

      // Perform the mapping, recurse for relations.
      if (fieldSchema.type === FieldTypes.Column) {
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

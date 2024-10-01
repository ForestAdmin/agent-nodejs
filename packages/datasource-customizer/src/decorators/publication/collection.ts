import {
  Caller,
  CollectionDecorator,
  CollectionSchema,
  FieldSchema,
  RecordData,
  SchemaUtils,
} from '@forestadmin/datasource-toolkit';

import PublicationDataSourceDecorator from './datasource';

/** This decorator allows hiding fields */
export default class PublicationCollectionDecorator extends CollectionDecorator {
  override readonly dataSource: PublicationDataSourceDecorator;
  private readonly blacklist: Set<string> = new Set();

  /** Show/hide fields from the schema */
  changeFieldVisibility(name: string, visible: boolean): void {
    SchemaUtils.checkMissingField(this.childCollection.schema, name, this.childCollection.name);

    if (SchemaUtils.isPrimaryKey(this.childCollection.schema, name)) {
      throw new Error(`Cannot hide primary key`);
    }

    if (!visible) this.blacklist.add(name);
    else this.blacklist.delete(name);
    this.markSchemaAsDirty();
  }

  override async create(caller: Caller, data: RecordData[]): Promise<RecordData[]> {
    const records = await super.create(caller, data);

    return records.map(childRecord => {
      const record = {};

      for (const key of Object.keys(childRecord)) {
        if (!this.blacklist.has(key)) record[key] = childRecord[key];
      }

      return record;
    });
  }

  protected override refineSchema(childSchema: CollectionSchema): CollectionSchema {
    const fields: Record<string, FieldSchema> = {};

    for (const [name, field] of Object.entries(childSchema.fields)) {
      if (this.isPublished(name)) {
        fields[name] = field;
      }
    }

    return { ...childSchema, fields };
  }

  private isPublished(name: string): boolean {
    // Explicitly hidden
    if (this.blacklist.has(name)) return false;

    // Implicitly hidden
    const field = SchemaUtils.getField(
      this.childCollection.schema,
      name,
      this.childCollection.name,
    );

    if (field.type === 'ManyToOne') {
      return (
        this.dataSource.isPublished(field.foreignCollection) &&
        this.isPublished(field.foreignKey) &&
        this.dataSource.getCollection(field.foreignCollection).isPublished(field.foreignKeyTarget)
      );
    }

    if (field.type === 'OneToOne' || field.type === 'OneToMany') {
      return (
        this.dataSource.isPublished(field.foreignCollection) &&
        this.dataSource.getCollection(field.foreignCollection).isPublished(field.originKey) &&
        this.isPublished(field.originKeyTarget)
      );
    }

    if (field.type === 'ManyToMany') {
      return (
        this.dataSource.isPublished(field.throughCollection) &&
        this.dataSource.isPublished(field.foreignCollection) &&
        this.dataSource.getCollection(field.throughCollection).isPublished(field.foreignKey) &&
        this.dataSource.getCollection(field.throughCollection).isPublished(field.originKey) &&
        this.isPublished(field.originKeyTarget) &&
        this.dataSource.getCollection(field.foreignCollection).isPublished(field.foreignKeyTarget)
      );
    }

    return true;
  }

  public override markSchemaAsDirty(): void {
    return super.markSchemaAsDirty();
  }
}

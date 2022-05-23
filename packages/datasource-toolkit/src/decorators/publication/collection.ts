import { Caller } from '../../interfaces/caller';
import { CollectionSchema, FieldSchema } from '../../interfaces/schema';
import { RecordData } from '../../interfaces/record';
import CollectionDecorator from '../collection-decorator';
import DataSourceDecorator from '../datasource-decorator';

/** This decorator allows hiding fields */
export default class PublicationCollectionDecorator extends CollectionDecorator {
  override readonly dataSource: DataSourceDecorator<PublicationCollectionDecorator>;
  private readonly unpublished: Set<string> = new Set();

  /** Show/hide fields from the schema */
  changeFieldVisibility(name: string, visible: boolean): void {
    const field = this.childCollection.schema.fields[name];

    if (!field) {
      throw new Error(`No such field '${name}'`);
    }

    if (field.type === 'Column' && field.isPrimaryKey) {
      throw new Error(`Cannot hide primary key`);
    }

    if (!visible) this.unpublished.add(name);
    else this.unpublished.delete(name);
    this.markSchemaAsDirty();
  }

  override async create(caller: Caller, data: RecordData[]): Promise<RecordData[]> {
    const records = await super.create(caller, data);

    return records.map(childRecord => {
      const record = {};
      for (const key of Object.keys(childRecord))
        if (!this.unpublished.has(key)) record[key] = childRecord[key];

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
    const field = this.childCollection.schema.fields[name];

    return (
      !this.unpublished.has(name) &&
      // Columns have no special requirements
      (field.type === 'Column' ||
        // Many to one, one to one and one to many need the foreign key to be published
        (field.type === 'ManyToOne' && this.isPublished(field.foreignKey)) ||
        ((field.type === 'OneToOne' || field.type === 'OneToMany') &&
          this.dataSource.getCollection(field.foreignCollection).isPublished(field.originKey)) ||
        // Many to many relations depend on both foreignKey and originKey to be published
        (field.type === 'ManyToMany' &&
          this.dataSource.getCollection(field.throughCollection).isPublished(field.foreignKey) &&
          this.dataSource.getCollection(field.throughCollection).isPublished(field.originKey)))
    );
  }
}

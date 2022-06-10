import { CollectionSchema, FieldSchema } from '../../interfaces/schema';
import CollectionDecorator from '../collection-decorator';
import DataSourceDecorator from '../datasource-decorator';

/**
 * This decorator renames the collection name.
 */
export default class RenameCollectionCollectionDecorator extends CollectionDecorator {
  override readonly dataSource: DataSourceDecorator<RenameCollectionCollectionDecorator>;

  private substitutedName: string;

  override get name() {
    return this.substitutedName || this.childCollection.name;
  }

  /** Rename the collection name  */
  rename(name: string): void {
    this.substitutedName = name;
  }

  protected override refineSchema(childSchema: CollectionSchema): CollectionSchema {
    const fields: Record<string, FieldSchema> = {};

    for (const [name, oldSchema] of Object.entries(childSchema.fields)) {
      const schema = { ...oldSchema };

      if (schema.type === 'ManyToOne') {
        const relation = this.dataSource.getCollection(schema.foreignCollection);
        schema.foreignCollection = relation.name;
      } else if (schema.type === 'OneToMany' || schema.type === 'OneToOne') {
        const relation = this.dataSource.getCollection(schema.foreignCollection);
        schema.foreignCollection = relation.name;
      } else if (schema.type === 'ManyToMany') {
        const through = this.dataSource.getCollection(schema.throughCollection);
        const relation = this.dataSource.getCollection(schema.foreignCollection);
        schema.throughCollection = through.name;
        schema.foreignCollection = relation.name;
      }

      fields[name] = schema;
    }

    return { ...childSchema, fields };
  }
}

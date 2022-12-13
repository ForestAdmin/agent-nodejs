import type {
  CollectionCustomizer,
  DataSourceCustomizer,
} from '@forestadmin/datasource-customizer';
import type { CollectionSchema, FieldSchema } from '@forestadmin/datasource-toolkit';

export function getFields(schema: CollectionSchema, types: FieldSchema['type'][]): Set<string> {
  return new Set(
    Object.keys(schema.fields).filter(name => types.includes(schema.fields[name].type)),
  );
}

export function getSchema(
  path: string,
  dataSource: DataSourceCustomizer,
  collection: CollectionCustomizer,
): FieldSchema {
  const identifier = `'${collection.name}.${path}'`;
  const [name, ...nested] = path.split(':');
  const field = collection.schema.fields[name];

  if (!field) throw new Error(`Field ${identifier} not found`);
  if (nested.length === 0) return field;

  if (field?.type !== 'ManyToOne' && field?.type !== 'OneToOne') {
    let message: string;
    if (!field) message = `Relation ${identifier} not found`;
    else if (field.type === 'Column') message = `${identifier} is a column, not a relation`;
    else message = `${identifier} is not a ManyToOne or OneToOne relation`;

    throw new Error(message);
  }

  return getSchema(nested.join(':'), dataSource, dataSource.getCollection(field.foreignCollection));
}

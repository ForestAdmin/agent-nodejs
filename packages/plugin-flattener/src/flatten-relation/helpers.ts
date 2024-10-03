import type {
  CollectionCustomizer,
  DataSourceCustomizer,
} from '@forestadmin/datasource-customizer';

import { RelationSchema } from '@forestadmin/datasource-toolkit';

// eslint-disable-next-line import/prefer-default-export
export function getRelation(
  relationName: string,
  dataSource: DataSourceCustomizer,
  collection: CollectionCustomizer,
): RelationSchema {
  const [field, ...nested] = relationName.split(':');
  const relation = collection.schema.fields[field];

  if (relation?.type !== 'ManyToOne' && relation?.type !== 'OneToOne') {
    const name = `'${collection.name}.${relationName}'`;

    let message: string;
    if (!relation) message = `Relation ${name} not found`;
    else if (relation.type === 'Column') message = `${name} is a column, not a relation`;
    else message = `${name} is not a ManyToOne or OneToOne relation`;

    throw new Error(message);
  }

  return nested.length > 0
    ? getRelation(
        nested.join(':'),
        dataSource,
        dataSource.getCollection(relation.foreignCollection),
      )
    : relation;
}

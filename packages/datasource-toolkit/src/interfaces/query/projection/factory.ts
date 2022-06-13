import { Collection } from '../../collection';
import Projection from '.';

export default class ProjectionFactory {
  static all(collection: Collection): Projection {
    const schemaFields = collection.schema.fields;
    const projectionFields = Object.entries(schemaFields).reduce((memo, [columnName, column]) => {
      if (column.type === 'Column') {
        return [...memo, columnName];
      }

      if (column.type === 'OneToOne' || column.type === 'ManyToOne') {
        const relation = collection.dataSource.getCollection(column.foreignCollection);
        const relationFields = relation.schema.fields;

        return [
          ...memo,
          ...Object.keys(relationFields)
            .filter(relColumnName => relationFields[relColumnName].type === 'Column')
            .map(relColumnName => `${columnName}:${relColumnName}`),
        ];
      }

      return memo;
    }, [] as string[]);

    return new Projection(...projectionFields);
  }

  static columns(collection: Collection): Projection {
    return new Projection(
      ...Object.keys(collection.schema.fields).filter(
        f => collection.schema.fields[f].type === 'Column',
      ),
    );
  }
}

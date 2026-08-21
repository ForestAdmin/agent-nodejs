import type { Collection } from '@forestadmin/datasource-toolkit';

import { SchemaUtils } from '@forestadmin/datasource-toolkit';

export default class FieldPathUtils {
  static getLeafCollection(collection: Collection, path: string): Collection {
    const index = path.indexOf(':');

    if (index === -1) return collection;

    const relation = SchemaUtils.getRelation(
      collection.schema,
      path.substring(0, index),
      collection.name,
    );

    return FieldPathUtils.getLeafCollection(
      collection.dataSource.getCollection(relation.foreignCollection),
      path.substring(index + 1),
    );
  }
}

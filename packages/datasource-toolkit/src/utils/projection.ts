import SchemaUtils from './schema';
import { Collection } from '../interfaces/collection';
import { Projection } from '../interfaces/query/projection';
import FieldUtils from './field';

export default class ProjectionUtils {
  static validate(collection: Collection, projection: Projection): void {
    projection.forEach(field => FieldUtils.validate(collection, field));
  }

  private static withPks(collection: Collection, projection: Projection): Projection {
    const result = [...projection];

    SchemaUtils.getPrimaryKeys(collection.schema).forEach(pk => {
      if (!result.includes(pk)) result.push(pk);
    });

    return result;
  }
}

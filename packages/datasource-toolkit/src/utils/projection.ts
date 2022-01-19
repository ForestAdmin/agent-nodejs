import SchemaUtils from './schema';
import { Collection } from '../interfaces/collection';
import { Projection } from '../interfaces/query/projection';
import FieldUtils from './field';
import { FieldTypes } from '../interfaces/schema';

export default class ProjectionUtils {
  static validate(collection: Collection, projection: Projection): void {
    projection.forEach(field => FieldUtils.validate(collection, field));
  }

  private static groupByPrefix(projection: Projection): Record<string, Projection> {
    return projection.reduce((memo, field) => {
      const [prefix, ...rest] = field.split(':');
      const suffixes = rest.length ? [rest.join(':')] : [];

      return {
        ...memo,
        [prefix]: [...new Set([...(memo[prefix] ?? []), ...suffixes])],
      };
    }, {} as Record<string, Projection>);
  }

  static withPks(collection: Collection, projection: Projection): Projection {
    const grouped = ProjectionUtils.groupByPrefix(projection);
    const result = [...projection];

    for (const pk of SchemaUtils.getPrimaryKeys(collection.schema)) {
      if (!result.includes(pk)) result.push(pk);
    }

    for (const [prefix, suffixes] of Object.entries(grouped)) {
      const schema = collection.schema.fields[prefix];

      if (schema.type !== FieldTypes.Column) {
        const association = collection.dataSource.getCollection(schema.foreignCollection);
        const suffixesWithPk = ProjectionUtils.withPks(association, suffixes);

        for (const suffix of suffixesWithPk) {
          const pk = `${prefix}:${suffix}`;
          if (!result.includes(pk)) result.push(pk);
        }
      }
    }

    return result;
  }
}

import Projection from '../../../interfaces/query/projection';
import { RelationSchema } from '../../../interfaces/schema';
import ComputedCollection from '../collection';

export default function rewriteField(collection: ComputedCollection, path: string): Projection {
  // Projection is targeting a field on another collection => recurse.
  if (path.includes(':')) {
    const [prefix] = path.split(':');
    const schema = collection.schema.fields[prefix] as RelationSchema;
    const association = collection.dataSource.getCollection(schema.foreignCollection);

    return new Projection(path)
      .unnest()
      .replace(subPath => rewriteField(association, subPath))
      .nest(prefix);
  }

  // Computed field that we own: recursively replace by dependencies
  const computed = collection.getComputed(path);

  return computed
    ? computed.dependencies.replace(depPath => rewriteField(collection, depPath))
    : new Projection(path);
}

import { Projection, RelationSchema } from '@forestadmin/datasource-toolkit';

import ComputedCollection from '../collection';

export default function rewriteField(collection: ComputedCollection, path: string): Projection {
  // Projection is targeting a field on another collection => recurse.
  if (path.includes(':')) {
    const [prefix] = path.split(':');
    const schema = collection.schema.fields[prefix] as RelationSchema;

    if (!schema) {
      throw new Error(
        `Cannot find field "${prefix}" in collection "${collection.name}".\n` +
          `You are probably trying to access a field from a computed relationship.\n` +
          `Have you considered including the field's path in the externalDependencies property?`,
      );
    }

    const association = collection.dataSource.getCollection(schema.foreignCollection);

    return new Projection(path)
      .unnest()
      .replace(subPath => rewriteField(association, subPath))
      .nest(prefix);
  }

  // Computed field that we own: recursively replace by dependencies
  const computed = collection.getComputed(path);

  return computed
    ? new Projection(...computed.dependencies).replace(depPath => rewriteField(collection, depPath))
    : new Projection(path);
}

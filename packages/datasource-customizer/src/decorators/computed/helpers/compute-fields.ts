import { Projection, RecordData } from '@forestadmin/datasource-toolkit';

import CollectionCustomizationContext from '../../../context/collection-context';
import ComputedCollection from '../collection';
import { ComputedDefinition } from '../types';
import transformUniqueValues from '../utils/deduplication';
import { flatten, unflatten, withNullMarkers } from '../utils/flattener';

async function computeField(
  ctx: CollectionCustomizationContext,
  computed: ComputedDefinition,
  paths: string[],
  promises: Promise<unknown[]>[],
): Promise<unknown[]> {
  return transformUniqueValues(
    unflatten(await Promise.all(promises), paths),
    async uniquePartials => {
      const output = computed.getValues(uniquePartials, ctx);

      return Array.isArray(output) ? Promise.all(output) : output;
    },
  );
}

function queueField(
  ctx: CollectionCustomizationContext,
  collection: ComputedCollection,
  newPath: string,
  paths: string[],
  promises: Promise<unknown[]>[],
): void {
  // Skip double computations (we're not checking before adding to queue).
  if (!paths.includes(newPath)) {
    const computed = collection.getComputed(newPath);
    const computedDependencies = withNullMarkers(computed.dependencies);
    const nestedDependencies = new Projection(...computedDependencies).nest(
      newPath.includes(':') ? newPath.substring(0, newPath.lastIndexOf(':')) : null,
    );

    // Queue dependencies (so that computed can await them).
    nestedDependencies.forEach(path => queueField(ctx, collection, path, paths, promises));

    // Queue computed
    const dependencyValues = nestedDependencies.map(path => promises[paths.indexOf(path)]);

    paths.push(newPath);
    promises.push(computeField(ctx, computed, computedDependencies, dependencyValues));
  }
}

export default async function computeFromRecords(
  ctx: CollectionCustomizationContext,
  collection: ComputedCollection,
  recordsProjection: Projection,
  desiredProjection: Projection,
  records: RecordData[],
): Promise<RecordData[]> {
  // Format data for easy computation (one cell per path, with all values).
  const paths = withNullMarkers(recordsProjection);
  const promises = flatten(records, paths).map(values => Promise.resolve(values));

  // Queue all computations, and perform them all at once
  desiredProjection.forEach(path => queueField(ctx, collection, path, paths, promises));
  const values = await Promise.all(promises);

  // Quick reproject and unflatten.
  const finalProjection = withNullMarkers(desiredProjection);

  return unflatten(
    finalProjection.map(path => values[paths.indexOf(path)]),
    finalProjection,
  );
}

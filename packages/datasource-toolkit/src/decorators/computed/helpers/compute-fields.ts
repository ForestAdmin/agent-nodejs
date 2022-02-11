import { ComputedContext, ComputedDefinition } from '../types';
import { RecordData } from '../../../interfaces/record';
import { flatten, unflatten } from '../utils/flattener';
import ComputedCollection from '../collection';
import Projection from '../../../interfaces/query/projection';
import transformUniqueValues from '../utils/deduplication';

async function computeField(
  ctx: ComputedContext,
  computed: ComputedDefinition,
  paths: string[],
  promises: Promise<unknown[]>[],
): Promise<unknown[]> {
  return transformUniqueValues(
    unflatten(await Promise.all(promises), paths),
    async uniquePartials => computed.getValues(uniquePartials, ctx),
  );
}

function queueField(
  collection: ComputedCollection,
  newPath: string,
  paths: string[],
  promises: Promise<unknown[]>[],
): void {
  // Skip double computations (we're not checking before adding to queue).
  if (!paths.includes(newPath)) {
    const computed = collection.getComputed(newPath);
    const nestedDependencies = computed.dependencies.nest(
      newPath.includes(':') ? newPath.substring(0, newPath.lastIndexOf(':')) : null,
    );

    // Queue dependencies (so that computed can await them).
    nestedDependencies.forEach(path => queueField(collection, path, paths, promises));

    // Queue computed
    const ctx = { dataSource: collection.dataSource };
    const dependencyValues = nestedDependencies.map(path => promises[paths.indexOf(path)]);

    paths.push(newPath);
    promises.push(computeField(ctx, computed, computed.dependencies, dependencyValues));
  }
}

export default async function computeFromRecords(
  collection: ComputedCollection,
  recordsProjection: Projection,
  desiredProjection: Projection,
  records: RecordData[],
): Promise<RecordData[]> {
  // Format data for easy computation (one cell per path, with all values).
  const paths = recordsProjection.slice() as Projection;
  const promises = flatten(records, paths).map(values => Promise.resolve(values));

  // Queue all computations, and perform them all at once
  desiredProjection.forEach(path => queueField(collection, path, paths, promises));
  const values = await Promise.all(promises);

  // Quick reproject and unflatten.
  return unflatten(
    desiredProjection.map(path => values[paths.indexOf(path)]),
    desiredProjection,
  );
}

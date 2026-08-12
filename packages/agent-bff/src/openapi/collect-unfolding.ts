import type {
  CollectionFields,
  UnfoldedAction,
  UnfoldedCollection,
  UnfoldedRelation,
  Unfolding,
} from './unfolding';
import type { Logger } from '../ports/logger-port';
import type { CapabilitiesFetcher } from '../read-model/capabilities-cache';
import type ReadModel from '../read-model/read-model';
import type ReadModelStore from '../read-model/read-model-store';

import { extractErrorMessage } from '../errors';

// A cold document costs one capabilities call per collection. They are capped rather than fired all
// at once so a 200-collection deployment cannot open 200 sockets to the agent at the same time; a
// warm BFF pays nothing, the per-collection cache is shared with the data routes.
export const CAPABILITIES_CONCURRENCY = 10;

export interface CollectUnfoldingOptions {
  readModel: ReadModel;
  store: ReadModelStore;
  capabilitiesFetcher: CapabilitiesFetcher;
  logger: Logger;
  concurrency?: number;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  run: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  // Recursive rather than a while loop: each worker takes the next item only once the previous one
  // settled, which is what caps the concurrency.
  const worker = async (): Promise<void> => {
    if (cursor >= items.length) return;

    const index = cursor;
    cursor += 1;
    results[index] = await run(items[index]);

    await worker();
  };

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));

  return results;
}

const UNTYPED = (degraded: CollectionFields['degraded']): CollectionFields => ({
  projectable: [],
  filterable: [],
  degraded,
});

async function collectFields(
  collection: string,
  { store, capabilitiesFetcher, logger }: CollectUnfoldingOptions,
): Promise<CollectionFields> {
  try {
    const { capabilities } = await store.getCapabilities(collection, capabilitiesFetcher);

    if (capabilities.fields.length === 0) {
      logger('Warn', 'Documenting a collection without a field set: capabilities returned none', {
        collection,
      });

      return UNTYPED('no_fields');
    }

    return {
      projectable: capabilities.fields.map(field => field.name),
      filterable: capabilities.fields
        .filter(field => (field.operators?.length ?? 0) > 0)
        .map(field => field.name),
      degraded: null,
    };
  } catch (error) {
    // A single unreachable collection must not cost the whole document: the collection keeps its
    // paths, untyped. The alternative — dropping it — would hide a collection the runtime serves.
    logger('Warn', 'Documenting a collection without a field set: capabilities are unavailable', {
      collection,
      error: extractErrorMessage(error),
    });

    return UNTYPED('capabilities_unavailable');
  }
}

// A to-many relation pointing at a collection absent from the allow-list is dropped: the runtime
// answers 404 on it (data-routes-middleware checks the foreign collection), so documenting it would
// promise a dead path.
function collectRelations(readModel: ReadModel, collection: string): UnfoldedRelation[] {
  return readModel
    .getListableRelations(collection)
    .filter(relation => readModel.isCollectionAllowed(relation.foreignCollection))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function collectActions(readModel: ReadModel, collection: string): UnfoldedAction[] {
  const byName = readModel.getActionEndpoints()[collection] ?? {};

  return Object.keys(byName)
    .sort()
    .map(name => ({
      name,
      fields: (byName[name].fields ?? []).map(field => ({
        name: field.field,
        type: field.type,
        isRequired: field.isRequired === true,
        enums: field.enums ?? null,
      })),
    }));
}

/**
 * Collects everything the document unfolds. Sorted at every level so two runs over one schema
 * produce byte-identical documents — the route/CLI comparison depends on it.
 *
 * A schema refresh landing mid-collect can mix the new generation's field sets into this snapshot's
 * structure. Detecting it belongs to the caller, which knows whether the read-model it passed is
 * still the current one once this resolves.
 */
export default async function collectUnfolding(
  options: CollectUnfoldingOptions,
): Promise<Unfolding> {
  const { readModel, concurrency = CAPABILITIES_CONCURRENCY } = options;
  const names = readModel.getAllowedCollections().sort();
  const fields = await mapWithConcurrency(names, concurrency, name => collectFields(name, options));

  const collections: UnfoldedCollection[] = names.map((name, index) => ({
    name,
    fields: fields[index],
    primaryKeys: readModel.getPrimaryKeys(name),
    relations: collectRelations(readModel, name),
    actions: collectActions(readModel, name),
  }));

  return { collections };
}

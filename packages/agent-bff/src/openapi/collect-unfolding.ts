import type {
  CollectionFields,
  FilterableField,
  UnfoldedAction,
  UnfoldedCollection,
  UnfoldedRelation,
  Unfolding,
} from './unfolding';
import type { Logger } from '../ports/logger-port';
import type { CapabilitiesFetcher, CapabilitiesResult } from '../read-model/capabilities-cache';
import type ReadModel from '../read-model/read-model';
import type ReadModelStore from '../read-model/read-model-store';
import type { Operator } from '@forestadmin/datasource-toolkit';

import { extractErrorMessage } from '../errors';
import { normalizeFieldType } from '../read-model/field-type';
import { normalizeOperator, toCanonicalOperatorSet } from '../validation/operator-normalizer';

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

/**
 * The operators to document for one field, or null to leave the field out of the filterable set.
 *
 * An operator with no canonical mapping means the agent runs a newer operator set than this package.
 * The field is dropped rather than widened, because `capabilities-validator` normalizes a field's
 * WHOLE operator list before comparing the one that was sent: a skewed field answers 500
 * `mapping_error` on ANY filter, even a plain `Equal`. Documenting it as filterable would promise a
 * call the BFF never honours, and a raw snake_case operator must never reach the public document. The
 * skew is surfaced in the log instead — dropping the field keeps the document truthful, so it stays
 * cacheable.
 */
function documentedOperators(
  collection: string,
  field: string,
  operators: string[],
  logger: Logger,
): Operator[] | null {
  const normalized: Operator[] = [];

  for (const operator of operators) {
    const canonical = normalizeOperator(operator);

    if (!canonical) {
      logger('Warn', 'Documenting a field as not filterable: one of its operators has no mapping', {
        collection,
        field,
        operator,
      });

      return null;
    }

    normalized.push(canonical);
  }

  return toCanonicalOperatorSet(normalized);
}

function collectFilterableFields(
  collection: string,
  capabilities: CapabilitiesResult,
  logger: Logger,
): FilterableField[] {
  return capabilities.fields.flatMap(field => {
    if ((field.operators?.length ?? 0) === 0) return [];

    const operators = documentedOperators(
      collection,
      field.name,
      field.operators as string[],
      logger,
    );

    return operators === null ? [] : [{ name: field.name, operators }];
  });
}

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
      filterable: collectFilterableFields(collection, capabilities, logger),
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
  const listable = readModel
    .getListableRelations(collection)
    .filter(relation => readModel.isCollectionAllowed(relation.foreignCollection));

  // By name, in code-unit order like the collection and action levels — NOT `localeCompare`, which
  // follows the process locale: the route and the CLI could then order one schema's relations
  // differently and stop producing the same document.
  return listable.sort((left, right) =>
    left.name < right.name ? -1 : Number(left.name > right.name),
  );
}

function collectActions(readModel: ReadModel, collection: string): UnfoldedAction[] {
  const byName = readModel.getActionEndpoints()[collection] ?? {};

  return Object.keys(byName)
    .sort()
    .map(name => ({
      name,
      // A form field with no usable name is dropped: the schema is cast from untyped JSON, and the
      // read-model turns a malformed entry into `{}`, which would otherwise document a property
      // literally called "undefined".
      fields: (byName[name].fields ?? [])
        .filter(field => typeof field?.field === 'string')
        .map(field => ({
          name: field.field,
          type: normalizeFieldType(field.type),
          isRequired: field.isRequired === true,
          enums: field.enums ?? null,
          reference: (field as { reference?: string | null }).reference ?? null,
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

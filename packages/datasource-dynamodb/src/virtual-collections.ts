import type DynamoDBCollection from './collection';
import type DynamoDBDataSource from './datasource';
import type { AttributeSchema, VirtualCollectionConfig } from './types';
import type { Caller, Logger } from '@forestadmin/datasource-toolkit';

import {
  ConditionTreeLeaf,
  Page,
  PaginatedFilter,
  Projection,
} from '@forestadmin/datasource-toolkit';

import ArrayCollection from './array-collection';
import { DEFAULT_MAX_DEPTH, DEFAULT_SAMPLE_SIZE, inferSchema } from './introspection/introspector';

const SAMPLING_CALLER = { timezone: 'UTC' } as Caller;

/** The attributes of an item come from the schema when it declares them, else from a sample. */
async function itemSchemaOf(
  parent: DynamoDBCollection,
  arrayField: string,
  sampleSize: number,
): Promise<Record<string, AttributeSchema>> {
  const declared = parent.model.schema[arrayField]?.items;

  if (declared) return declared;

  const parents = await parent.list(
    SAMPLING_CALLER,
    new PaginatedFilter({
      conditionTree: new ConditionTreeLeaf(arrayField, 'Present'),
      page: new Page(0, sampleSize),
    }),
    new Projection(arrayField),
  );
  const items = parents
    .flatMap(record => (Array.isArray(record[arrayField]) ? (record[arrayField] as unknown[]) : []))
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object');

  return inferSchema(items, [], DEFAULT_MAX_DEPTH);
}

/** Adds one collection per configured array, each skipped with a warning if it cannot be built. */
export default async function addVirtualCollections(
  dataSource: DynamoDBDataSource,
  configs: VirtualCollectionConfig[],
  sampleSize: number = DEFAULT_SAMPLE_SIZE,
  logger?: Logger,
): Promise<void> {
  for (const config of configs) {
    try {
      const parent = dataSource.getCollection(config.parentCollection);

      if (parent instanceof ArrayCollection) {
        throw new Error('an array of an array cannot be exposed');
      }

      // eslint-disable-next-line no-await-in-loop
      const itemSchema = await itemSchemaOf(parent, config.arrayField, sampleSize);

      dataSource.addCollection(
        new ArrayCollection(dataSource, parent, {
          name: config.collectionName,
          arrayField: config.arrayField,
          itemSchema,
        }),
      );
    } catch (error) {
      logger?.(
        'Warn',
        `Skipping virtual collection '${config.collectionName}' for array ` +
          `'${config.parentCollection}.${config.arrayField}': ${error.message}`,
      );
    }
  }
}

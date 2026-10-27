import type { ConfigurationOptions } from './introspection/builder';
import type {
  DynamoDBClientOptions,
  DynamoDBSettingsOptions,
  Introspection,
  IntrospectionConfig,
  TableModel,
  VirtualCollectionConfig,
} from './types';
import type { DataSourceFactory, Logger } from '@forestadmin/datasource-toolkit';

import { ValidationError } from '@forestadmin/datasource-toolkit';

import createDocumentClient from './client';
import DynamoDBDataSource from './datasource';
import { DynamoDBDatasourceBuilder } from './introspection/builder';
import {
  DEFAULT_MAX_DEPTH,
  DEFAULT_SAMPLE_SIZE,
  introspectTables,
} from './introspection/introspector';
import { convertManualSchema, toDefinition } from './schema/manual-schema';
import { resolveSettings } from './settings';
import { INTROSPECTION_VERSION } from './types';
import PaginationCache from './utils/pagination-cache';
import addVirtualCollections from './virtual-collections';

export { default as DynamoDBCollection } from './collection';
export { default as ArrayCollection } from './array-collection';
export { default as DynamoDBDataSource } from './datasource';
export { ScanDeniedError, ScanLimitExceededError, OffsetTooDeepError } from './errors';
export type {
  ConfigurationOptions,
  DynamoDBDatasourceOptionsBuilder,
  TableCollectionOptions,
} from './introspection/builder';
export type {
  CollectionDefinition,
  DynamoDBClientOptions,
  DynamoDBSettingsOptions,
  EntityDefinition,
  FieldDefinition,
  IndexDefinition,
  Introspection,
  IntrospectionConfig,
  ManualSchemaConfig,
  ScanPolicy,
  VirtualCollectionConfig,
} from './types';

export type DynamoDBDataSourceOptions = DynamoDBClientOptions &
  DynamoDBSettingsOptions & {
    /**
     * Tables to introspect, instead of every table of the account and region. An empty list
     * introspects none, which leaves the builder collections alone.
     */
    tables?: string[];
    /**
     * Adjusts the collections one table at a time: to name them, tune them or share a table
     * between several. The tables it names are not introspected a second time.
     */
    builder?: ConfigurationOptions;
    introspectionConfig?: IntrospectionConfig;
    /** Exposes arrays of maps as collections of their own. */
    virtualCollections?: VirtualCollectionConfig[];
    /** Another name for `virtualCollections`, the one the Cosmos DB datasource uses. */
    virtualArrayCollections?: VirtualCollectionConfig[];
    /** Name of the connection that runs PartiQL native queries. Without it, none is offered. */
    liveQueryConnection?: string;
  };

const withoutUndefined = <T extends object>(value: T): T =>
  Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;

async function liveModels(
  options: DynamoDBDataSourceOptions,
  client: ReturnType<typeof createDocumentClient>,
  logger: Logger,
): Promise<TableModel[]> {
  const sampleSize = options.introspectionConfig?.sampleSize ?? DEFAULT_SAMPLE_SIZE;
  const maxDepth = options.introspectionConfig?.maxDepth ?? DEFAULT_MAX_DEPTH;

  const fromBuilder = options.builder
    ? await (
        options.builder(
          new DynamoDBDatasourceBuilder(client, { sampleSize, maxDepth }),
        ) as DynamoDBDatasourceBuilder
      ).createCollectionsFromConfiguration()
    : [];

  const models = await introspectTables(
    client,
    {
      tables: options.tables,
      exclude: fromBuilder.map(model => model.tableName),
      sampleSize,
      maxDepth,
    },
    logger,
  );

  return [...fromBuilder, ...models];
}

async function loadModels(
  options: DynamoDBDataSourceOptions,
  introspection: Introspection | undefined,
  client: ReturnType<typeof createDocumentClient>,
  logger: Logger,
): Promise<TableModel[]> {
  if (introspection) {
    if (options.builder) {
      throw new ValidationError('An introspection and a builder cannot be used together');
    }

    logger('Info', 'Using the given introspection');

    return convertManualSchema(introspection);
  }

  const models = await liveModels(options, client, logger);

  if (models.length === 0) logger('Warn', 'No collections were introspected.');

  return models;
}

/**
 * Reads the tables and describes them as collection definitions. Save the result, for instance in
 * a file, and give it back as the `introspection` of `createDynamoDBDataSource` to start without
 * sampling the tables.
 */
export async function introspect(
  options: DynamoDBDataSourceOptions = {},
  logger: Logger = () => {},
): Promise<Introspection> {
  const client = createDocumentClient(options);
  const models = await liveModels(options, client, logger);

  return { version: INTROSPECTION_VERSION, collections: models.map(toDefinition) };
}

/**
 * Creates a datasource over DynamoDB tables.
 *
 * @example
 * agent.addDataSource(
 *   createDynamoDBDataSource({ region: 'eu-west-1', tables: ['Orders'], scanPolicy: 'warn' }),
 * );
 */
export function createDynamoDBDataSource(
  options: DynamoDBDataSourceOptions = {},
  dataSourceOptions: { introspection?: Introspection } = {},
): DataSourceFactory {
  return async logger => {
    const client = createDocumentClient(options);
    const settings = resolveSettings(
      withoutUndefined({
        scanPolicy: options.scanPolicy,
        maxScannedItems: options.maxScannedItems,
        scanConcurrency: options.scanConcurrency,
        approximateCount: options.approximateCount,
        chartCacheTtlMs: options.chartCacheTtlMs,
        maxOffset: options.maxOffset,
        logConsumedCapacity: options.logConsumedCapacity,
        logQueries: options.logQueries,
        paginationCache: new PaginationCache(options.paginationCache),
      }),
    );

    const models = await loadModels(options, dataSourceOptions.introspection, client, logger);
    const dataSource = new DynamoDBDataSource(client, models, logger, settings, {
      liveQueryConnection: options.liveQueryConnection,
    });

    const virtualCollections = [
      ...(options.virtualCollections ?? []),
      ...(options.virtualArrayCollections ?? []),
    ];

    if (virtualCollections.length) {
      await addVirtualCollections(
        dataSource,
        virtualCollections,
        options.introspectionConfig?.sampleSize,
        logger,
      );
    }

    return dataSource;
  };
}

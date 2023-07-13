import type { Logger } from '@forestadmin/datasource-toolkit';
import type { Sequelize } from 'sequelize';

import computeFlattenOptions from './flattener/options';
import { flattenSchema } from './flattener/schema';
import { buildSchema, getSchema } from './schema';
import AnalysisPassThough from '../synchronization/analysis-passthrough';
import CustomerSource from '../synchronization/customer-source';
import {
  CachedCollectionSchema,
  CachedDataSourceOptions,
  ResolvedOptions,
  SynchronizationSource,
} from '../types';

export default async function resolveOptions(
  options: CachedDataSourceOptions,
  logger: Logger,
  connection: Sequelize,
): Promise<ResolvedOptions> {
  let source: SynchronizationSource = new CustomerSource(connection, options);
  let resolvedSchema: CachedCollectionSchema[] = await getSchema(options, connection);

  if (!resolvedSchema) {
    const passThrough = new AnalysisPassThough(connection, source, options.cacheNamespace);
    await source.start(passThrough); // This should block until the analysis is done.

    source = passThrough;
    resolvedSchema = await buildSchema(passThrough.nodes);
  }

  const flattenOptions = await computeFlattenOptions(resolvedSchema, options);

  return {
    cacheInto: options.cacheInto,
    cacheNamespace: options.cacheNamespace,
    createRecord: options.createRecord,
    deleteRecord: options.deleteRecord,
    flattenOptions,
    flattenSchema: flattenSchema(resolvedSchema, flattenOptions),
    logger,
    pullDeltaOnAfterWrite: options.pullDeltaHandler && options.pullDeltaOnAfterWrite,
    pullDeltaOnBeforeAccess: options.pullDeltaHandler && options.pullDeltaOnBeforeAccess,
    schema: resolvedSchema,
    source,
    updateRecord: options.updateRecord,
  };
}

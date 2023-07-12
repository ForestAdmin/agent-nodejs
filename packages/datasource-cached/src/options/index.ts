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
  connection: Sequelize,
): Promise<ResolvedOptions> {
  let source: SynchronizationSource = new CustomerSource(connection, options);
  let resolvedSchema: CachedCollectionSchema[] = await getSchema(options, connection);

  if (!resolvedSchema) {
    const passThrough = new AnalysisPassThough(connection, source);
    await source.start(passThrough); // This should block until the analysis is done.

    source = passThrough;
    resolvedSchema = await buildSchema(options, connection, passThrough.nodes);
  }

  const flattenOptions = await computeFlattenOptions(resolvedSchema, options);

  return {
    cacheNamespace: options.cacheNamespace ?? 'forest_cache_',
    flattenOptions,
    schema: resolvedSchema,
    flattenSchema: flattenSchema(resolvedSchema, flattenOptions),
    source,
    cacheInto: options.cacheInto,
    createRecord: options.createRecord,
    updateRecord: options.updateRecord,
    deleteRecord: options.deleteRecord,
    pullDeltaOnAfterWrite: options.pullDeltaHandler && options.pullDeltaOnAfterWrite,
    pullDeltaOnBeforeAccess: options.pullDeltaHandler && options.pullDeltaOnBeforeAccess,
  };
}

import type { Sequelize } from 'sequelize';

import computeFlattenOptions from './flattener';
import getSchema from './schema';
import { CachedDataSourceOptions, ResolvedOptions } from '../types';

export default async function resolveOptions(
  rawOptions: CachedDataSourceOptions,
  sequelize: Sequelize,
): Promise<ResolvedOptions> {
  const { flattenMode, flattenOptions, schema, ...rest } = rawOptions;

  if (
    flattenOptions &&
    (rawOptions.createRecord || rawOptions.updateRecord || rawOptions.deleteRecord)
  ) {
    throw new Error('Cannot use flattenOptions with createRecord, updateRecord or deleteRecord');
  }

  if (
    rest.pullDeltaHandler &&
    !(
      rest.pullDeltaOnRestart ||
      rest.pullDeltaOnTimer ||
      rest.pullDeltaOnAfterWrite ||
      rest.pullDeltaOnBeforeAccess
    )
  ) {
    throw new Error('Cannot use pullDeltaHandler without any pullDelta[*] flags');
  }

  if (rest.pullDumpHandler && !(rest.pullDumpOnRestart || rest.pullDumpOnTimer)) {
    throw new Error('Cannot use pullDumpHandler without any pullDump[*] flags');
  }

  const resolvedSchema = await getSchema(rawOptions, sequelize);
  const resolvedFlattenOptions = await computeFlattenOptions(resolvedSchema, rawOptions);
  const resolvedCacheNamespace = rawOptions.cacheNamespace ?? 'forest_cache_';

  return {
    ...rest,
    cacheNamespace: resolvedCacheNamespace,
    flattenOptions: resolvedFlattenOptions,
    schema: resolvedSchema,
  };
}

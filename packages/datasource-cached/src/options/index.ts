import computeFlattenOptions from './flattener';
import getSchema from './schema';
import { CachedDataSourceOptions, ResolvedOptions } from '../types';

export default async function resolveOptions(
  rawOptions: CachedDataSourceOptions,
): Promise<ResolvedOptions> {
  const { flattenMode, flattenOptions, schema, ...rest } = rawOptions;

  if (
    flattenOptions &&
    (rawOptions.createRecord || rawOptions.updateRecord || rawOptions.deleteRecord)
  ) {
    throw new Error('Cannot use flattenOptions with createRecord, updateRecord or deleteRecord');
  }

  const resolvedSchema = await getSchema(rawOptions);
  const resolvedFlattenOptions = await computeFlattenOptions(resolvedSchema, rawOptions);
  const resolvedCacheNamespace = rawOptions.cacheNamespace ?? 'forest_cache_';

  return {
    ...rest,
    cacheNamespace: resolvedCacheNamespace,
    flattenOptions: resolvedFlattenOptions,
    schema: resolvedSchema,
  };
}

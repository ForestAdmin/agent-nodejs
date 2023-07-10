import computeFlattenOptions from './flattener';
import getSchema from './schema';
import { CachedDataSourceOptions, ResolvedOptions } from '../types';

export default async function resolveOptions(
  rawOptions: CachedDataSourceOptions,
): Promise<ResolvedOptions> {
  const schema = await getSchema(rawOptions);
  const flattenOptions = await computeFlattenOptions(schema, rawOptions);

  if (
    flattenOptions &&
    (rawOptions.createRecord || rawOptions.updateRecord || rawOptions.deleteRecord)
  ) {
    throw new Error('Cannot use flattenOptions with createRecord, updateRecord or deleteRecord');
  }

  return { ...rawOptions, schema, flattenOptions };
}

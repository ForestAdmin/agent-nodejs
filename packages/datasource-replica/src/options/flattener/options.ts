import type {
  CollectionReplicaSchema,
  Field,
  ReplicaDataSourceOptions,
  ResolvedOptions,
} from '../../types';

import { isLeafField } from '../../types';
import { resolveValueOrPromiseOrFactory } from '../utils';

type ResolvedFlattenOptions = ResolvedOptions['flattenOptions'];
type ModelFlattenOptions = ResolvedFlattenOptions[string];

function listFields(field: Field, depth: number): string[] {
  if (depth === 0) return [];
  if (Array.isArray(field)) return listFields(field[0], depth);
  if (isLeafField(field)) return [''];

  return Object.entries(field).flatMap(([fieldName, rawSubField]) => {
    return listFields(rawSubField, depth - 1).map(f => (f ? `${fieldName}.${f}` : fieldName));
  });
}

function getField(field: Field, path: string): Field {
  if (!path) return field;

  const [prefix, suffix] = path.split(/\.(.*)/);
  const subField = field[prefix];
  if (!subField) throw new Error(`Field ${prefix} not found in ${JSON.stringify(field)}}`);

  return getField(subField, suffix);
}

function getAutoFlattenHelper(field: Field, distance: number): ModelFlattenOptions {
  const options: ModelFlattenOptions = { asModels: [], asFields: [] };

  if (!isLeafField(field)) {
    for (const [fieldName, subField] of Object.entries(field)) {
      let subOptions: ModelFlattenOptions;

      if (isLeafField(subField)) {
        subOptions = { asFields: [], asModels: [] };
        if (distance > 0) options.asFields.push(fieldName);
      } else if (Array.isArray(subField)) {
        subOptions = getAutoFlattenHelper(subField[0], 0);
        options.asModels.push(fieldName);
      } else {
        subOptions = getAutoFlattenHelper(subField, distance + 1);
      }

      options.asFields.push(...subOptions.asFields.map(f => `${fieldName}.${f}`));
      options.asModels.push(...subOptions.asModels.map(f => `${fieldName}.${f}`));
    }
  }

  return options;
}

function getAutoFlattenOptions(schema: CollectionReplicaSchema[]): ResolvedFlattenOptions {
  return Object.fromEntries(
    schema.map(({ name, fields }) => {
      const { asFields, asModels } = getAutoFlattenHelper(fields, 0);
      asFields.sort();
      asModels.sort();

      return [name, { asFields, asModels }];
    }),
  );
}

async function getManualFlattenOptions(
  schema: CollectionReplicaSchema[],
  rawOptions: ReplicaDataSourceOptions,
): Promise<ResolvedFlattenOptions> {
  const rawFlattenOptions = await resolveValueOrPromiseOrFactory(rawOptions.flattenOptions);
  const result: ResolvedFlattenOptions = {};

  for (const [collectionName, collectionOptions] of Object.entries(rawFlattenOptions ?? {})) {
    const field = schema.find(s => s.name === collectionName)?.fields;
    if (!field) throw new Error(`Collection ${collectionName} not found in schema`);

    const asModels = [...(collectionOptions.asModels ?? [])].sort();
    const asFields = (collectionOptions.asFields ?? [])
      // expand fields and objects to a list of absolute paths
      .flatMap(entry => {
        const path = typeof entry === 'string' ? entry : entry.field;
        const depth = typeof entry === 'string' ? 99 : entry.level;
        const expanded = listFields(getField(field, path), depth);

        return expanded.map(f => (f ? `${path}.${f}` : path));
      })
      // Keep only the paths which do something.
      .filter(fullPath => {
        // get the longest path in asModels which is a prefix of path
        const prefix = collectionOptions.asModels
          .filter(p => fullPath.startsWith(p))
          .sort((a, b) => b.length - a.length)?.[0];
        const suffix = prefix ? fullPath.substring(prefix.length + 1) : fullPath;

        return suffix.includes('.');
      })
      .sort();

    result[collectionName] = { asModels, asFields };
  }

  for (const collection of schema) {
    result[collection.name] ??= { asFields: [], asModels: [] };
  }

  return result;
}

export default async function computeFlattenOptions(
  schema: CollectionReplicaSchema[],
  rawOptions: ReplicaDataSourceOptions,
): Promise<ResolvedFlattenOptions> {
  if (rawOptions.flattenMode === 'none') {
    return getManualFlattenOptions(schema, { flattenOptions: {} });
  }

  if (rawOptions.flattenMode === 'auto') {
    return getAutoFlattenOptions(schema);
  }

  try {
    return await getManualFlattenOptions(schema, rawOptions);
  } catch (e) {
    e.message = `Error while computing flattenOptions: ${e.message}`;
    throw e;
  }
}

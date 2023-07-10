import { resolveValueOrPromiseOrFactory } from './utils';
import {
  CachedCollectionSchema,
  CachedDataSourceOptions,
  Field,
  FlattenOptions,
  ResolvedOptions,
  isLeafField,
} from '../types';

type ResolvedFlattenOptions = ResolvedOptions['flattenOptions'];
type ModelFlattenOptions = ResolvedFlattenOptions[string];

function listFields(field: Record<string, Field>, depth: number): string[] {
  if (depth === 0) return [];

  if (Array.isArray(field)) {
    return listFields(field[0], depth - 1);
  }

  return Object.entries(field).flatMap(([fieldName, rawSubField]) => {
    let subField = rawSubField;

    while (Array.isArray(subField)) {
      [subField] = subField;
    }

    if (isLeafField(subField)) {
      return [fieldName];
    }

    return listFields(subField, depth - 1).map(f => `${fieldName}.${f}`);
  });
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

function getAutoFlattenOptions(schema: CachedCollectionSchema[]): ResolvedFlattenOptions {
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
  schema: CachedCollectionSchema[],
  rawOptions: CachedDataSourceOptions,
): Promise<ResolvedFlattenOptions> {
  const options = await resolveValueOrPromiseOrFactory(rawOptions.flattenOptions);

  return Object.fromEntries(
    schema.map(({ name, fields }) => {
      const toto = listFields(fields, 99);

      // const { asFields, asModels } = getManualFlattenHelper(fields, 0, options[name] ?? {});
      // asFields.sort();
      // asModels.sort();

      return [name, { asFields, asModels }];
    }),
  );
}

export default async function computeFlattenOptions(
  schema: CachedCollectionSchema[],
  rawOptions: CachedDataSourceOptions,
): Promise<ResolvedFlattenOptions> {
  if (rawOptions.flattenMode === 'none') return {};
  if (rawOptions.flattenMode === 'auto') return getAutoFlattenOptions(schema);

  return getManualFlattenOptions(schema, rawOptions) ?? {};
}

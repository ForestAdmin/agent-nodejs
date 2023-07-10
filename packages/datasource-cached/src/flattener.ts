/* eslint-disable */
import { RecordData } from '@forestadmin/datasource-toolkit';
import { CachedCollectionSchema, RecordDataWithCollection, ResolvedOptions } from './types';

function escape(strings: TemplateStringsArray, ...exps: unknown[]): string {
  return strings.reduce((acc, str, i) => acc + str + (exps[i] ?? ''), '').replace(/\./g, '_');
}

function deepclone(any: unknown) {
  return JSON.parse(JSON.stringify(any));
}

function extractValue(record: RecordData, path: string, remove: boolean) {
  if (!path) return record;

  const [prefix, suffix] = path.split(/\.(.*)/);
  const value = extractValue(record?.[prefix], suffix, remove);
  if (remove && record && (!suffix || !Object.keys(record?.[prefix] ?? {}).length))
    delete record[prefix];

  return value;
}

function getRecordId(fields: CachedCollectionSchema['fields'], record: RecordData): unknown {
  if (record._fid) return record._fid;

  const pks = Object.entries(fields)
    .filter(([, v]) => 'type' in v && v.isPrimaryKey)
    .map(([k]) => record[k]);

  if (pks.length === 0) throw new Error('No primary key found');
  else if (pks.length === 1) return pks[0];
  else throw new Error('Composite primary keys are not supported');
}

function flattenRecordRec(
  recordWithCollection: RecordDataWithCollection,
  fields: CachedCollectionSchema['fields'],
  asFields: string[],
  asModels: string[],
): RecordDataWithCollection[] {
  const { collection, record } = recordWithCollection;
  const recordId = getRecordId(fields, record);
  const flattenedRecords = [];

  for (let asModelIndex = 0; asModelIndex < asModels.length; asModelIndex += 1) {
    const asModel = asModels[asModelIndex];

    // Build subAsModels and subAsFields + remove them from asModels and asFields
    const subAsModels = [];
    while (asModels[asModelIndex + 1]?.startsWith(`${asModel}.`)) {
      // asModels must be sorted for this to work
      subAsModels.push(asModels[asModelIndex + 1].substring(asModel.length + 1));
      asModels.splice(asModelIndex + 1, 1);
    }

    const subAsFields = [];
    for (let i = 0; i < asFields.length; i += 1) {
      if (asFields[i].startsWith(`${asModel}.`)) {
        subAsFields.push(asFields[i].substring(asModel.length + 1));
        asFields.splice(i, 1);
        i -= 1;
      }
    }

    // Build schema for subModel + some metadata
    let subFields = extractValue(fields, asModel, false);
    const isArray = Array.isArray(subFields);
    if (isArray) subFields = subFields[0];
    const isPrimitive = typeof subFields.type === 'string';

    // Recurse
    let subRecords = extractValue(record, asModel, true);
    if (!isArray) subRecords = [subRecords];
    if (isPrimitive) subRecords = subRecords.map(v => ({ value: v }));

    for (const [index, subRecord] of subRecords.entries()) {
      if (subRecord !== null && subRecord !== undefined) {
        subRecord._fid = isArray ? `${recordId}.${asModel}.${index}` : `${recordId}.${asModel}`;
        subRecord._fpid = recordId;

        flattenedRecords.push(
          ...flattenRecordRec(
            { collection: escape`${collection}.${asModel}`, record: subRecord },
            subFields,
            subAsFields,
            subAsModels,
          ),
        );
      }
    }
  }

  for (const asField of asFields) {
    record[asField.replace('.', '@@@')] = extractValue(record, asField, true);
  }

  flattenedRecords.push(recordWithCollection);

  return flattenedRecords;
}

export function flattenRecord(
  recordWithCollection: RecordDataWithCollection,
  fields: CachedCollectionSchema['fields'],
  asFields: string[],
  asModels: string[],
) {
  return flattenRecordRec(
    deepclone(recordWithCollection),
    fields,
    [...asFields].sort(),
    [...asModels].sort(),
  );
}

/**
 * Abuse the flattenRecordRec logic with ❤️
 * And then fix the _fpid and _fid fields which are not correct
 */
export function flattenCollectionSchema(
  schema: CachedCollectionSchema,
  asFields: string[],
  asModels: string[],
): CachedCollectionSchema[] {
  const recordWithCollection = { collection: schema.name, record: schema.fields };
  const output = flattenRecord(recordWithCollection, schema.fields, asFields, asModels);

  for (let i = output.length - 2; i >= 0; i -= 1) {
    const { collection, record } = output[i];
    const parent = output.slice(i + 1).find(r => collection.startsWith(r.collection));
    const [parentPkName, parentPkField] = Object.entries(parent.record).find(
      ([, v]) => 'type' in v && v.isPrimaryKey,
    ) ?? ['_fid', { type: 'String', isPrimaryKey: true }];

    record._fpid = {
      type: parentPkField.type,
      unique: !record._fid.endsWith('.0'),
      reference: {
        targetCollection: parent.collection,
        targetField: parentPkName,
        relationName: 'parent',
        relationInverse: collection.substring(parent.collection.length + 1),
      },
    };
    record._fid = { type: 'String', isPrimaryKey: true };
  }

  return output.map(({ collection, record }) => ({ name: collection, fields: record }));
}

export function flattenSchema(
  schema: CachedCollectionSchema[],
  flattenOptions: ResolvedOptions['flattenOptions'],
): CachedCollectionSchema[] {
  return schema.flatMap(collectionSchema =>
    flattenCollectionSchema(
      collectionSchema,
      flattenOptions?.[collectionSchema.name]?.asFields ?? [],
      flattenOptions?.[collectionSchema.name]?.asModels ?? [],
    ),
  );
}

import type { CollectionReplicaSchema, RecordDataWithCollection } from './types';

import { deepclone, escape, extractValue, getRecordId } from './utils';

function flattenRecordRec(
  recordWithCollection: RecordDataWithCollection,
  fields: CollectionReplicaSchema['fields'],
  asFields: string[],
  asModels: string[],
): RecordDataWithCollection[] {
  const { collection, record } = recordWithCollection;
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
    if (isArray) [subFields] = subFields;
    const isPrimitive = typeof subFields.type === 'string';

    // Recurse
    let subRecords = extractValue(record, asModel, true);

    if (subRecords) {
      if (!isArray) subRecords = [subRecords];
      if (isPrimitive) subRecords = subRecords.map(v => ({ value: v }));

      for (const [index, subRecord] of subRecords.entries()) {
        if (subRecord !== null && subRecord !== undefined) {
          const recordId = getRecordId(fields, record);
          // eslint-disable-next-line no-underscore-dangle
          subRecord._fid = isArray ? `${recordId}.${asModel}.${index}` : `${recordId}.${asModel}`;
          // eslint-disable-next-line no-underscore-dangle
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
  }

  for (const asField of asFields) {
    record[asField.replace('.', '@@@')] = extractValue(record, asField, true);
  }

  flattenedRecords.push(recordWithCollection);

  return flattenedRecords;
}

export default function flattenRecord(
  recordWithCollection: RecordDataWithCollection,
  fields: CollectionReplicaSchema['fields'],
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

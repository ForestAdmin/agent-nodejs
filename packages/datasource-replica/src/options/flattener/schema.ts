/* eslint-disable no-underscore-dangle */
import type { CollectionReplicaSchema, Field, ResolvedOptions } from '../../types';

import flattenRecord from '../../flattener';
import { isLeafField } from '../../types';

/**
 * Abuse the flattenRecordRec logic with ❤️
 * And then fix the _fpid and _fid fields which are not correct
 */
export function flattenCollectionSchema(
  schema: CollectionReplicaSchema,
  asFields: string[],
  asModels: string[],
): CollectionReplicaSchema[] {
  const recordWithCollection = { collection: schema.name, record: schema.fields };
  const output = flattenRecord(recordWithCollection, schema.fields, asFields, asModels);

  for (let i = output.length - 2; i >= 0; i -= 1) {
    const { collection, record } = output[i];
    const parent = output.slice(i + 1).find(r => collection.startsWith(r.collection));
    const [parentPkName, parentPkField] = Object.entries(parent.record).find(([, v]) =>
      isLeafField(v as Field) ? v.isPrimaryKey : false,
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
  schema: CollectionReplicaSchema[],
  flattenOptions: ResolvedOptions['flattenOptions'],
): CollectionReplicaSchema[] {
  return schema.flatMap(collectionSchema =>
    flattenCollectionSchema(
      collectionSchema,
      flattenOptions?.[collectionSchema.name]?.asFields ?? [],
      flattenOptions?.[collectionSchema.name]?.asModels ?? [],
    ),
  );
}

import type { CollectionReplicaSchema, RecordDataWithCollection } from '../src/types';

import flattenRecord from '../src/flattener';
import { flattenCollectionSchema } from '../src/options/flattener/schema';

describe('flattener', () => {
  const schema: CollectionReplicaSchema = {
    name: 'user',
    fields: {
      id: { type: 'Integer', isPrimaryKey: true },
      name: { type: 'String' },
      address: {
        streetName: { type: 'String' },
        streetNumber: { type: 'Integer' },
        city: { type: 'String' },
      },
      metadata: {
        tags: [
          {
            id: { type: 'Integer' },
            name: { type: 'String' },
            nested: { id: { type: 'Integer' }, subTag: [{ type: 'Integer' }] },
          },
        ],
      },
    },
  };

  const recordWithCollection: RecordDataWithCollection = {
    collection: 'user',
    record: {
      id: 1,
      name: 'toto',
      address: { streetName: 'rue de la paix', streetNumber: 1, city: 'Paris' },
      metadata: {
        tags: [
          { id: 1, name: 'tag1', nested: { id: 1, subTag: [] } },
          { id: 2, name: 'tag2', nested: { id: 2, subTag: [4] } },
        ],
      },
    },
  };

  describe('should flatten records', () => {
    test('should do nothing if no fields or models', () => {
      const asFields = [];
      const asModels = [];
      const result = flattenRecord(recordWithCollection, schema.fields, asFields, asModels);

      expect(result).toEqual([recordWithCollection]);
    });

    test('should work with only fields', () => {
      const asFields = ['address.streetName', 'address.streetNumber', 'address.city'];
      const asModels = [];
      const result = flattenRecord(recordWithCollection, schema.fields, asFields, asModels);

      expect(result).toEqual([
        {
          collection: 'user',
          record: {
            id: 1,
            name: 'toto',
            'address@@@streetName': 'rue de la paix',
            'address@@@streetNumber': 1,
            'address@@@city': 'Paris',
            metadata: recordWithCollection.record.metadata,
          },
        },
      ]);
    });

    test('should work with only models', () => {
      const asFields = [];
      const asModels = ['address', 'metadata.tags', 'metadata.tags.nested.subTag'];
      const result = flattenRecord(recordWithCollection, schema.fields, asFields, asModels);

      expect(result).toEqual([
        {
          collection: 'user_address',
          record: {
            _fid: '1.address',
            _fpid: 1,
            streetName: 'rue de la paix',
            streetNumber: 1,
            city: 'Paris',
          },
        },
        {
          collection: 'user_metadata_tags',
          record: { _fid: '1.metadata.tags.0', _fpid: 1, id: 1, name: 'tag1', nested: { id: 1 } },
        },
        {
          collection: 'user_metadata_tags_nested_subTag',
          record: {
            _fid: '1.metadata.tags.1.nested.subTag.0',
            _fpid: '1.metadata.tags.1',
            value: 4,
          },
        },
        {
          collection: 'user_metadata_tags',
          record: { _fid: '1.metadata.tags.1', _fpid: 1, id: 2, name: 'tag2', nested: { id: 2 } },
        },
        { collection: 'user', record: { id: 1, name: 'toto' } },
      ]);
    });

    test('should work with both fields and models', () => {
      const asModels = ['metadata.tags', 'metadata.tags.nested.subTag'];
      const asFields = [
        'address.streetName',
        'address.streetNumber',
        'address.city',
        'metadata.tags.nested.id',
      ];
      const result = flattenRecord(recordWithCollection, schema.fields, asFields, asModels);

      expect(result).toEqual([
        {
          collection: 'user_metadata_tags',
          record: { _fid: '1.metadata.tags.0', _fpid: 1, id: 1, name: 'tag1', 'nested@@@id': 1 },
        },
        {
          collection: 'user_metadata_tags_nested_subTag',
          record: {
            _fid: '1.metadata.tags.1.nested.subTag.0',
            _fpid: '1.metadata.tags.1',
            value: 4,
          },
        },
        {
          collection: 'user_metadata_tags',
          record: { _fid: '1.metadata.tags.1', _fpid: 1, id: 2, name: 'tag2', 'nested@@@id': 2 },
        },
        {
          collection: 'user',
          record: {
            id: 1,
            name: 'toto',
            'address@@@streetName': 'rue de la paix',
            'address@@@streetNumber': 1,
            'address@@@city': 'Paris',
          },
        },
      ]);
    });
  });

  describe('should flatten schema', () => {
    test('should do nothing if no fields or models', () => {
      const asFields = [];
      const asModels = [];
      const result = flattenCollectionSchema(schema, asFields, asModels);

      expect(result).toEqual([schema]);
    });

    test('should work with only fields', () => {
      const asFields = ['address.streetName', 'address.streetNumber', 'address.city'];
      const asModels = [];
      const result = flattenCollectionSchema(schema, asFields, asModels);

      expect(result).toEqual([
        {
          name: 'user',
          fields: {
            id: { type: 'Integer', isPrimaryKey: true },
            name: { type: 'String' },
            'address@@@streetName': { type: 'String' },
            'address@@@streetNumber': { type: 'Integer' },
            'address@@@city': { type: 'String' },
            metadata: schema.fields.metadata,
          },
        },
      ]);
    });

    test('should work with only models', () => {
      const asFields = [];
      const asModels = ['address', 'metadata.tags', 'metadata.tags.nested.subTag'];
      const result = flattenCollectionSchema(schema, asFields, asModels);

      expect(result).toEqual([
        {
          name: 'user_address',
          fields: {
            _fid: { type: 'String', isPrimaryKey: true },
            _fpid: {
              type: 'Integer',
              unique: true,
              reference: {
                targetCollection: 'user',
                targetField: 'id',
                relationName: 'parent',
                relationInverse: 'address',
              },
            },
            streetName: { type: 'String' },
            streetNumber: { type: 'Integer' },
            city: { type: 'String' },
          },
        },
        {
          name: 'user_metadata_tags_nested_subTag',
          fields: {
            _fid: { type: 'String', isPrimaryKey: true },
            _fpid: {
              type: 'String',
              unique: false,
              reference: {
                targetCollection: 'user_metadata_tags',
                targetField: '_fid',
                relationName: 'parent',
                relationInverse: 'nested_subTag',
              },
            },
            value: { type: 'Integer' },
          },
        },
        {
          name: 'user_metadata_tags',
          fields: {
            _fid: { type: 'String', isPrimaryKey: true },
            _fpid: {
              type: 'Integer',
              unique: false,
              reference: {
                targetCollection: 'user',
                targetField: 'id',
                relationName: 'parent',
                relationInverse: 'metadata_tags',
              },
            },
            id: { type: 'Integer' },
            name: { type: 'String' },
            nested: { id: { type: 'Integer' } },
          },
        },
        {
          name: 'user',
          fields: {
            id: { type: 'Integer', isPrimaryKey: true },
            name: { type: 'String' },
          },
        },
      ]);
    });

    test('should work with both fields and models', () => {
      const asModels = ['metadata.tags', 'metadata.tags.nested.subTag'];
      const asFields = [
        'address.streetName',
        'address.streetNumber',
        'address.city',
        'metadata.tags.nested.id',
      ];
      const result = flattenCollectionSchema(schema, asFields, asModels);

      expect(result).toEqual([
        {
          name: 'user_metadata_tags_nested_subTag',
          fields: {
            _fid: { type: 'String', isPrimaryKey: true },
            _fpid: {
              type: 'String',
              unique: false,
              reference: {
                targetCollection: 'user_metadata_tags',
                targetField: '_fid',
                relationName: 'parent',
                relationInverse: 'nested_subTag',
              },
            },
            value: { type: 'Integer' },
          },
        },
        {
          name: 'user_metadata_tags',
          fields: {
            _fid: { isPrimaryKey: true, type: 'String' },
            _fpid: {
              type: 'Integer',
              unique: false,
              reference: {
                relationInverse: 'metadata_tags',
                relationName: 'parent',
                targetCollection: 'user',
                targetField: 'id',
              },
            },
            id: { type: 'Integer' },
            name: { type: 'String' },
            'nested@@@id': { type: 'Integer' },
          },
        },
        {
          name: 'user',
          fields: {
            id: { type: 'Integer', isPrimaryKey: true },
            name: { type: 'String' },
            'address@@@streetName': { type: 'String' },
            'address@@@streetNumber': { type: 'Integer' },
            'address@@@city': { type: 'String' },
          },
        },
      ]);
    });
  });
});

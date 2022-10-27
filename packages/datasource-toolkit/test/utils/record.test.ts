import * as factories from '../__factories__';
import RecordUtils from '../../src/utils/record';

describe('RecordUtils', () => {
  const dataSource = factories.dataSource.buildWithCollections([
    factories.collection.build({
      name: 'books',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.uuidPrimaryKey().build(),
          author: factories.manyToOneSchema.build({
            foreignCollection: 'persons',
            foreignKey: 'authorId',
          }),
          authorId: factories.columnSchema.build(),
        },
      }),
    }),
    factories.collection.build({
      name: 'persons',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.uuidPrimaryKey().build(),
        },
      }),
    }),
  ]);

  const books = dataSource.getCollection('books');

  describe('getPrimaryKey', () => {
    test('should extract value', () => {
      const id = RecordUtils.getPrimaryKey(books.schema, { id: 'value' });

      expect(id).toStrictEqual(['value']);
    });

    test('should throw', () => {
      const fn = () => RecordUtils.getPrimaryKey(books.schema, {});

      expect(fn).toThrow('Missing primary key: id');
    });
  });

  describe('getFieldValue', () => {
    test('should extract value', () => {
      const record = { relation1: { relation2: 'value' } };
      const value = RecordUtils.getFieldValue(record, 'relation1:relation2');

      expect(value).toStrictEqual('value');
    });
  });
});

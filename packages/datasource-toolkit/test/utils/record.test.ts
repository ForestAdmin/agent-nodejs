import RecordUtils from '../../dist/utils/record';
import * as factories from '../__factories__';

describe('RecordUtils', () => {
  const dataSource = factories.dataSource.buildWithCollections([
    factories.collection.build({
      name: 'books',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.build({ isPrimaryKey: true }),
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
          id: factories.columnSchema.build({ isPrimaryKey: true }),
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

  describe('unflattenRecord', () => {
    test('should unflatten with nested', () => {
      const flatRecord = { id: 1, 'author:id': 1 };
      const record = RecordUtils.unflattenRecord(books, flatRecord);

      expect(record).toStrictEqual({ id: 1, author: { id: 1 } });
    });

    test('should unflatten with undefined nested', () => {
      const flatRecord = { id: 1, 'author:id': null };
      const record = RecordUtils.unflattenRecord(books, flatRecord);

      expect(record).toStrictEqual({ id: 1, author: null });
    });
  });
});

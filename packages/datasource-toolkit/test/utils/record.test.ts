import RecordUtils from '../../dist/utils/record';
import * as factories from '../__factories__';
import { ColumnSchema, PrimitiveTypes } from '../../dist';

describe('RecordUtils', () => {
  const dataSource = factories.dataSource.buildWithCollections([
    factories.collection.build({
      name: 'books',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.isPrimaryKey().build(),
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
          id: factories.columnSchema.isPrimaryKey().build(),
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

  describe('validate', () => {
    describe('when the given field is not in the collection', () => {
      test('should throw an error', () => {
        const collection = factories.collection.build({
          schema: factories.collectionSchema.build({
            fields: {
              name: factories.columnSchema.build(),
            },
          }),
        });

        expect(() =>
          RecordUtils.validate(collection, {
            unknownField: 'this field is not defined in the collection',
          }),
        ).toThrow('Unknown field "unknownField"');
      });
    });

    describe('when the given field is a column and valid', () => {
      test('should not throw an error', () => {
        const collection = factories.collection.build({
          schema: factories.collectionSchema.build({
            fields: {
              name: factories.columnSchema.build(),
            },
          }),
        });

        expect(() =>
          RecordUtils.validate(collection, {
            name: 'this field is in collection',
          }),
        ).not.toThrow();
      });
    });

    describe('when the given field is a oneToOne relation', () => {
      test('should not throw an error when the record data match the collection', () => {
        const dataSourceBook = factories.dataSource.buildWithCollections([
          factories.collection.build({
            name: 'book',
            schema: factories.collectionSchema.build({
              fields: {
                relation: factories.oneToOneSchema.build({
                  foreignCollection: 'owner',
                }),
              },
            }),
          }),
          factories.collection.build({
            name: 'owner',
            schema: factories.collectionSchema.build({
              fields: {
                name: factories.columnSchema.build({ columnType: PrimitiveTypes.String }),
              },
            }),
          }),
        ]);
        expect(() =>
          RecordUtils.validate(dataSourceBook.getCollection('book'), {
            relation: { name: 'a name' },
          }),
        ).not.toThrow();
      });

      test('should throw an error when the record data doest not match the collection', () => {
        const dataSourceBook = factories.dataSource.buildWithCollections([
          factories.collection.build({
            name: 'book',
            schema: factories.collectionSchema.build({
              fields: {
                relation: factories.oneToOneSchema.build({
                  foreignCollection: 'owner',
                }),
              },
            }),
          }),
          factories.collection.build({
            name: 'owner',
            schema: factories.collectionSchema.build({
              fields: {
                name: factories.columnSchema.build({ columnType: PrimitiveTypes.String }),
              },
            }),
          }),
        ]);
        expect(() =>
          RecordUtils.validate(dataSourceBook.getCollection('book'), {
            relation: { fieldNotExist: 'a name' },
          }),
        ).toThrow('Unknown field "fieldNotExist');
      });

      test('should throw an error when the relation is an empty object', () => {
        const dataSourceBook = factories.dataSource.buildWithCollections([
          factories.collection.build({
            name: 'book',
            schema: factories.collectionSchema.build({
              fields: {
                relation: factories.oneToOneSchema.build({
                  foreignCollection: 'owner',
                }),
              },
            }),
          }),
          factories.collection.build({
            name: 'owner',
            schema: factories.collectionSchema.build({
              fields: {
                name: factories.columnSchema.build({ columnType: PrimitiveTypes.String }),
              },
            }),
          }),
        ]);
        expect(() =>
          RecordUtils.validate(dataSourceBook.getCollection('book'), {
            relation: {},
          }),
        ).toThrow('The record data is empty');
      });

      test('should throw an error when the relation is null', () => {
        const dataSourceBook = factories.dataSource.buildWithCollections([
          factories.collection.build({
            name: 'book',
            schema: factories.collectionSchema.build({
              fields: {
                relation: factories.oneToOneSchema.build({
                  foreignCollection: 'owner',
                }),
              },
            }),
          }),
          factories.collection.build({
            name: 'owner',
            schema: factories.collectionSchema.build({
              fields: {
                name: factories.columnSchema.build({ columnType: PrimitiveTypes.String }),
              },
            }),
          }),
        ]);
        expect(() =>
          RecordUtils.validate(dataSourceBook.getCollection('book'), {
            relation: null,
          }),
        ).toThrow('The record data is empty');
      });
    });

    describe('when the given field is a oneToMany relation', () => {
      test('should not throw an error when the record data match the collection', () => {
        const dataSourceBook = factories.dataSource.buildWithCollections([
          factories.collection.build({
            name: 'book',
            schema: factories.collectionSchema.build({
              fields: {
                relation: factories.oneToManySchema.build({
                  foreignCollection: 'owner',
                }),
              },
            }),
          }),
          factories.collection.build({
            name: 'owner',
            schema: factories.collectionSchema.build({
              fields: {
                name: factories.columnSchema.build({ columnType: PrimitiveTypes.String }),
              },
            }),
          }),
        ]);
        expect(() =>
          RecordUtils.validate(dataSourceBook.getCollection('book'), {
            relation: { name: 'a name' },
          }),
        ).not.toThrow();
      });
    });

    describe('when the given field has an unknown column type', () => {
      test('should throw an error', () => {
        const dataSourceBook = factories.dataSource.buildWithCollections([
          factories.collection.build({
            name: 'book',
            schema: factories.collectionSchema.build({
              fields: {
                id: {
                  type: 'failTypeColumn',
                } as unknown as ColumnSchema,
              },
            }),
          }),
        ]);

        expect(() =>
          RecordUtils.validate(dataSourceBook.getCollection('book'), {
            id: '1',
          }),
        ).toThrow("Unexpected schema type 'failTypeColumn' while traversing record");
      });
    });
  });
});

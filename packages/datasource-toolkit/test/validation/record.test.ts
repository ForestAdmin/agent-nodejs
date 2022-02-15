import * as factories from '../__factories__';
import { FieldTypes, PrimitiveTypes } from '../../src/interfaces/schema';
import RecordValidator from '../../src/validation/record';

describe('RecordValidator', () => {
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
        RecordValidator.validate(collection, {
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
        RecordValidator.validate(collection, {
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
        RecordValidator.validate(dataSourceBook.getCollection('book'), {
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
        RecordValidator.validate(dataSourceBook.getCollection('book'), {
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
        RecordValidator.validate(dataSourceBook.getCollection('book'), {
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
        RecordValidator.validate(dataSourceBook.getCollection('book'), {
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
        RecordValidator.validate(dataSourceBook.getCollection('book'), {
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
              id: factories.columnSchema.build({ type: 'failTypeColumn' as FieldTypes.Column }),
            },
          }),
        }),
      ]);

      expect(() =>
        RecordValidator.validate(dataSourceBook.getCollection('book'), {
          id: '1',
        }),
      ).toThrow("Unexpected schema type 'failTypeColumn' while traversing record");
    });
  });
});

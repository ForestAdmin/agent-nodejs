import * as factories from '../__factories__';
import CollectionUtils from '../../src/utils/collection';
import { FieldTypes, PrimitiveTypes } from '../../src/interfaces/schema';

describe('CollectionUtils', () => {
  describe('When inverse relations is missing', () => {
    const dataSource = factories.dataSource.buildWithCollections([
      factories.collection.build({
        name: 'books',
        schema: factories.collectionSchema.build({
          fields: {
            id: { type: FieldTypes.Column, columnType: PrimitiveTypes.Uuid, isPrimaryKey: true },
            author: {
              type: FieldTypes.ManyToOne,
              foreignCollection: 'persons',
              foreignKey: 'authorId',
            },
            authorId: {
              type: FieldTypes.Column,
              columnType: PrimitiveTypes.Uuid,
            },
          },
        }),
      }),
      factories.collection.build({
        name: 'persons',
        schema: factories.collectionSchema.build({
          fields: {
            id: { type: FieldTypes.Column, columnType: PrimitiveTypes.Uuid, isPrimaryKey: true },
          },
        }),
      }),
    ]);

    describe('getInverseRelation', () => {
      test('not find an inverse', () => {
        expect(
          CollectionUtils.getInverseRelation(dataSource.getCollection('books'), 'author'),
        ).toBeNull();
      });
    });

    describe('getFieldSchema', () => {
      test('should find fields in collections', () => {
        expect(
          CollectionUtils.getFieldSchema(dataSource.getCollection('books'), 'id'),
        ).toMatchObject({
          type: FieldTypes.Column,
          columnType: PrimitiveTypes.Uuid,
          isPrimaryKey: true,
        });
      });

      test('should find fields in relations', () => {
        expect(
          CollectionUtils.getFieldSchema(dataSource.getCollection('books'), 'author:id'),
        ).toMatchObject({
          type: FieldTypes.Column,
          columnType: PrimitiveTypes.Uuid,
          isPrimaryKey: true,
        });
      });

      test('should throw if a relation is missing', () => {
        expect(() =>
          CollectionUtils.getFieldSchema(dataSource.getCollection('books'), 'unknown:id'),
        ).toThrow("Relation 'unknown' not found on collection 'books'");
      });

      test('should throw if the field is missing', () => {
        expect(() =>
          CollectionUtils.getFieldSchema(dataSource.getCollection('books'), 'author:something'),
        ).toThrow(`Field 'something' not found on collection 'persons'`);
      });
    });
  });

  describe('When all relations are defined', () => {
    const dataSource = factories.dataSource.buildWithCollections([
      factories.collection.build({
        name: 'books',
        schema: factories.collectionSchema.build({
          fields: {
            id: {
              type: FieldTypes.Column,
              columnType: PrimitiveTypes.Uuid,
              isPrimaryKey: true,
            },
            myPersons: {
              type: FieldTypes.ManyToMany,
              foreignCollection: 'persons',
              foreignKey: 'personId',
              otherField: 'bookId',
              throughCollection: 'bookPersons',
            },
            myBookPersons: {
              type: FieldTypes.OneToMany,
              foreignCollection: 'bookPersons',
              foreignKey: 'bookId',
            },
          },
        }),
      }),
      factories.collection.build({
        name: 'bookPersons',
        schema: factories.collectionSchema.build({
          fields: {
            bookId: {
              type: FieldTypes.Column,
              columnType: PrimitiveTypes.Uuid,
              isPrimaryKey: true,
            },
            personId: {
              type: FieldTypes.Column,
              columnType: PrimitiveTypes.Uuid,
              isPrimaryKey: true,
            },
            myBook: {
              type: FieldTypes.ManyToOne,
              foreignCollection: 'books',
              foreignKey: 'bookId',
            },
            myPerson: {
              type: FieldTypes.ManyToOne,
              foreignCollection: 'persons',
              foreignKey: 'personId',
            },
          },
        }),
      }),
      factories.collection.build({
        name: 'persons',
        schema: factories.collectionSchema.build({
          fields: {
            id: {
              type: FieldTypes.Column,
              columnType: PrimitiveTypes.Uuid,
              isPrimaryKey: true,
            },
            myBookPerson: {
              type: FieldTypes.OneToOne,
              foreignCollection: 'bookPersons',
              foreignKey: 'personId',
            },
            myBooks: {
              type: FieldTypes.ManyToMany,
              foreignCollection: 'books',
              foreignKey: 'bookId',
              otherField: 'personId',
              throughCollection: 'bookPersons',
            },
          },
        }),
      }),
    ]);

    describe('getInverseRelation', () => {
      test('should inverse a one to many relation in both directions', () => {
        expect(
          CollectionUtils.getInverseRelation(dataSource.getCollection('books'), 'myBookPersons'),
        ).toStrictEqual('myBook');

        expect(
          CollectionUtils.getInverseRelation(dataSource.getCollection('bookPersons'), 'myBook'),
        ).toStrictEqual('myBookPersons');
      });

      test('should inverse a many to many relation in both directions', () => {
        expect(
          CollectionUtils.getInverseRelation(dataSource.getCollection('books'), 'myPersons'),
        ).toStrictEqual('myBooks');

        expect(
          CollectionUtils.getInverseRelation(dataSource.getCollection('persons'), 'myBooks'),
        ).toStrictEqual('myPersons');
      });

      test('should inverse a one to one relation in both directions', () => {
        expect(
          CollectionUtils.getInverseRelation(dataSource.getCollection('persons'), 'myBookPerson'),
        ).toStrictEqual('myPerson');

        expect(
          CollectionUtils.getInverseRelation(dataSource.getCollection('bookPersons'), 'myPerson'),
        ).toStrictEqual('myBookPerson');
      });
    });

    describe('getFieldSchema', () => {
      test('should throw if a relation is not many to one', () => {
        expect(() =>
          CollectionUtils.getFieldSchema(dataSource.getCollection('books'), 'myBookPersons:bookId'),
        ).toThrow('Invalid relation type: OneToMany');
      });
    });
  });
});

import { FieldTypes, PrimitiveTypes } from '../../src/interfaces/schema';
import SchemaUtils from '../../src/utils/schema';
import factories from '../__factories__';

describe('SchemaUtils', () => {
  describe('getPrimaryKeys', () => {
    const schema = factories.collectionSchema.build({
      fields: {
        id: { type: FieldTypes.Column, isPrimaryKey: true },
        notId: { type: FieldTypes.Column, isPrimaryKey: false },
        otherId: { type: FieldTypes.Column, isPrimaryKey: true },
      },
    });

    test('should find the pks', () => {
      const result = SchemaUtils.getPrimaryKeys(schema);

      expect(result).toStrictEqual(['id', 'otherId']);
    });
  });

  describe('isSolelyForeignKey', () => {
    const schema = factories.collectionSchema.build({
      fields: {
        // pk + used in relation
        id: factories.columnSchema.build({ isPrimaryKey: true }),

        // used in relation
        bookId: factories.columnSchema.build({}),

        // not used in relation
        name: factories.columnSchema.build({}),

        idModel: factories.manyToOneSchema.build({
          type: FieldTypes.ManyToOne,
          foreignCollection: 'otherCollection',
          foreignKey: 'id',
        }),

        book: factories.manyToOneSchema.build({
          type: FieldTypes.ManyToOne,
          foreignCollection: 'books',
          foreignKey: 'bookId',
        }),
      },
    });

    test('id is not solely a fk', () => {
      const result = SchemaUtils.isSolelyForeignKey(schema, 'id');

      expect(result).toBeFalsy();
    });

    test('bookId is solely a fk', () => {
      const result = SchemaUtils.isSolelyForeignKey(schema, 'bookId');

      expect(result).toBeTruthy();
    });

    test('name is not solely a fk', () => {
      const result = SchemaUtils.isSolelyForeignKey(schema, 'name');

      expect(result).toBeFalsy();
    });

    test('book is not solely a fk', () => {
      const result = SchemaUtils.isSolelyForeignKey(schema, 'book');

      expect(result).toBeFalsy();
    });
  });

  describe('getInverseRelation', () => {
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

      test('not find an inverse', () => {
        expect(
          SchemaUtils.getInverseRelation(dataSource.getCollection('books'), 'author'),
        ).toBeNull();
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

      test('should inverse a one to many relation in both directions', () => {
        expect(
          SchemaUtils.getInverseRelation(dataSource.getCollection('books'), 'myBookPersons'),
        ).toStrictEqual('myBook');

        expect(
          SchemaUtils.getInverseRelation(dataSource.getCollection('bookPersons'), 'myBook'),
        ).toStrictEqual('myBookPersons');
      });

      test('should inverse a many to many relation in both directions', () => {
        expect(
          SchemaUtils.getInverseRelation(dataSource.getCollection('books'), 'myPersons'),
        ).toStrictEqual('myBooks');

        expect(
          SchemaUtils.getInverseRelation(dataSource.getCollection('persons'), 'myBooks'),
        ).toStrictEqual('myPersons');
      });

      test('should inverse a one to one relation in both directions', () => {
        expect(
          SchemaUtils.getInverseRelation(dataSource.getCollection('persons'), 'myBookPerson'),
        ).toStrictEqual('myPerson');

        expect(
          SchemaUtils.getInverseRelation(dataSource.getCollection('bookPersons'), 'myPerson'),
        ).toStrictEqual('myBookPerson');
      });
    });
  });
});

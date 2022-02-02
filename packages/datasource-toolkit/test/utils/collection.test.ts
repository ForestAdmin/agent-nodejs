import * as factories from '../__factories__';
import CollectionUtils from '../../src/utils/collection';
import { FieldTypes, PrimitiveTypes } from '../../src/interfaces/schema';
import ConditionTreeLeaf, { Operator } from '../../src/interfaces/query/condition-tree/leaf';
import ConditionTreeUtils from '../../src/utils/condition-tree';

describe('CollectionUtils', () => {
  describe('When inverse relations is missing', () => {
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
            authorId: factories.columnSchema.build({
              columnType: PrimitiveTypes.Uuid,
            }),
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
            id: factories.columnSchema.isPrimaryKey().build(),
            myPersons: factories.manyToManySchema.build({
              foreignCollection: 'persons',
              foreignKey: 'personId',
              otherField: 'bookId',
              throughCollection: 'bookPersons',
            }),
            myBookPersons: factories.oneToManySchema.build({
              foreignCollection: 'bookPersons',
              foreignKey: 'bookId',
            }),
          },
        }),
      }),
      factories.collection.build({
        name: 'bookPersons',
        schema: factories.collectionSchema.build({
          fields: {
            bookId: factories.columnSchema.isPrimaryKey().build(),
            personId: factories.columnSchema.isPrimaryKey().build(),
            myBook: factories.manyToOneSchema.build({
              foreignCollection: 'books',
              foreignKey: 'bookId',
            }),
            myPerson: factories.manyToOneSchema.build({
              foreignCollection: 'persons',
              foreignKey: 'personId',
            }),
          },
        }),
      }),
      factories.collection.build({
        name: 'persons',
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.isPrimaryKey().build(),
            myBookPerson: factories.oneToOneSchema.build({
              foreignCollection: 'bookPersons',
              foreignKey: 'personId',
            }),
            myBooks: factories.manyToManySchema.build({
              foreignCollection: 'books',
              foreignKey: 'bookId',
              otherField: 'personId',
              throughCollection: 'bookPersons',
            }),
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

  describe('aggregateRelation', () => {
    describe('when the relation is a one to many relation', () => {
      const setup = () => {
        const bookPersons = factories.collection.build({
          name: 'bookPersons',
        });

        const books = factories.collection.build({
          name: 'books',
          schema: factories.collectionSchema.build({
            fields: {
              myBookPersons: factories.oneToManySchema.build({
                foreignCollection: 'bookPersons',
                foreignKey: 'bookId',
              }),
            },
          }),
        });

        const aggregation = factories.aggregation.build();

        return {
          aggregation,
          dataSource: factories.dataSource.buildWithCollections([bookPersons, books]),
        };
      };

      it('should add the correct filter and aggregate it', async () => {
        const { aggregation, dataSource } = setup();

        const baseFilter = factories.filter.build({
          conditionTree: factories.conditionTreeLeaf.build(),
        });

        const oneToManyRelationName = 'myBookPersons';
        await CollectionUtils.aggregateRelation(
          baseFilter,
          2,
          dataSource.getCollection('books'),
          oneToManyRelationName,
          aggregation,
          dataSource,
        );

        const expectedCondition = ConditionTreeUtils.intersect(
          baseFilter.conditionTree,
          new ConditionTreeLeaf({
            field: 'bookId',
            operator: Operator.Equal,
            value: 2,
          }),
        );
        expect(dataSource.getCollection('bookPersons').aggregate).toHaveBeenCalledWith(
          baseFilter.override({ conditionTree: expectedCondition }),
          aggregation,
        );
      });
    });

    describe('when the relation is a many to many relation', () => {
      const setup = () => {
        const persons = factories.collection.build({
          name: 'persons',
          schema: factories.collectionSchema.build({
            fields: {
              id: factories.columnSchema.isPrimaryKey().build(),
            },
          }),
        });

        const books = factories.collection.build({
          name: 'books',
          schema: factories.collectionSchema.build({
            fields: {
              id: factories.columnSchema.isPrimaryKey().build(),
              myPersons: factories.manyToManySchema.build({
                foreignCollection: 'persons',
                foreignKey: 'personId',
                otherField: 'bookId',
              }),
            },
          }),
        });
        const aggregation = factories.aggregation.build();

        return {
          aggregation,
          dataSource: factories.dataSource.buildWithCollections([persons, books]),
        };
      };

      it('should add the correct filter and aggregate it', async () => {
        const { aggregation, dataSource } = setup();

        const baseFilter = factories.filter.build({
          conditionTree: factories.conditionTreeLeaf.build({
            operator: Operator.Equal,
            value: 1,
            field: 'id',
          }),
        });

        (dataSource.getCollection('persons').aggregate as jest.Mock).mockResolvedValue(() => {
          throw new Error('okk');
        });

        const manyToManyRelationName = 'myPersons';
        await CollectionUtils.aggregateRelation(
          baseFilter,
          2,
          dataSource.getCollection('books'),
          manyToManyRelationName,
          aggregation,
          dataSource,
        );

        const expectedCondition = ConditionTreeUtils.intersect(
          baseFilter.conditionTree,
          new ConditionTreeLeaf({
            field: 'personId',
            operator: Operator.Equal,
            value: 2,
          }),
          new ConditionTreeLeaf({
            field: 'bookId:id',
            operator: Operator.Equal,
            value: 1,
          }),
        );

        expect(dataSource.getCollection('persons').aggregate).toHaveBeenCalledWith(
          baseFilter.override({ conditionTree: expectedCondition }),
          aggregation,
        );
      });
    });
  });
});

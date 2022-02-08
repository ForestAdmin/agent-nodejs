import * as factories from '../__factories__';
import CollectionUtils from '../../src/utils/collection';
import { FieldTypes, PrimitiveTypes } from '../../src/interfaces/schema';
import ConditionTreeLeaf, { Operator } from '../../src/interfaces/query/condition-tree/leaf';
import ConditionTreeUtils from '../../src/utils/condition-tree';
import Aggregation, { AggregationOperation } from '../../src/interfaces/query/aggregation';

describe('CollectionUtils', () => {
  describe('When inverse relations is missing', () => {
    const setupWithInverseRelationMissing = () => {
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

      return { dataSource };
    };

    describe('getInverseRelation', () => {
      test('not find an inverse', () => {
        const { dataSource } = setupWithInverseRelationMissing();

        expect(
          CollectionUtils.getInverseRelation(dataSource.getCollection('books'), 'author'),
        ).toBeNull();
      });
    });

    describe('getFieldSchema', () => {
      test('should find fields in collections', () => {
        const { dataSource } = setupWithInverseRelationMissing();

        expect(
          CollectionUtils.getFieldSchema(dataSource.getCollection('books'), 'id'),
        ).toMatchObject({
          type: FieldTypes.Column,
          columnType: PrimitiveTypes.Uuid,
          isPrimaryKey: true,
        });
      });

      test('should find fields in relations', () => {
        const { dataSource } = setupWithInverseRelationMissing();

        expect(
          CollectionUtils.getFieldSchema(dataSource.getCollection('books'), 'author:id'),
        ).toMatchObject({
          type: FieldTypes.Column,
          columnType: PrimitiveTypes.Uuid,
          isPrimaryKey: true,
        });
      });

      test('should throw if a relation is missing', () => {
        const { dataSource } = setupWithInverseRelationMissing();

        expect(() =>
          CollectionUtils.getFieldSchema(dataSource.getCollection('books'), 'unknown:id'),
        ).toThrow("Relation 'unknown' not found on collection 'books'");
      });

      test('should throw if the field is missing', () => {
        const { dataSource } = setupWithInverseRelationMissing();

        expect(() =>
          CollectionUtils.getFieldSchema(dataSource.getCollection('books'), 'author:something'),
        ).toThrow(`Field 'something' not found on collection 'persons'`);
      });
    });
  });

  describe('When all relations are defined', () => {
    const setupWithAllRelations = () => {
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

      return { dataSource };
    };

    describe('getInverseRelation', () => {
      test('should inverse a one to many relation in both directions', () => {
        const { dataSource } = setupWithAllRelations();

        expect(
          CollectionUtils.getInverseRelation(dataSource.getCollection('books'), 'myBookPersons'),
        ).toStrictEqual('myBook');

        expect(
          CollectionUtils.getInverseRelation(dataSource.getCollection('bookPersons'), 'myBook'),
        ).toStrictEqual('myBookPersons');
      });

      test('should inverse a many to many relation in both directions', () => {
        const { dataSource } = setupWithAllRelations();

        expect(
          CollectionUtils.getInverseRelation(dataSource.getCollection('books'), 'myPersons'),
        ).toStrictEqual('myBooks');

        expect(
          CollectionUtils.getInverseRelation(dataSource.getCollection('persons'), 'myBooks'),
        ).toStrictEqual('myPersons');
      });

      test('should inverse a one to one relation in both directions', () => {
        const { dataSource } = setupWithAllRelations();

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
        const { dataSource } = setupWithAllRelations();

        expect(() =>
          CollectionUtils.getFieldSchema(dataSource.getCollection('books'), 'myBookPersons:bookId'),
        ).toThrow('Invalid relation type: OneToMany');
      });
    });
  });

  describe('aggregateRelation', () => {
    describe('when the relation is a one to many relation', () => {
      const setupWithNotSupportedRelation = () => {
        const books = factories.collection.build({
          name: 'books',
          schema: factories.collectionSchema.build({
            fields: {
              aNonSupportedRelationField: factories.oneToOneSchema.build(),
            },
          }),
        });

        const aggregation = factories.aggregation.build();

        return {
          aggregation,
          dataSource: factories.dataSource.buildWithCollections([books]),
        };
      };

      test('should throw an error', async () => {
        const { aggregation, dataSource } = setupWithNotSupportedRelation();

        const baseFilter = factories.filter.build({
          conditionTree: factories.conditionTreeLeaf.build(),
        });

        await expect(() =>
          CollectionUtils.aggregateRelation(
            baseFilter,
            2,
            dataSource.getCollection('books'),
            'aNonSupportedRelationField',
            aggregation,
            dataSource,
          ),
        ).rejects.toThrowError(
          'aggregateRelation method can only be used with OneToMany and ManyToMany relations',
        );
      });
    });

    describe('when the relation is a one to many relation', () => {
      const setupWithOneToManyRelation = () => {
        const reviews = factories.collection.build({
          name: 'reviews',
        });

        const books = factories.collection.build({
          name: 'books',
          schema: factories.collectionSchema.build({
            fields: {
              oneToManyRelationField: factories.oneToManySchema.build({
                foreignCollection: 'reviews',
                foreignKey: 'bookId',
              }),
            },
          }),
        });

        const aggregation = factories.aggregation.build();

        return {
          aggregation,
          dataSource: factories.dataSource.buildWithCollections([reviews, books]),
        };
      };

      test('should add the correct filter and aggregate it', async () => {
        const { aggregation, dataSource } = setupWithOneToManyRelation();

        const baseFilter = factories.filter.build({
          conditionTree: factories.conditionTreeLeaf.build(),
        });

        await CollectionUtils.aggregateRelation(
          baseFilter,
          2,
          dataSource.getCollection('books'),
          'oneToManyRelationField',
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
        expect(dataSource.getCollection('reviews').aggregate).toHaveBeenCalledWith(
          baseFilter.override({ conditionTree: expectedCondition }),
          aggregation,
        );
      });
    });

    describe('when the relation is a many to many relation', () => {
      const setupWithManyToManyRelation = () => {
        const librariesBooks = factories.collection.build({
          name: 'librariesBooks',
          schema: factories.collectionSchema.build({
            fields: {
              bookId: factories.columnSchema.isPrimaryKey().build(),
              libraryId: factories.columnSchema.isPrimaryKey().build(),
              myBook: factories.manyToOneSchema.build({
                foreignCollection: 'books',
                foreignKey: 'bookId',
              }),
              myLibrary: factories.manyToOneSchema.build({
                foreignCollection: 'libraries',
                foreignKey: 'libraryId',
              }),
            },
          }),
        });

        const books = factories.collection.build({
          name: 'books',
          schema: factories.collectionSchema.build({
            fields: {
              id: factories.columnSchema.isPrimaryKey().build(),
              name: factories.columnSchema.build(),
              manyToManyRelationField: factories.manyToManySchema.build({
                throughCollection: 'librariesBooks',
                originRelation: 'myBook',
                targetRelation: 'myLibrary',
              }),
            },
          }),
        });

        return {
          dataSource: factories.dataSource.buildWithCollections([librariesBooks, books]),
        };
      };

      test('should add the correct filter and aggregate it', async () => {
        const { dataSource } = setupWithManyToManyRelation();

        const aggregation = new Aggregation({
          operation: AggregationOperation.Max,
          field: 'aField',
        });

        const baseFilter = factories.filter.build({
          conditionTree: factories.conditionTreeLeaf.build({
            operator: Operator.Equal,
            value: 'foo',
            field: 'name',
          }),
        });

        jest
          .spyOn(dataSource.getCollection('librariesBooks'), 'aggregate')
          .mockResolvedValue([{ value: 34, group: { 'myBook:id': 1, bookId: 1 } }]);

        const aggregateResults = await CollectionUtils.aggregateRelation(
          baseFilter,
          2,
          dataSource.getCollection('books'),
          'manyToManyRelationField',
          aggregation,
          dataSource,
        );

        const expectedCondition = ConditionTreeUtils.intersect(
          baseFilter.conditionTree.nest('myBook'),
          new ConditionTreeLeaf({
            field: 'bookId',
            operator: Operator.Equal,
            value: 2,
          }),
        );
        const expectedAggregation = new Aggregation({
          operation: AggregationOperation.Max,
          field: 'myBook:aField',
        });

        expect(dataSource.getCollection('librariesBooks').aggregate).toHaveBeenCalledWith(
          baseFilter.override({ conditionTree: expectedCondition }),
          expectedAggregation,
        );

        expect(aggregateResults).toEqual([{ group: { id: 1, bookId: 1 }, value: 34 }]);
      });
    });
  });
});

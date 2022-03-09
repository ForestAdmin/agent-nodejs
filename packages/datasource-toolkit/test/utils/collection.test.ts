import * as factories from '../__factories__';
import { FieldTypes, PrimitiveTypes } from '../../src/interfaces/schema';
import Aggregation, { AggregationOperation } from '../../src/interfaces/query/aggregation';
import CollectionUtils from '../../src/utils/collection';
import ConditionTreeFactory from '../../src/interfaces/query/condition-tree/factory';
import ConditionTreeLeaf, { Operator } from '../../src/interfaces/query/condition-tree/nodes/leaf';

describe('CollectionUtils', () => {
  const setupWithUnsupportedRelation = () => {
    const books = factories.collection.build({
      name: 'books',
      schema: factories.collectionSchema.build({
        fields: {
          aNonSupportedRelationField: factories.oneToOneSchema.build(),
        },
      }),
    });

    return {
      dataSource: factories.dataSource.buildWithCollections([books]),
    };
  };

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

    return {
      dataSource: factories.dataSource.buildWithCollections([reviews, books]),
    };
  };

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
    describe('when the relation is not supported', () => {
      test('should throw an error', async () => {
        const { dataSource } = setupWithUnsupportedRelation();
        const aggregation = factories.aggregation.build();
        const baseFilter = factories.filter.build({
          conditionTree: factories.conditionTreeLeaf.build(),
        });

        await expect(() =>
          CollectionUtils.aggregateRelation(
            dataSource.getCollection('books'),
            [2],
            'aNonSupportedRelationField',
            baseFilter,
            aggregation,
          ),
        ).rejects.toThrowError(
          'Relation aNonSupportedRelationField has invalid type should be one of' +
            ' OneToMany or ManyToMany.',
        );
      });
    });

    describe('when the relation is a one to many relation', () => {
      test('should return the aggregate result of the relation', async () => {
        const { dataSource } = setupWithOneToManyRelation();
        const aggregation = factories.aggregation.build();
        const baseFilter = factories.filter.build({
          conditionTree: factories.conditionTreeLeaf.build(),
        });

        await CollectionUtils.aggregateRelation(
          dataSource.getCollection('books'),
          [2],
          'oneToManyRelationField',
          baseFilter,
          aggregation,
        );

        const expectedCondition = ConditionTreeFactory.intersect(
          baseFilter.conditionTree,
          new ConditionTreeLeaf('bookId', Operator.Equal, 2),
        );
        expect(dataSource.getCollection('reviews').aggregate).toHaveBeenCalledWith(
          baseFilter.override({ conditionTree: expectedCondition }),
          aggregation,
        );
      });
    });

    describe('when the relation is a many to many relation', () => {
      test('should return the aggregate result of the relation', async () => {
        const { dataSource } = setupWithManyToManyRelation();
        const aggregation = new Aggregation({
          operation: AggregationOperation.Max,
          field: 'aField',
        });
        const baseFilter = factories.filter.build({
          conditionTree: factories.conditionTreeLeaf.build(),
        });

        jest
          .spyOn(dataSource.getCollection('librariesBooks'), 'aggregate')
          .mockResolvedValue([{ value: 34, group: { 'myBook:id': 1, 'myBook:aField': '1' } }]);

        const aggregateResults = await CollectionUtils.aggregateRelation(
          dataSource.getCollection('books'),
          [2],
          'manyToManyRelationField',
          baseFilter,
          aggregation,
        );

        const expectedCondition = ConditionTreeFactory.intersect(
          baseFilter.conditionTree.nest('myLibrary'),
          new ConditionTreeLeaf('bookId', Operator.Equal, 2),
        );

        expect(dataSource.getCollection('librariesBooks').aggregate).toHaveBeenCalledWith(
          baseFilter.override({ conditionTree: expectedCondition }),
          new Aggregation({
            operation: AggregationOperation.Max,
            field: 'myLibrary:aField',
          }),
        );

        expect(aggregateResults).toEqual([{ group: { id: 1, aField: '1' }, value: 34 }]);
      });

      describe('when any aggregate results has not the right prefix', () => {
        test('should throw an error', async () => {
          const { dataSource } = setupWithManyToManyRelation();

          jest
            .spyOn(dataSource.getCollection('librariesBooks'), 'aggregate')
            .mockResolvedValue([
              { value: 34, group: { 'myBook:id': 1, 'BAD_PREFIX:aField': '1' } },
            ]);

          await expect(() =>
            CollectionUtils.aggregateRelation(
              dataSource.getCollection('books'),
              [2],
              'manyToManyRelationField',
              factories.filter.build(),
              factories.aggregation.build(),
            ),
          ).rejects.toThrowError(
            'This field BAD_PREFIX:aField does not have the right expected prefix: myBook',
          );
        });
      });
    });
  });

  describe('listRelation', () => {
    describe('when the relation is not supported', () => {
      test('should throw an error', async () => {
        const { dataSource } = setupWithUnsupportedRelation();

        const baseFilter = factories.filter.build({
          conditionTree: factories.conditionTreeLeaf.build(),
        });

        await expect(() =>
          CollectionUtils.listRelation(
            dataSource.getCollection('books'),
            [2],
            'aNonSupportedRelationField',
            baseFilter,
            factories.projection.build(),
          ),
        ).rejects.toThrowError(
          'Relation aNonSupportedRelationField has invalid type should be one of' +
            ' OneToMany or ManyToMany.',
        );
      });
    });

    describe('when the relation is a one to many relation', () => {
      test('should return the record list of the relation', async () => {
        const { dataSource } = setupWithOneToManyRelation();

        const baseFilter = factories.filter.build({
          conditionTree: factories.conditionTreeLeaf.build(),
        });
        const projection = factories.projection.build();

        await CollectionUtils.listRelation(
          dataSource.getCollection('books'),
          [2],
          'oneToManyRelationField',
          baseFilter,
          projection,
        );

        const expectedCondition = ConditionTreeFactory.intersect(
          baseFilter.conditionTree,
          new ConditionTreeLeaf('bookId', Operator.Equal, 2),
        );
        expect(dataSource.getCollection('reviews').list).toHaveBeenCalledWith(
          baseFilter.override({ conditionTree: expectedCondition }),
          projection,
        );
      });
    });

    describe('when the relation is a many to many relation', () => {
      test('should return the record list of the relation', async () => {
        const { dataSource } = setupWithManyToManyRelation();
        const projection = factories.projection.build();
        const paginatedFilter = factories.filter.build({
          conditionTree: factories.conditionTreeLeaf.build(),
        });

        jest
          .spyOn(dataSource.getCollection('librariesBooks'), 'list')
          .mockResolvedValue([{ myLibrary: { id: 1, aField: 'aValue' } }]);

        const listResults = await CollectionUtils.listRelation(
          dataSource.getCollection('books'),
          [2],
          'manyToManyRelationField',
          paginatedFilter,
          projection,
        );

        const expectedCondition = ConditionTreeFactory.intersect(
          paginatedFilter.conditionTree.nest('myLibrary'),
          new ConditionTreeLeaf('bookId', Operator.Equal, 2),
        );
        expect(dataSource.getCollection('librariesBooks').list).toHaveBeenCalledWith(
          paginatedFilter.override({
            conditionTree: expectedCondition,
            sort: paginatedFilter.sort,
          }),
          projection.nest('myBook'),
        );

        expect(listResults).toEqual([{ id: 1, aField: 'aValue' }]);
      });
    });
  });
});

import * as factories from '../__factories__';
import { SortFactory } from '../../src';
import Sort from '../../src/interfaces/query/sort/index';

describe('Sort', () => {
  const sort = new Sort(
    { field: 'column1', ascending: true },
    { field: 'column2', ascending: false },
  );

  test('projection should work', () => {
    expect(sort.projection).toEqual(['column1', 'column2']);
  });

  test('apply should sort records', () => {
    const records = [
      { column1: 2, column2: 2 },
      { column1: 1, column2: 1 },
      { column1: 1, column2: 1 },
      { column1: 1, column2: 2 },
      { column1: 2, column2: 1 },
    ];

    expect(sort.apply(records)).toStrictEqual([
      { column1: 1, column2: 2 },
      { column1: 1, column2: 1 },
      { column1: 1, column2: 1 },
      { column1: 2, column2: 2 },
      { column1: 2, column2: 1 },
    ]);
  });

  describe('replaceClauses', () => {
    test('should work when returning a single clause', () => {
      expect(sort.replaceClauses(clause => ({ ...clause, ascending: !clause.ascending }))).toEqual([
        { field: 'column1', ascending: false },
        { field: 'column2', ascending: true },
      ]);
    });

    test('should work when returning multiple clause', () => {
      expect(
        sort.replaceClauses(clause =>
          clause.field === 'column1' ? [clause, { field: 'otherCol', ascending: true }] : clause,
        ),
      ).toEqual([
        { field: 'column1', ascending: true },
        { field: 'otherCol', ascending: true },
        { field: 'column2', ascending: false },
      ]);
    });
  });

  describe('nest', () => {
    test('should do nothing with null', () => {
      expect(sort.nest(null)).toEqual(sort);
    });

    test('should work with a prefix', () => {
      expect(sort.nest('prefix')).toEqual([
        { field: 'prefix:column1', ascending: true },
        { field: 'prefix:column2', ascending: false },
      ]);
    });
  });

  describe('unnest', () => {
    test('should work', () => {
      expect(sort.nest('prefix').unnest()).toEqual(sort);
    });

    test('should fail when no common prefix exists', () => {
      expect(() => sort.unnest()).toThrow('Cannot unnest sort.');
    });
  });

  describe('factory', () => {
    describe('byPrimaryKeys', () => {
      test('should return a sort instance sorted by primary keys', () => {
        const collectionWithCompositeId = factories.collection.build({
          schema: factories.collectionSchema.build({
            fields: {
              id1: factories.columnSchema.isPrimaryKey().build(),
              id2: factories.columnSchema.isPrimaryKey().build(),
            },
          }),
        });
        expect(SortFactory.byPrimaryKeys(collectionWithCompositeId)).toEqual(
          new Sort({ field: 'id1', ascending: true }, { field: 'id2', ascending: true }),
        );
      });

      test('should return a sort instance sorted by primary key', () => {
        const collectionWithSimpleId = factories.collection.build({
          schema: factories.collectionSchema.build({
            fields: {
              id: factories.columnSchema.isPrimaryKey().build(),
            },
          }),
        });
        expect(SortFactory.byPrimaryKeys(collectionWithSimpleId)).toEqual(
          new Sort({ field: 'id', ascending: true }),
        );
      });
    });
  });
});

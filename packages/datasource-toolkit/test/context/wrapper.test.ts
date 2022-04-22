import * as factories from '../__factories__';
import { Caller } from '../../src/interfaces/caller';
import { Collection, DataSource } from '../../src/interfaces/collection';
import Aggregation from '../../src/interfaces/query/aggregation';
import ConditionTreeLeaf from '../../src/interfaces/query/condition-tree/nodes/leaf';
import Filter from '../../src/interfaces/query/filter/unpaginated';
import Page from '../../src/interfaces/query/page';
import PaginatedFilter from '../../src/interfaces/query/filter/paginated';
import Projection from '../../src/interfaces/query/projection';
import RelatedCollection from '../../src/context/relaxed-wrappers/collection';
import RelaxedDataSource from '../../src/context/relaxed-wrappers/datasource';
import Sort from '../../src/interfaces/query/sort';

describe('RelaxedWrappers', () => {
  describe('Datasource', () => {
    let dataSource: DataSource;
    let relaxed: RelaxedDataSource;

    beforeEach(() => {
      dataSource = factories.dataSource.build();
      relaxed = new RelaxedDataSource(dataSource, factories.caller.build());
    });

    test('should forward collection calls', () => {
      expect(relaxed.collections.length).toEqual(dataSource.collections.length);
    });

    test('should forward getCollection calls', () => {
      relaxed.getCollection('someCollection');
      expect(dataSource.getCollection).toHaveBeenCalledWith('someCollection');
    });

    test('should throw when calling addColection', () => {
      expect(() => relaxed.addCollection()).toThrow('Cannot modify existing datasources.');
    });
  });

  describe('Collection', () => {
    let collection: Collection;
    let relaxed: RelatedCollection;
    let caller: Caller;

    beforeEach(() => {
      caller = factories.caller.build();
      collection = factories.collection.build();
      relaxed = new RelatedCollection(collection, caller);
    });

    test('should return a related datasource', () => {
      expect(relaxed.dataSource).toBeInstanceOf(RelaxedDataSource);
    });

    test('should have a name', () => {
      expect(relaxed.name).toEqual(collection.name);
    });

    test('should get schema without changes', () => {
      expect(relaxed.schema).toBe(collection.schema);
    });

    test('should call list when provided with a plain object', async () => {
      const filter = {} as const;
      const projection = ['id', 'truc'];
      await relaxed.list(filter, projection);

      expect(collection.list).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(PaginatedFilter),
        expect.any(Projection),
      );

      expect(collection.list).toHaveBeenCalledWith(
        caller,
        new PaginatedFilter({}),
        new Projection('id', 'truc'),
      );
    });

    test('should call list when provided with a full plain object', async () => {
      await relaxed.list(
        {
          conditionTree: { field: 'id', operator: 'Equal', value: 123 },
          page: { skip: 0, limit: 10 },
          sort: [{ field: 'id', ascending: true }],
        },
        ['id', 'truc'],
      );

      expect(collection.list).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(PaginatedFilter),
        expect.any(Projection),
      );

      expect(collection.list).toHaveBeenCalledWith(
        caller,
        new PaginatedFilter({
          conditionTree: new ConditionTreeLeaf('id', 'Equal', 123),
          page: new Page(0, 10),
          sort: new Sort({ field: 'id', ascending: true }),
        }),
        new Projection('id', 'truc'),
      );
    });

    test('should call list when provided with a filter instance', async () => {
      await relaxed.list(
        new PaginatedFilter({ conditionTree: new ConditionTreeLeaf('id', 'Equal', 123) }),
        new Projection('id', 'truc'),
      );

      expect(collection.list).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(PaginatedFilter),
        expect.any(Projection),
      );

      expect(collection.list).toHaveBeenCalledWith(
        caller,
        new PaginatedFilter({ conditionTree: new ConditionTreeLeaf('id', 'Equal', 123) }),
        new Projection('id', 'truc'),
      );
    });

    test('should forward null filter to execute()', async () => {
      await relaxed.execute('action', {}, null);

      expect(collection.execute).toHaveBeenCalledWith(caller, 'action', {}, null);
    });

    test('should forward valid filter to execute()', async () => {
      await relaxed.execute('action', {}, { segment: 'some_segment' });

      expect(collection.execute).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.any(Filter),
      );
      expect(collection.execute).toHaveBeenCalledWith(
        caller,
        'action',
        {},
        new Filter({ segment: 'some_segment' }),
      );
    });

    test('should forward null filter to update()', async () => {
      await relaxed.getForm('action', {}, null);

      expect(collection.getForm).toHaveBeenCalledWith(caller, 'action', {}, null);
    });

    test('should forward valid filter to getForm()', async () => {
      await relaxed.getForm('action', {}, { segment: 'some_segment' });

      expect(collection.getForm).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.any(Filter),
      );
      expect(collection.getForm).toHaveBeenCalledWith(
        caller,
        'action',
        {},
        new Filter({ segment: 'some_segment' }),
      );
    });

    test('should forward creation to underlying collection', async () => {
      await relaxed.create([{ id: 12 }]);

      expect(collection.create).toHaveBeenCalledWith(caller, [{ id: 12 }]);
    });

    test('should forward update and transform filter', async () => {
      await relaxed.update({ segment: 'some_segment' }, { name: 'something' });

      expect(collection.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(Filter),
        expect.anything(),
      );
      expect(collection.update).toHaveBeenCalledWith(
        caller,
        new Filter({ segment: 'some_segment' }),
        { name: 'something' },
      );
    });

    test('should forward update and transform filter with real filter', async () => {
      await relaxed.update(new Filter({ segment: 'some_segment' }), { name: 'something' });

      expect(collection.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(Filter),
        expect.anything(),
      );
      expect(collection.update).toHaveBeenCalledWith(
        caller,
        new Filter({ segment: 'some_segment' }),
        { name: 'something' },
      );
    });

    test('should forward delete and transform filter', async () => {
      await relaxed.delete({ segment: 'some_segment' });

      expect(collection.delete).toHaveBeenCalledWith(expect.anything(), expect.any(Filter));
      expect(collection.delete).toHaveBeenCalledWith(
        caller,
        new Filter({ segment: 'some_segment' }),
      );
    });

    test('should call aggregate when provided with a plain object', async () => {
      const filter = { conditionTree: { field: 'id', operator: 'Equal', value: 123 } } as const;
      const aggregation = { operation: 'Count' } as const;
      await relaxed.aggregate(filter, aggregation, 66);

      expect(collection.aggregate).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(Filter),
        expect.any(Aggregation),
        expect.any(Number),
      );
      expect(collection.aggregate).toHaveBeenCalledWith(
        caller,
        new Filter({ conditionTree: new ConditionTreeLeaf('id', 'Equal', 123) }),
        new Aggregation({ operation: 'Count' }),
        66,
      );
    });

    test('should call aggregate when provided with instances', async () => {
      const filter = new Filter({ conditionTree: new ConditionTreeLeaf('id', 'Equal', 123) });
      const aggregation = new Aggregation({ operation: 'Count' });
      await relaxed.aggregate(filter, aggregation, 66);

      expect(collection.aggregate).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(Filter),
        expect.any(Aggregation),
        expect.any(Number),
      );
      expect(collection.aggregate).toHaveBeenCalledWith(
        caller,
        new Filter({ conditionTree: new ConditionTreeLeaf('id', 'Equal', 123) }),
        new Aggregation({ operation: 'Count' }),
        66,
      );
    });
  });
});

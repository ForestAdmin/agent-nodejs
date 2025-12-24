import type { Collection, DataSource } from '@forestadmin/datasource-toolkit';

import { Aggregation, DataSourceDecorator, Projection } from '@forestadmin/datasource-toolkit';
import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';

import LazyJoinDecorator from '../../../src/decorators/lazy-join/collection';

describe('LazyJoinDecorator', () => {
  let dataSource: DataSource;
  let decoratedDataSource: DataSourceDecorator<LazyJoinDecorator>;

  let transactions: Collection;
  let decoratedTransactions: LazyJoinDecorator;

  beforeEach(() => {
    const card = factories.collection.build({
      name: 'cards',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.uuidPrimaryKey().build(),
          type: factories.columnSchema.build(),
        },
      }),
    });

    const user = factories.collection.build({
      name: 'uses',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.uuidPrimaryKey().build(),
          name: factories.columnSchema.build(),
        },
      }),
    });

    transactions = factories.collection.build({
      name: 'transactions',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.uuidPrimaryKey().build(),
          description: factories.columnSchema.build(),
          amountInEur: factories.columnSchema.build(),
          card_id: factories.columnSchema.uuidPrimaryKey().build(),
          card: factories.manyToOneSchema.build({
            foreignCollection: 'cards',
            foreignKey: 'card_id',
          }),
          user_id: factories.columnSchema.uuidPrimaryKey().build(),
          user: factories.manyToOneSchema.build({
            foreignCollection: 'users',
            foreignKey: 'user_id',
          }),
        },
      }),
    });

    dataSource = factories.dataSource.buildWithCollections([card, user, transactions]);
    decoratedDataSource = new DataSourceDecorator(dataSource, LazyJoinDecorator);
    decoratedTransactions = decoratedDataSource.getCollection('transactions');
  });

  describe('list', () => {
    describe('when projection ask for foreign key only', () => {
      test('it should not join', async () => {
        const spy = jest.spyOn(transactions, 'list');
        spy.mockResolvedValue([{ id: 1, card_id: 2 }]);

        const caller = factories.caller.build();
        const filter = factories.filter.build();

        const records = await decoratedTransactions.list(
          caller,
          filter,
          new Projection('id', 'card:id'),
        );

        expect(spy).toHaveBeenCalledWith(caller, filter, new Projection('id', 'card_id'));
        expect(records).toStrictEqual([{ id: 1, card: { id: 2 } }]);
      });

      test('it should work with multiple relations', async () => {
        const spy = jest.spyOn(transactions, 'list');
        spy.mockResolvedValue([{ id: 1, card_id: 2, user_id: 3 }]);

        const caller = factories.caller.build();
        const filter = factories.filter.build();

        const records = await decoratedTransactions.list(
          caller,
          filter,
          new Projection('id', 'card:id', 'user:id'),
        );

        expect(spy).toHaveBeenCalledWith(
          caller,
          filter,
          new Projection('id', 'card_id', 'user_id'),
        );
        expect(records).toStrictEqual([{ id: 1, card: { id: 2 }, user: { id: 3 } }]);
      });

      test('it should disable join on projection but not in condition tree', async () => {
        const spy = jest.spyOn(transactions, 'list');
        spy.mockResolvedValue([{ id: 1, card_id: 2 }]);

        const caller = factories.caller.build();
        const filter = factories.filter.build({
          conditionTree: factories.conditionTreeLeaf.build({
            field: 'card:type',
            operator: 'Equal',
            value: 'Visa',
          }),
        });

        const records = await decoratedTransactions.list(
          caller,
          filter,
          new Projection('id', 'card:id'),
        );

        expect(spy).toHaveBeenCalledWith(caller, filter, new Projection('id', 'card_id'));
        expect(records).toStrictEqual([{ id: 1, card: { id: 2 } }]);
      });
    });

    describe('when projection ask for multiple fields in foreign collection', () => {
      test('it should join', async () => {
        const spy = jest.spyOn(transactions, 'list');
        spy.mockResolvedValue([{ id: 1, card: { id: 2, type: 'Visa' } }]);

        const caller = factories.caller.build();
        const filter = factories.filter.build();
        const projection = new Projection('id', 'card:id', 'card:type');

        const records = await decoratedTransactions.list(caller, filter, projection);

        expect(spy).toHaveBeenCalledWith(caller, filter, projection);
        expect(records).toStrictEqual([{ id: 1, card: { id: 2, type: 'Visa' } }]);
      });
    });

    describe('when condition tree is on foreign key only', () => {
      test('it should not join', async () => {
        const spy = jest.spyOn(transactions, 'list');
        spy.mockResolvedValue([{ id: 1, card: { id: 2, type: 'Visa' } }]);

        const caller = factories.caller.build();
        const projection = new Projection('id', 'card:id', 'card:type');
        const filter = factories.filter.build({
          conditionTree: factories.conditionTreeLeaf.build({
            field: 'card:id',
            operator: 'Equal',
            value: '2',
          }),
        });

        await decoratedTransactions.list(caller, filter, projection);

        const expectedFilter = factories.filter.build({
          conditionTree: factories.conditionTreeLeaf.build({
            field: 'card_id',
            operator: 'Equal',
            value: '2',
          }),
        });

        expect(spy).toHaveBeenCalledWith(caller, expectedFilter, projection);
      });
    });

    describe('when condition tree is on foreign collection fields', () => {
      test('it should join', async () => {
        const spy = jest.spyOn(transactions, 'list');
        spy.mockResolvedValue([{ id: 1, card: { id: 2, type: 'Visa' } }]);

        const caller = factories.caller.build();
        const projection = new Projection('id', 'card:id', 'card:type');
        const filter = factories.filter.build({
          conditionTree: factories.conditionTreeLeaf.build({
            field: 'card:type',
            operator: 'Equal',
            value: 'Visa',
          }),
        });

        await decoratedTransactions.list(caller, filter, projection);

        expect(spy).toHaveBeenCalledWith(caller, filter, projection);
      });
    });

    test('it should correctly handle null relations', async () => {
      const spy = jest.spyOn(transactions, 'list');
      spy.mockResolvedValue([{ id: 1, card_id: null }]);

      const caller = factories.caller.build();
      const filter = factories.filter.build();

      const records = await decoratedTransactions.list(
        caller,
        filter,
        new Projection('id', 'card:id'),
      );

      expect(spy).toHaveBeenCalledWith(caller, filter, new Projection('id', 'card_id'));
      expect(records).toStrictEqual([{ id: 1 }]);
    });

    describe('when projection ask for foreign key and relation', () => {
      test('it should not remove the key from the record', async () => {
        const spy = jest.spyOn(transactions, 'list');
        spy.mockResolvedValue([{ id: 1, card_id: 2 }]);

        const caller = factories.caller.build();
        const filter = factories.filter.build();

        const records = await decoratedTransactions.list(
          caller,
          filter,
          new Projection('id', 'card:id', 'card_id'),
        );

        expect(spy).toHaveBeenCalledWith(caller, filter, new Projection('id', 'card_id'));
        expect(records).toStrictEqual([{ id: 1, card: { id: 2 }, card_id: 2 }]);
      });
    });
  });

  describe('aggregate', () => {
    describe('when group by foreign pk', () => {
      test('it should not join', async () => {
        const spy = jest.spyOn(transactions, 'aggregate');
        spy.mockResolvedValue([
          { value: 1824.11, group: { user_id: 1 } },
          { value: 824, group: { user_id: 2 } },
        ]);

        const caller = factories.caller.build();
        const filter = factories.filter.build();

        const results = await decoratedTransactions.aggregate(
          caller,
          filter,
          new Aggregation({
            operation: 'Sum',
            field: 'amountInEur',
            groups: [{ field: 'user:id' }],
          }),
          1,
        );

        expect(spy).toHaveBeenCalledWith(
          caller,
          filter,
          new Aggregation({
            operation: 'Sum',
            field: 'amountInEur',
            groups: [{ field: 'user_id' }],
          }),
          1,
        );
        expect(results).toStrictEqual([
          { value: 1824.11, group: { 'user:id': 1 } },
          { value: 824, group: { 'user:id': 2 } },
        ]);
      });
    });

    describe('when group by foreign field', () => {
      test('it should join', async () => {
        const spy = jest.spyOn(transactions, 'aggregate');
        spy.mockResolvedValue([
          { value: 1824.11, group: { 'user:name': 'Brad' } },
          { value: 824, group: { 'user:name': 'Pit' } },
        ]);

        const caller = factories.caller.build();
        const filter = factories.filter.build();
        const aggregation = new Aggregation({
          operation: 'Sum',
          field: 'amountInEur',
          groups: [{ field: 'user:name' }],
        });

        const results = await decoratedTransactions.aggregate(caller, filter, aggregation, 1);

        expect(spy).toHaveBeenCalledWith(caller, filter, aggregation, 1);
        expect(results).toStrictEqual([
          { value: 1824.11, group: { 'user:name': 'Brad' } },
          { value: 824, group: { 'user:name': 'Pit' } },
        ]);
      });
    });

    describe('when filter on foreign pk', () => {
      test('it should not join', async () => {
        const spy = jest.spyOn(transactions, 'aggregate');
        spy.mockResolvedValue([
          { value: 1824.11, group: { 'user:name': 'Brad' } },
          { value: 824, group: { 'user:name': 'Pit' } },
        ]);

        const caller = factories.caller.build();
        const filter = factories.filter.build({
          conditionTree: factories.conditionTreeLeaf.build({
            field: 'card:id',
            operator: 'Equal',
            value: 1,
          }),
        });
        const aggregation = new Aggregation({
          operation: 'Sum',
          field: 'amountInEur',
          groups: [{ field: 'user:name' }],
        });

        const results = await decoratedTransactions.aggregate(caller, filter, aggregation, 1);

        const expectedFilter = factories.filter.build({
          conditionTree: factories.conditionTreeLeaf.build({
            field: 'card_id',
            operator: 'Equal',
            value: 1,
          }),
        });

        expect(spy).toHaveBeenCalledWith(caller, expectedFilter, aggregation, 1);
        expect(results).toStrictEqual([
          { value: 1824.11, group: { 'user:name': 'Brad' } },
          { value: 824, group: { 'user:name': 'Pit' } },
        ]);
      });
    });

    describe('when filter on foreign field', () => {
      test('it should join', async () => {
        const spy = jest.spyOn(transactions, 'aggregate');
        spy.mockResolvedValue([
          { value: 1824.11, group: { 'user:name': 'Brad' } },
          { value: 824, group: { 'user:name': 'Pit' } },
        ]);

        const caller = factories.caller.build();
        const filter = factories.filter.build({
          conditionTree: factories.conditionTreeLeaf.build({
            field: 'card:type',
            operator: 'Equal',
            value: 'Visa',
          }),
        });
        const aggregation = new Aggregation({
          operation: 'Sum',
          field: 'amountInEur',
          groups: [{ field: 'user:name' }],
        });

        const results = await decoratedTransactions.aggregate(caller, filter, aggregation, 1);

        expect(spy).toHaveBeenCalledWith(caller, filter, aggregation, 1);
        expect(results).toStrictEqual([
          { value: 1824.11, group: { 'user:name': 'Brad' } },
          { value: 824, group: { 'user:name': 'Pit' } },
        ]);
      });
    });
  });
});

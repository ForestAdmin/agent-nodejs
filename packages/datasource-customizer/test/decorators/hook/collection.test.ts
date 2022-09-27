import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';
import { Collection, DataSource } from '@forestadmin/datasource-toolkit';
import {
  HookAfterAggregateContext,
  HookBeforeAggregateContext,
} from '../../../src/decorators/hook/context/aggregate';
import {
  HookAfterCreateContext,
  HookBeforeCreateContext,
} from '../../../src/decorators/hook/context/create';
import {
  HookAfterDeleteContext,
  HookBeforeDeleteContext,
} from '../../../src/decorators/hook/context/delete';
import {
  HookAfterListContext,
  HookBeforeListContext,
} from '../../../src/decorators/hook/context/list';
import {
  HookAfterUpdateContext,
  HookBeforeUpdateContext,
} from '../../../src/decorators/hook/context/update';
import CollectionHookDecorator from '../../../src/decorators/hook/collection';
import DataSourceDecorator from '../../../src/decorators/datasource-decorator';

describe('CollectionHookDecorator', () => {
  let dataSource: DataSource;
  let decoratedDataSource: DataSourceDecorator<CollectionHookDecorator>;

  let transactions: Collection;
  let decoratedTransactions: CollectionHookDecorator;

  beforeEach(() => {
    transactions = factories.collection.build({
      name: 'transactions',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.isPrimaryKey().build({}),
          description: factories.columnSchema.build({}),
          amountInEur: factories.columnSchema.build({}),
        },
      }),
    });

    dataSource = factories.dataSource.buildWithCollections([transactions]);
    decoratedDataSource = new DataSourceDecorator(dataSource, CollectionHookDecorator);
    decoratedTransactions = decoratedDataSource.getCollection('transactions');
  });

  test('schema should not be changed', () => {
    expect(decoratedTransactions.schema).toStrictEqual(transactions.schema);
  });

  describe('when adding a before hook', () => {
    describe('on a list', () => {
      test('it should call the hook with valid parameters', async () => {
        const spy = jest.fn();
        decoratedTransactions.addHook('Before', 'List', spy);

        const currentCaller = factories.caller.build();
        const currentFilter = factories.filter.build();
        const currentProjection = factories.projection.build();
        const context = new HookBeforeListContext(
          transactions,
          currentCaller,
          currentFilter,
          currentProjection,
        );
        await decoratedTransactions.list(currentCaller, currentFilter, currentProjection);

        expect(spy).toHaveBeenCalledTimes(1);

        const spyArguments = spy.mock.calls[0][0];
        expect(spyArguments.caller).toEqual(context.caller);
        expect(spyArguments.filter).toEqual(context.filter);
        expect(spyArguments.projection).toEqual(context.projection);
      });
    });

    describe('on a create', () => {
      test('it should call the hook with valid parameters', async () => {
        const spy = jest.fn();
        decoratedTransactions.addHook('Before', 'Create', spy);

        const currentCaller = factories.caller.build();
        const currentData = [factories.recordData.build()];
        const context = new HookBeforeCreateContext(transactions, currentCaller, currentData);
        await decoratedTransactions.create(currentCaller, currentData);

        expect(spy).toHaveBeenCalledTimes(1);

        const spyArguments = spy.mock.calls[0][0];
        expect(spyArguments.caller).toEqual(context.caller);
        expect(spyArguments.data).toEqual(context.data);
      });
    });

    describe('on an update', () => {
      test('it should call the hook with valid parameters', async () => {
        const spy = jest.fn();
        decoratedTransactions.addHook('Before', 'Update', spy);

        const currentCaller = factories.caller.build();
        const currentFilter = factories.filter.build();
        const currentData = [factories.recordData.build()];
        const context = new HookBeforeUpdateContext(
          transactions,
          currentCaller,
          currentFilter,
          currentData,
        );
        await decoratedTransactions.update(currentCaller, currentFilter, currentData);

        expect(spy).toHaveBeenCalledTimes(1);

        const spyArguments = spy.mock.calls[0][0];
        expect(spyArguments.caller).toEqual(context.caller);
        expect(spyArguments.filter).toEqual(context.filter);
        expect(spyArguments.patch).toEqual(context.patch);
      });
    });

    describe('on a delete', () => {
      test('it should call the hook with valid parameters', async () => {
        const spy = jest.fn();
        decoratedTransactions.addHook('Before', 'Delete', spy);

        const currentCaller = factories.caller.build();
        const currentFilter = factories.filter.build();
        const context = new HookBeforeDeleteContext(transactions, currentCaller, currentFilter);
        await decoratedTransactions.delete(currentCaller, currentFilter);

        expect(spy).toHaveBeenCalledTimes(1);

        const spyArguments = spy.mock.calls[0][0];
        expect(spyArguments.caller).toEqual(context.caller);
        expect(spyArguments.filter).toEqual(context.filter);
      });
    });

    describe('on an aggregate', () => {
      test('it should call the hook with valid parameters', async () => {
        const spy = jest.fn();
        decoratedTransactions.addHook('Before', 'Aggregate', spy);

        const currentCaller = factories.caller.build();
        const currentFilter = factories.filter.build();
        const currentAggregation = factories.aggregation.build();
        const context = new HookBeforeAggregateContext(
          transactions,
          currentCaller,
          currentFilter,
          currentAggregation,
        );
        await decoratedTransactions.aggregate(currentCaller, currentFilter, currentAggregation);

        expect(spy).toHaveBeenCalledTimes(1);

        const spyArguments = spy.mock.calls[0][0];
        expect(spyArguments.caller).toEqual(context.caller);
        expect(spyArguments.filter).toEqual(context.filter);
        expect(spyArguments.aggregation).toEqual(context.aggregation);
      });
    });
  });

  describe('when adding an after hook', () => {
    describe('on a list', () => {
      test('it should call the hook with valid parameters', async () => {
        const spy = jest.fn();
        decoratedTransactions.addHook('After', 'List', spy);

        const currentCaller = factories.caller.build();
        const currentFilter = factories.filter.build();
        const currentProjection = factories.projection.build();
        const currentRecords = [factories.recordData.build()];

        jest.spyOn(transactions, 'list').mockResolvedValue(currentRecords);
        const decoratedListOfRecords = await decoratedTransactions.list(
          currentCaller,
          currentFilter,
          currentProjection,
        );
        const context = new HookAfterListContext(
          transactions,
          currentCaller,
          currentFilter,
          currentProjection,
          decoratedListOfRecords,
        );

        expect(spy).toHaveBeenCalledTimes(1);
        // The decorator is not supposed to change the list of records
        expect(decoratedListOfRecords).toEqual(currentRecords);

        const spyArguments = spy.mock.calls[0][0];
        expect(spyArguments.caller).toEqual(context.caller);
        expect(spyArguments.filter).toEqual(context.filter);
        expect(spyArguments.projection).toEqual(context.projection);
        expect(spyArguments.records).toEqual(context.records);
      });
    });

    describe('on a create', () => {
      test('it should call the hook with valid parameters', async () => {
        const spy = jest.fn();
        decoratedTransactions.addHook('After', 'Create', spy);

        const currentCaller = factories.caller.build();
        const currentData = [factories.recordData.build()];
        const currentRecords = [factories.recordData.build()];

        jest.spyOn(transactions, 'create').mockResolvedValue(currentRecords);
        const decoratedListOfCreatedRecords = await decoratedTransactions.create(
          currentCaller,
          currentData,
        );
        const context = new HookAfterCreateContext(
          transactions,
          currentCaller,
          currentData,
          decoratedListOfCreatedRecords,
        );

        expect(spy).toHaveBeenCalledTimes(1);
        expect(decoratedListOfCreatedRecords).toEqual(currentRecords);

        const spyArguments = spy.mock.calls[0][0];
        expect(spyArguments.caller).toEqual(context.caller);
        expect(spyArguments.data).toEqual(context.data);
        expect(spyArguments.records).toEqual(currentRecords);
      });
    });

    describe('on an update', () => {
      test('it should call the hook with valid parameters', async () => {
        const spy = jest.fn();
        decoratedTransactions.addHook('After', 'Update', spy);

        const currentCaller = factories.caller.build();
        const currentFilter = factories.filter.build();
        const currentData = [factories.recordData.build()];
        const context = new HookAfterUpdateContext(
          transactions,
          currentCaller,
          currentFilter,
          currentData,
        );
        await decoratedTransactions.update(currentCaller, currentFilter, currentData);

        expect(spy).toHaveBeenCalledTimes(1);

        const spyArguments = spy.mock.calls[0][0];
        expect(spyArguments.caller).toEqual(context.caller);
        expect(spyArguments.filter).toEqual(context.filter);
        expect(spyArguments.patch).toEqual(context.patch);
      });
    });

    describe('on a delete', () => {
      test('it should call the hook with valid parameters', async () => {
        const spy = jest.fn();
        decoratedTransactions.addHook('After', 'Delete', spy);

        const currentCaller = factories.caller.build();
        const currentFilter = factories.filter.build();
        const context = new HookAfterDeleteContext(transactions, currentCaller, currentFilter);
        await decoratedTransactions.delete(currentCaller, currentFilter);

        expect(spy).toHaveBeenCalledTimes(1);

        const spyArguments = spy.mock.calls[0][0];
        expect(spyArguments.caller).toEqual(context.caller);
        expect(spyArguments.filter).toEqual(context.filter);
      });
    });

    describe('on an aggregate', () => {
      test('it should call the hook with valid parameters', async () => {
        const spy = jest.fn();
        decoratedTransactions.addHook('After', 'Aggregate', spy);

        const currentCaller = factories.caller.build();
        const currentFilter = factories.filter.build();
        const currentAggregate = factories.aggregation.build();
        const currentAggregateResults = [factories.aggregateResult.build()];

        jest.spyOn(transactions, 'aggregate').mockResolvedValue(currentAggregateResults);
        const decoratedAggregateResult = await decoratedTransactions.aggregate(
          currentCaller,
          currentFilter,
          currentAggregate,
        );
        const context = new HookAfterAggregateContext(
          transactions,
          currentCaller,
          currentFilter,
          currentAggregate,
          decoratedAggregateResult,
        );

        expect(spy).toHaveBeenCalledTimes(1);
        expect(decoratedAggregateResult).toEqual(currentAggregateResults);

        const spyArguments = spy.mock.calls[0][0];
        expect(spyArguments.caller).toEqual(context.caller);
        expect(spyArguments.filter).toEqual(context.filter);
        expect(spyArguments.aggregation).toEqual(context.aggregation);
        expect(spyArguments.aggregateResult).toEqual(context.aggregateResult);
      });
    });
  });
});

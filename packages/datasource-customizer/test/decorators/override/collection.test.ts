import { Collection, DataSource, DataSourceDecorator } from '@forestadmin/datasource-toolkit';
import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';

import OverrideCollectionDecorator from '../../../src/decorators/override/collection';
import {
  CreateOverrideCustomizationContext,
  DeleteOverrideCustomizationContext,
  UpdateOverrideCustomizationContext,
} from '../../../src/decorators/override/context';

describe('OverrideCollectionDecorator', () => {
  let dataSource: DataSource;
  let decoratedDataSource: DataSourceDecorator<OverrideCollectionDecorator>;

  let transactions: Collection;
  let decoratedTransactions: OverrideCollectionDecorator;

  beforeEach(() => {
    transactions = factories.collection.build({
      name: 'transactions',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.uuidPrimaryKey().build(),
          description: factories.columnSchema.build(),
          amountInEur: factories.columnSchema.build(),
        },
      }),
    });

    dataSource = factories.dataSource.buildWithCollections([transactions]);
    decoratedDataSource = new DataSourceDecorator(dataSource, OverrideCollectionDecorator);
    decoratedTransactions = decoratedDataSource.getCollection('transactions');
  });

  test('schema should not be changed', () => {
    expect(decoratedTransactions.schema).toStrictEqual(transactions.schema);
  });

  describe('when no handler are set', () => {
    describe('on create', () => {
      test('it should call the original collection behavior', async () => {
        const spy = jest.spyOn(transactions, 'create');

        const currentCaller = factories.caller.build();
        const currentData = [factories.recordData.build()];
        await decoratedTransactions.create(currentCaller, currentData);

        expect(spy).toHaveBeenCalledTimes(1);

        const [caller, data] = spy.mock.calls[0];
        expect(caller).toEqual(currentCaller);
        expect(data).toEqual(currentData);
      });
    });

    describe('on update', () => {
      test('it should call the original collection behavior', async () => {
        const spy = jest.spyOn(transactions, 'update');

        const currentCaller = factories.caller.build();
        const currentFilter = factories.filter.build();
        const currentPatch = factories.recordData.build();
        await decoratedTransactions.update(currentCaller, currentFilter, currentPatch);

        expect(spy).toHaveBeenCalledTimes(1);

        const [caller, filter, patch] = spy.mock.calls[0];
        expect(caller).toEqual(currentCaller);
        expect(filter).toEqual(currentFilter);
        expect(patch).toEqual(currentPatch);
      });
    });

    describe('on delete', () => {
      test('it should call the original collection behavior', async () => {
        const spy = jest.spyOn(transactions, 'delete');

        const currentCaller = factories.caller.build();
        const currentFilter = factories.filter.build();
        await decoratedTransactions.delete(currentCaller, currentFilter);

        expect(spy).toHaveBeenCalledTimes(1);

        const [caller, filter] = spy.mock.calls[0];
        expect(caller).toEqual(currentCaller);
        expect(filter).toEqual(currentFilter);
      });
    });
  });

  describe('when seting up override', () => {
    describe('on create', () => {
      test('it should call the handler', async () => {
        const spy = jest.spyOn(transactions, 'create');
        const handler = jest.fn();

        const currentCaller = factories.caller.build();
        const currentData = [factories.recordData.build()];
        const context = new CreateOverrideCustomizationContext(
          transactions,
          currentCaller,
          currentData,
        );

        decoratedTransactions.addCreateHandler(handler);
        await decoratedTransactions.create(currentCaller, currentData);

        expect(spy).not.toHaveBeenCalled();
        expect(handler).toHaveBeenCalledTimes(1);

        const handlerArguments = handler.mock.calls[0][0];
        expect(handlerArguments.caller).toEqual(context.caller);
        expect(handlerArguments.data).toEqual(context.data);
      });
    });

    describe('on update', () => {
      test('it should call the handler', async () => {
        const spy = jest.spyOn(transactions, 'update');
        const handler = jest.fn();

        const currentCaller = factories.caller.build();
        const currentFilter = factories.filter.build();
        const currentPatch = factories.recordData.build();
        const context = new UpdateOverrideCustomizationContext(
          transactions,
          currentCaller,
          currentFilter,
          currentPatch,
        );

        decoratedTransactions.addUpdateHandler(handler);
        await decoratedTransactions.update(currentCaller, currentFilter, currentPatch);

        expect(spy).not.toHaveBeenCalled();
        expect(handler).toHaveBeenCalledTimes(1);

        const handlerArguments = handler.mock.calls[0][0];
        expect(handlerArguments.caller).toEqual(context.caller);
        expect(handlerArguments.filter).toEqual(context.filter);
        expect(handlerArguments.patch).toEqual(context.patch);
      });
    });

    describe('on delete', () => {
      test('it should call the handler', async () => {
        const spy = jest.spyOn(transactions, 'delete');
        const handler = jest.fn();

        const currentCaller = factories.caller.build();
        const currentFilter = factories.filter.build();
        const context = new DeleteOverrideCustomizationContext(
          transactions,
          currentCaller,
          currentFilter,
        );

        decoratedTransactions.addDeleteHandler(handler);
        await decoratedTransactions.delete(currentCaller, currentFilter);

        expect(spy).not.toHaveBeenCalled();
        expect(handler).toHaveBeenCalledTimes(1);

        const handlerArguments = handler.mock.calls[0][0];
        expect(handlerArguments.caller).toEqual(context.caller);
        expect(handlerArguments.filter).toEqual(context.filter);
      });
    });
  });
});

import {
  Collection,
  DataSource,
} from '@forestadmin/datasource-toolkit/dist/src/interfaces/collection';
import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';

import ChartCollectionDecorator from '../../../src/decorators/chart/collection';
import DataSourceDecorator from '../../../src/decorators/datasource-decorator';

describe('ChartCollectionDecorator', () => {
  let dataSource: DataSource;
  let decoratedDataSource: DataSourceDecorator<ChartCollectionDecorator>;
  let books: Collection;
  let decoratedBook: ChartCollectionDecorator;

  beforeEach(() => {
    books = factories.collection.build({
      name: 'books',
      schema: factories.collectionSchema.build({
        charts: ['childChart'],
        fields: {
          id: factories.columnSchema.numericPrimaryKey().build(),
        },
      }),
      list: jest.fn().mockResolvedValue([{ id: 123 }]),
      renderChart: jest.fn().mockResolvedValue({ countCurrent: 1 }),
    });

    dataSource = factories.dataSource.buildWithCollections([books]);
    decoratedDataSource = new DataSourceDecorator(dataSource, ChartCollectionDecorator);
    decoratedBook = decoratedDataSource.getCollection('books');
  });

  test('schema should not be changed', () => {
    expect(decoratedBook.schema).toStrictEqual(books.schema);
  });

  test('addChart should not let adding a chart with the same name', () => {
    const fn = () =>
      decoratedBook.addChart('childChart', jest.fn().mockResolvedValue({ countCurrent: 2 }));

    expect(fn).toThrow("Chart 'childChart' already exists.");
  });

  describe('when a chart is added (single pk)', () => {
    let handler: jest.Mock;

    beforeEach(() => {
      handler = jest.fn().mockResolvedValue({ countCurrent: 2 });
      decoratedBook.addChart('newChart', handler);
    });

    test('renderChart() should call the child collection', async () => {
      const caller = factories.caller.build();
      const result = await decoratedBook.renderChart(caller, 'childChart', [123]);

      expect(books.renderChart).toHaveBeenCalledWith(caller, 'childChart', [123]);
      expect(result).toStrictEqual({ countCurrent: 1 });
    });

    test('handler should be called when rendering the chart', async () => {
      const caller = factories.caller.build();
      const result = await decoratedBook.renderChart(caller, 'newChart', [123]);

      expect(result).toStrictEqual({ countCurrent: 2 });

      expect(handler.mock.calls[0][0].recordId).toEqual(123);
      expect(handler.mock.calls[0][0].compositeRecordId).toEqual([123]);
      await expect(handler.mock.calls[0][0].getRecord(['id'])).resolves.toEqual({ id: 123 });
    });
  });
});

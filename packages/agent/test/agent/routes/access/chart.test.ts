import { ValidationError } from '@forestadmin/datasource-toolkit';
import { createMockContext } from '@shopify/jest-koa-mocks';

import * as factories from '../../__factories__';
import Chart from '../../../../src/agent/routes/access/chart';

describe('ChartRoute', () => {
  const services = factories.forestAdminHttpDriverServices.build();
  const dataSource = factories.dataSource.buildWithCollections([
    factories.collection.build({
      name: 'publisher',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.isPrimaryKey().build(),
          authors: factories.manyToManySchema.build({
            foreignCollection: 'persons',
            throughCollection: 'books',
            foreignKey: 'authorId',
            originKey: 'publisherId',
          }),
        },
      }),
    }),
    factories.collection.build({
      name: 'books',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.isPrimaryKey().build(),
          name: factories.columnSchema.build({ columnType: 'String' }),
          publisher: factories.manyToOneSchema.build({
            foreignCollection: 'publisher',
            foreignKey: 'publisherId',
          }),
          publisherId: factories.columnSchema.build({ columnType: 'Uuid' }),
          authorId: factories.columnSchema.build({ columnType: 'Uuid' }),
          author: factories.manyToOneSchema.build({
            foreignCollection: 'persons',
            foreignKey: 'authorId',
          }),
          publishedAt: factories.columnSchema.build({ columnType: 'Date' }),
        },
      }),
    }),
    factories.collection.build({
      name: 'persons',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.isPrimaryKey().build(),
          books: factories.oneToManySchema.build({
            foreignCollection: 'books',
            originKey: 'authorId',
            originKeyTarget: 'id',
          }),
        },
      }),
    }),
  ]);
  const options = factories.forestAdminHttpDriverOptions.build();
  const router = factories.router.mockAllMethods().build();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should register "/stats/books" private routes', () => {
    const chart = new Chart(services, options, dataSource, 'books');
    chart.setupRoutes(router);

    expect(router.post).toHaveBeenCalledWith('/stats/books', expect.any(Function));
  });

  describe('when chart type does not exist', () => {
    test('should return an HTTP 400 error', async () => {
      const chart = new Chart(services, options, dataSource, 'books');
      const context = createMockContext({
        requestBody: { type: 'ChartTypeThatDoNotExist' },
      });

      await expect(chart.handleChart(context)).rejects.toThrow(
        new ValidationError('Invalid Chart type "ChartTypeThatDoNotExist"'),
      );
    });
  });

  describe('on value chart', () => {
    test('should call the collection aggregate with the correct parameters', async () => {
      jest
        .spyOn(dataSource.getCollection('books'), 'aggregate')
        .mockResolvedValue([{ value: 1234, group: null }]);
      const chart = new Chart(services, options, dataSource, 'books');
      const context = createMockContext({
        requestBody: { type: 'Value', aggregate: 'Count', collection: 'books', filters: undefined },
        customProperties: { query: { timezone: 'Europe/Paris' } },
      });

      await chart.handleChart(context);

      expect(dataSource.getCollection('books').aggregate).toHaveBeenCalledWith(
        {
          conditionTree: null,
          search: null,
          searchExtended: false,
          segment: null,
          timezone: 'Europe/Paris',
        },
        { field: undefined, groups: undefined, operation: 'Count' },
      );
      expect(context.response.body).toMatchObject({
        data: {
          attributes: { value: { countCurrent: 1234, countPrevious: undefined } },
          type: 'stats',
        },
      });
    });

    describe('when the data needs filtering', () => {
      describe('when the filter contains a previous-able filter', () => {
        test('should call aggregate twice', async () => {
          jest
            .spyOn(dataSource.getCollection('books'), 'aggregate')
            .mockResolvedValueOnce([{ value: 1234, group: null }])
            .mockResolvedValueOnce([{ value: 4321, group: null }]);
          const chart = new Chart(services, options, dataSource, 'books');
          const context = createMockContext({
            requestBody: {
              type: 'Value',
              aggregate: 'Count',
              collection: 'books',
              filters: JSON.stringify({ field: 'publishedAt', operator: 'Today', value: null }),
            },
            customProperties: { query: { timezone: 'Europe/Paris' } },
          });

          await chart.handleChart(context);

          expect(dataSource.getCollection('books').aggregate).toHaveBeenCalledTimes(2);
          expect(context.response.body).toMatchObject({
            data: {
              attributes: { value: { countCurrent: 1234, countPrevious: 4321 } },
              type: 'stats',
            },
          });
        });

        describe('when the Aggregator is And', () => {
          test('should call aggregate once, with the correct filter', async () => {
            jest
              .spyOn(dataSource.getCollection('books'), 'aggregate')
              .mockResolvedValue([{ value: 1234, group: null }]);
            const chart = new Chart(services, options, dataSource, 'books');
            const context = createMockContext({
              requestBody: {
                type: 'Value',
                aggregate: 'Count',
                collection: 'books',
                filters: JSON.stringify({
                  aggregator: 'And',
                  conditions: [
                    { field: 'publishedAt', operator: 'Today', value: null },
                    { field: 'publishedAt', operator: 'Yesterday', value: null },
                  ],
                }),
              },
              customProperties: { query: { timezone: 'Europe/Paris' } },
            });

            await chart.handleChart(context);

            expect(dataSource.getCollection('books').aggregate).toHaveBeenCalledTimes(1);
            expect(context.response.body).toMatchObject({
              data: {
                attributes: {
                  value: {
                    countCurrent: 1234,
                    countPrevious: undefined,
                  },
                },
                type: 'stats',
              },
            });
          });
        });
      });

      describe('on a basic filter', () => {
        test('should call aggregate once, with the correct filter', async () => {
          jest
            .spyOn(dataSource.getCollection('books'), 'aggregate')
            .mockResolvedValue([{ value: 1234, group: null }]);
          const chart = new Chart(services, options, dataSource, 'books');
          const context = createMockContext({
            requestBody: {
              type: 'Value',
              aggregate: 'Count',
              collection: 'books',
              filters: JSON.stringify({ field: 'name', operator: 'Present', value: null }),
            },
            customProperties: { query: { timezone: 'Europe/Paris' } },
          });

          await chart.handleChart(context);

          expect(dataSource.getCollection('books').aggregate).toHaveBeenCalledTimes(1);
          expect(dataSource.getCollection('books').aggregate).toHaveBeenCalledWith(
            {
              conditionTree: { field: 'name', operator: 'Present', value: null },
              search: null,
              searchExtended: false,
              segment: null,
              timezone: 'Europe/Paris',
            },
            { field: undefined, groups: undefined, operation: 'Count' },
          );
          expect(context.response.body).toMatchObject({
            data: {
              attributes: { value: { countCurrent: 1234, countPrevious: undefined } },
              type: 'stats',
            },
          });
        });
      });
    });

    describe('when the aggregation retun no data', () => {
      test('should return 0 as value', async () => {
        jest.spyOn(dataSource.getCollection('books'), 'aggregate').mockResolvedValue([]);
        const chart = new Chart(services, options, dataSource, 'books');
        const context = createMockContext({
          requestBody: { type: 'Value', aggregate: 'Count', collection: 'books' },
          customProperties: { query: { timezone: 'Europe/Paris' } },
        });

        await chart.handleChart(context);

        expect(context.response.body).toMatchObject({
          data: {
            attributes: {
              value: {
                countCurrent: 0,
                countPrevious: undefined,
              },
            },
            type: 'stats',
          },
        });
      });
    });
  });

  describe('on objective chart', () => {
    test('it should call the collection aggregate with the correct parameters', async () => {
      jest
        .spyOn(dataSource.getCollection('books'), 'aggregate')
        .mockResolvedValueOnce([{ value: 1234, group: null }]);
      const chart = new Chart(services, options, dataSource, 'books');
      const context = createMockContext({
        requestBody: { type: 'Objective', aggregate: 'Count', collection: 'books' },
        customProperties: { query: { timezone: 'Europe/Paris' } },
      });

      await chart.handleChart(context);

      expect(dataSource.getCollection('books').aggregate).toHaveBeenCalledWith(
        {
          conditionTree: null,
          search: null,
          searchExtended: false,
          segment: null,
          timezone: 'Europe/Paris',
        },
        { field: undefined, groups: undefined, operation: 'Count' },
      );

      expect(context.response.body).toMatchObject({
        data: {
          attributes: { value: { value: 1234 } },
          type: 'stats',
        },
      });
    });
  });

  describe('on pie chart', () => {
    test('it should call the collection aggregate with the correct parameters', async () => {
      jest
        .spyOn(dataSource.getCollection('books'), 'aggregate')
        .mockResolvedValueOnce([{ value: 1234, group: { 'author:firstName': 'Victor Hugo' } }]);
      const chart = new Chart(services, options, dataSource, 'books');
      const context = createMockContext({
        requestBody: {
          type: 'Pie',
          aggregate: 'Count',
          collection: 'books',
          group_by_field: 'author:firstName',
        },
        customProperties: { query: { timezone: 'Europe/Paris' } },
      });

      await chart.handleChart(context);

      expect(dataSource.getCollection('books').aggregate).toHaveBeenCalledWith(
        {
          conditionTree: null,
          search: null,
          searchExtended: false,
          segment: null,
          timezone: 'Europe/Paris',
        },
        { field: undefined, groups: [{ field: 'author:firstName' }], operation: 'Count' },
      );

      expect(context.response.body).toMatchObject({
        data: {
          attributes: {
            value: [
              {
                key: 'Victor Hugo',
                value: 1234,
              },
            ],
          },
          type: 'stats',
        },
      });
    });
  });

  describe('on line chart', () => {
    test('it should call the collection aggregate with the correct parameters', async () => {
      jest.spyOn(dataSource.getCollection('books'), 'aggregate').mockResolvedValueOnce([
        { value: 1234, group: { publication: '2022-02-16T10:00:00.000Z' } },
        { value: 456, group: { publication: '2022-02-02T10:00:00.000Z' } },
      ]);

      const chart = new Chart(services, options, dataSource, 'books');
      const context = createMockContext({
        requestBody: {
          type: 'Line',
          aggregate: 'Count',
          collection: 'books',
          group_by_date_field: 'publication',
          time_range: 'Week',
        },
        customProperties: { query: { timezone: 'Europe/Paris' } },
      });

      await chart.handleChart(context);

      expect(dataSource.getCollection('books').aggregate).toHaveBeenCalledWith(
        {
          conditionTree: null,
          search: null,
          searchExtended: false,
          segment: null,
          timezone: 'Europe/Paris',
        },
        {
          field: undefined,
          groups: [{ field: 'publication', operation: 'Week' }],
          operation: 'Count',
        },
      );

      expect(context.response.body).toMatchObject({
        data: {
          attributes: {
            value: [
              { label: 'W5-2022', values: { value: 456 } },
              { label: 'W6-2022', values: { value: 0 } },
              { label: 'W7-2022', values: { value: 1234 } },
            ],
          },
          type: 'stats',
        },
      });
    });
  });

  describe('on leaderboard chart', () => {
    test('it should call collection.aggregate (OneToMany)', async () => {
      jest.spyOn(dataSource.getCollection('books'), 'aggregate').mockResolvedValueOnce([
        { value: 1234, group: { 'author:id': 2 } },
        { value: 456, group: { 'author:id': 1 } },
      ]);

      const chart = new Chart(services, options, dataSource, 'persons');

      const context = createMockContext({
        requestBody: {
          type: 'Leaderboard',
          aggregate: 'Sum',
          aggregate_field: 'id',
          collection: 'persons',
          label_field: 'id',
          relationship_field: 'books',
          limit: 2,
        },
        customProperties: { query: { timezone: 'Europe/Paris' } },
      });

      await chart.handleChart(context);

      expect(dataSource.getCollection('books').aggregate).toHaveBeenCalledWith(
        {
          conditionTree: null,
          search: null,
          searchExtended: false,
          segment: null,
          timezone: 'Europe/Paris',
        },
        { field: 'id', groups: [{ field: 'author:id' }], operation: 'Sum' },
        2,
      );

      expect(context.response.body).toMatchObject({
        data: {
          attributes: {
            value: [
              { key: 2, value: 1234 },
              { key: 1, value: 456 },
            ],
          },
          type: 'stats',
        },
      });
    });

    test('it should call collection.aggregate (ManyToMany)', async () => {
      jest.spyOn(dataSource.getCollection('books'), 'aggregate').mockResolvedValueOnce([
        { value: 1234, group: { 'publisher:id': 2 } },
        { value: 456, group: { 'publisher:id': 1 } },
      ]);

      const chart = new Chart(services, options, dataSource, 'publisher');

      const context = createMockContext({
        requestBody: {
          type: 'Leaderboard',
          aggregate: 'Count',
          collection: 'publisher',
          label_field: 'id',
          relationship_field: 'authors',
          limit: 2,
        },
        customProperties: { query: { timezone: 'Europe/Paris' } },
      });

      await chart.handleChart(context);

      expect(dataSource.getCollection('books').aggregate).toHaveBeenCalledWith(
        {
          conditionTree: null,
          search: null,
          searchExtended: false,
          segment: null,
          timezone: 'Europe/Paris',
        },
        { operation: 'Count', field: null, groups: [{ field: 'publisher:id' }] },
        2,
      );

      expect(context.response.body).toMatchObject({
        data: {
          attributes: {
            value: [
              { key: 2, value: 1234 },
              { key: 1, value: 456 },
            ],
          },
          type: 'stats',
        },
      });
    });

    describe('when aggregation field is not present', () => {
      test('it should call the collection aggregate with the correct parameters', async () => {
        jest.spyOn(dataSource.getCollection('books'), 'aggregate').mockResolvedValueOnce([
          { value: 1234, group: { 'author:id': 2 } },
          { value: 456, group: { 'author:id': 1 } },
        ]);

        const chart = new Chart(services, options, dataSource, 'persons');

        const context = createMockContext({
          requestBody: {
            type: 'Leaderboard',
            aggregate: 'Count',
            collection: 'persons',
            label_field: 'id',
            relationship_field: 'books',
            limit: 2,
          },
          customProperties: { query: { timezone: 'Europe/Paris' } },
        });

        await chart.handleChart(context);

        expect(dataSource.getCollection('books').aggregate).toHaveBeenCalledWith(
          {
            conditionTree: null,
            search: null,
            searchExtended: false,
            segment: null,
            timezone: 'Europe/Paris',
          },
          { groups: [{ field: 'author:id' }], operation: 'Count' },
          2,
        );

        expect(context.response.body).toMatchObject({
          data: {
            attributes: {
              value: [
                { key: 2, value: 1234 },
                { key: 1, value: 456 },
              ],
            },
            type: 'stats',
          },
        });
      });

      describe('when relation field is invalid', () => {
        test('it should throw an error', async () => {
          jest.spyOn(dataSource.getCollection('persons'), 'aggregate').mockResolvedValueOnce([
            { value: 1234, group: { id: 2 } },
            { value: 456, group: { id: 1 } },
          ]);

          const chart = new Chart(services, options, dataSource, 'persons');

          const context = createMockContext({
            requestBody: {
              type: 'Leaderboard',
              aggregate: 'Count',
              collection: 'persons',
              label_field: 'id',
              relationship_field: 'invalid',
              limit: 2,
            },
            customProperties: { query: { timezone: 'Europe/Paris' } },
          });

          await expect(chart.handleChart(context)).rejects.toThrowError(
            new ValidationError(
              'Failed to generate leaderboard chart: parameters do not match pre-requisites',
            ),
          );
        });
      });
    });
  });
});

import { PrimitiveTypes } from '@forestadmin/datasource-toolkit';
import { createMockContext } from '@shopify/jest-koa-mocks';

import * as factories from '../../__factories__';
import { HttpCode } from '../../../src/types';
import Chart from '../../../src/routes/access/chart';

describe('GetRoute', () => {
  const services = factories.forestAdminHttpDriverServices.build();
  const dataSource = factories.dataSource.buildWithCollections([
    factories.collection.build({
      name: 'books',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.isPrimaryKey().build(),
          name: factories.columnSchema.build({
            columnType: PrimitiveTypes.String,
          }),
          author: factories.oneToOneSchema.build({
            foreignCollection: 'persons',
            foreignKey: 'bookId',
          }),
        },
      }),
    }),
    factories.collection.build({
      name: 'persons',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.isPrimaryKey().build(),
          bookId: factories.columnSchema.build({ columnType: PrimitiveTypes.Uuid }),
        },
      }),
    }),
  ]);
  const options = factories.forestAdminHttpDriverOptions.build();
  const router = factories.router.mockAllMethods().build();

  beforeEach(() => {
    (router.post as jest.Mock).mockClear();
    (dataSource.getCollection('books').aggregate as jest.Mock).mockClear();
  });

  test('should register "/stats/books" private routes', () => {
    const chart = new Chart(services, options, dataSource, 'books');
    chart.setupPrivateRoutes(router);

    expect(router.post).toHaveBeenCalledWith('/stats/books', expect.any(Function));
  });

  describe('when chart type does not exist', () => {
    test('should return an HTTP 400 error', async () => {
      const chart = new Chart(services, options, dataSource, 'books');
      const context = createMockContext({
        requestBody: { type: 'ChartTypeThatDoNotExist' },
      });

      await chart.handleChart(context);

      expect(context.throw).toHaveBeenCalledWith(
        HttpCode.BadRequest,
        'Invalid Chart type "ChartTypeThatDoNotExist"',
      );
      expect(context.throw).toHaveBeenCalledTimes(1);
    });
  });

  describe('on value chart', () => {
    test('should call the collection aggregate with the correct parameters ', async () => {
      jest
        .spyOn(dataSource.getCollection('books'), 'aggregate')
        .mockResolvedValue([{ value: 1234, group: null }]);
      const chart = new Chart(services, options, dataSource, 'books');
      const context = createMockContext({
        requestBody: { type: 'Value' },
        customProperties: { query: { timezone: 'Europe/Paris' } },
      });

      await chart.handleChart(context);

      expect(dataSource.getCollection('books').aggregate).toHaveBeenCalledTimes(1);
      expect(dataSource.getCollection('books').aggregate).toHaveBeenCalledWith(
        {
          conditionTree: null,
          search: undefined,
          searchExtended: undefined,
          segment: null,
          timezone: 'Europe/Paris',
        },
        {
          field: undefined,
          groups: undefined,
          operation: undefined,
        },
      );
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

    describe('when the data needs filtering', () => {
      describe('when the filter contains a previous-able filter', () => {
        test('should call aggregate twice', () => {});
      });

      describe('on a basic filter', () => {
        test('should call aggregate twice', async () => {
          jest
            .spyOn(dataSource.getCollection('books'), 'aggregate')
            .mockResolvedValue([{ value: 1234, group: null }]);
          const chart = new Chart(services, options, dataSource, 'books');
          const context = createMockContext({
            requestBody: {
              type: 'Value',
              filter: JSON.stringify({
                field: 'publication',
                operator: 'is_present',
                value: null,
              }),
            },
            customProperties: { query: { timezone: 'Europe/Paris' } },
          });

          await chart.handleChart(context);

          expect(dataSource.getCollection('books').aggregate).toHaveBeenCalledTimes(1);
          expect(dataSource.getCollection('books').aggregate).toHaveBeenCalledWith(
            {
              conditionTree: null,
              search: undefined,
              searchExtended: undefined,
              segment: null,
              timezone: 'Europe/Paris',
            },
            {
              field: undefined,
              groups: undefined,
              operation: undefined,
            },
          );
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
  });

  describe('on objective chart', () => {
    test('it should call the collection aggregate with the correct parameters ', () => {});
  });

  describe('on pie chart', () => {
    test('it should call the collection aggregate with the correct parameters ', () => {});
  });

  describe('on line chart', () => {
    test('it should call the collection aggregate with the correct parameters ', () => {});
  });

  describe('on leaderboard chart', () => {
    test('it should call the collection aggregate with the correct parameters ', () => {});
  });
});

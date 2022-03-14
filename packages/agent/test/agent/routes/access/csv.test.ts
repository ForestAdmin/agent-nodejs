import { PrimitiveTypes } from '@forestadmin/datasource-toolkit';
import { createMockContext } from '@shopify/jest-koa-mocks';

import * as factories from '../../__factories__';
import { readCsv } from '../../utils/csv-generator.test';
import ContextFilterFactory from '../../../../src/agent/utils/context-filter-factory';
import CsvGenerator from '../../../../src/utils/csv-generator';
import CsvRoute from '../../../../src/agent/routes/access/csv';

describe('CsvRoute', () => {
  function setup() {
    const options = factories.forestAdminHttpDriverOptions.build();
    const services = factories.forestAdminHttpDriverServices.build();
    const router = factories.router.mockAllMethods().build();
    const dataSource = factories.dataSource.buildWithCollection(
      factories.collection.build({
        name: 'books',
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.isPrimaryKey().build(),
            name: factories.columnSchema.build({
              columnType: PrimitiveTypes.String,
            }),
          },
        }),
      }),
    );

    return { options, services, router, dataSource };
  }

  test('should register GET books.csv route', () => {
    const { options, services, router, dataSource } = setup();
    const csvRoute = new CsvRoute(services, options, dataSource, 'books');

    csvRoute.setupRoutes(router);

    expect(router.get).toHaveBeenCalledWith('/books.csv', expect.any(Function));
  });

  describe('handleCsv', () => {
    it('should set the response headers correctly', async () => {
      const { options, services, dataSource } = setup();
      const csvRoute = new CsvRoute(services, options, dataSource, 'books');
      const customProperties = {
        query: { filename: 'csv_file_name', 'fields[books]': 'name', timezone: 'Europe/Paris' },
      };
      const context = createMockContext({ customProperties });

      await csvRoute.handleCsv(context);

      expect(context.response.headers).toEqual({
        'content-disposition': 'attachment; filename="attachment; filename=csv_file_name"',
        'last-modified': expect.any(String),
        'x-accel-buffering': 'no',
        'cache-control': 'no-cache',
        'content-type': 'application/octet-stream',
      });
    });

    it('calls the csv generator with the right params', async () => {
      // given
      const { options, services, dataSource } = setup();

      const csvRoute = new CsvRoute(services, options, dataSource, 'books');

      const projectionParams = { 'fields[books]': 'id,name' };
      const customProperties = {
        query: {
          ...projectionParams,
          header: 'id,name',
        },
      };
      const requestBody = { data: [{ id: '123e4567-e89b-12d3-a456-426614174000' }] };

      const scopeCondition = factories.conditionTreeLeaf.build();
      services.permissions.getScope = jest.fn().mockResolvedValue(scopeCondition);

      const context = createMockContext({ customProperties, requestBody });

      const booksCollection = dataSource.getCollection('books');
      booksCollection.list = jest.fn().mockReturnValue([]);
      const csvGenerator = jest.spyOn(CsvGenerator, 'generate');

      const paginatedFilter = factories.filter.build();
      const buildPaginated = jest
        .spyOn(ContextFilterFactory, 'buildPaginated')
        .mockReturnValue(paginatedFilter);
      // when
      await csvRoute.handleCsv(context);

      // then
      expect(services.permissions.can).toHaveBeenCalledWith(context, 'read:books');
      expect(services.permissions.can).toHaveBeenCalledWith(context, 'export:books');

      expect(buildPaginated).toHaveBeenCalledWith(booksCollection, context, scopeCondition);

      await readCsv(context.response.body as AsyncGenerator<string>);
      expect(csvGenerator).toHaveBeenCalledWith(
        ['id', 'name'],
        'id,name',
        paginatedFilter,
        booksCollection,
        expect.any(Function),
      );
    });

    it('should return the records as the csv format', async () => {
      const { options, services, dataSource } = setup();

      const csvRoute = new CsvRoute(services, options, dataSource, 'books');

      const projectionParams = { 'fields[books]': 'name,id' };
      const customProperties = {
        query: {
          ...projectionParams,
          header: 'name',
          timezone: 'Europe/Paris',
        },
      };

      const context = createMockContext({ customProperties });

      dataSource.getCollection('books').list = jest.fn().mockReturnValue([
        { id: 1, name: 'a' },
        { id: 2, name: 'ab' },
        { id: 3, name: 'abc' },
      ]);

      await csvRoute.handleCsv(context);

      const csvResult = await readCsv(context.response.body as AsyncGenerator<string>);
      expect(csvResult).toEqual(['name\n', 'a,1\nab,2\nabc,3\n']);
    });
  });
});

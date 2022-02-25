import { Aggregator, Filter, Operator, PrimitiveTypes } from '@forestadmin/datasource-toolkit';
import { createMockContext } from '@shopify/jest-koa-mocks';

import * as factories from '../../__factories__';
import { readCsv } from '../../utils/csv-generator.test';
import CsvGenerator from '../../../src/utils/csv-generator';
import CsvRoute from '../../../src/routes/access/csv';

describe('CsvRoute', () => {
  function setup() {
    const options = factories.forestAdminHttpDriverOptions.build();
    const services = factories.forestAdminHttpDriverServices.build();
    const router = factories.router.mockAllMethods().build();

    return { options, services, router };
  }

  test('should register GET books.csv route', () => {
    const { options, services, router } = setup();
    const bookCollection = factories.collection.build({ name: 'books' });
    const dataSource = factories.dataSource.buildWithCollections([bookCollection]);
    const updateRoute = new CsvRoute(services, options, dataSource, 'books');

    updateRoute.setupRoutes(router);

    expect(router.get).toHaveBeenCalledWith('/books.csv', expect.any(Function));
  });

  describe('handleCsv', () => {
    it('should set the response headers correctly', async () => {
      const { options, services } = setup();

      const dataSource = factories.dataSource.buildWithCollection(
        factories.collection.build({
          name: 'books',
          schema: factories.collectionSchema.build({
            fields: {
              name: factories.columnSchema.build({
                columnType: PrimitiveTypes.String,
              }),
            },
          }),
        }),
      );
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
      const { options, services } = setup();

      const dataSource = factories.dataSource.buildWithCollection(
        factories.collection.build({
          name: 'books',
          schema: factories.collectionSchema.build({
            segments: ['a-valid-segment'],
            fields: {
              id: factories.columnSchema.isPrimaryKey().build(),
              name: factories.columnSchema.build({
                columnType: PrimitiveTypes.String,
              }),
            },
          }),
        }),
      );
      const csvRoute = new CsvRoute(services, options, dataSource, 'books');

      const conditionTreeParams = {
        filters: JSON.stringify({
          aggregator: 'and',
          conditions: [
            { field: 'id', operator: 'equal', value: '123e4567-e89b-12d3-a456-426614174000' },
          ],
        }),
      };
      const projectionParams = { 'fields[books]': 'name' };
      const customProperties = {
        query: {
          ...projectionParams,
          ...conditionTreeParams,
          search: 'searched argument',
          header: 'id,name',
          filename: 'csv_file_name',
          segment: 'a-valid-segment',
          timezone: 'Europe/Paris',
        },
        params: { parentId: '123e4567-e89b-12d3-a456-426614174088' },
      };
      const requestBody = { data: [{ id: '123e4567-e89b-12d3-a456-426614174000' }] };

      const scopeCondition = factories.conditionTreeLeaf.build();
      services.permissions.getScope = jest.fn().mockResolvedValue(scopeCondition);

      const context = createMockContext({ customProperties, requestBody });

      dataSource.getCollection('books').list = jest.fn().mockReturnValue([
        { id: 1, name: 'a' },
        { id: 2, name: 'ab' },
        { id: 3, name: 'abc' },
      ]);
      const csvGenerator = jest.spyOn(CsvGenerator, 'generate');

      await csvRoute.handleCsv(context);

      await readCsv(context.response.body as AsyncGenerator<string>);
      expect(csvGenerator).toHaveBeenCalledWith(
        ['name', 'id'],
        'id,name',
        new Filter({
          conditionTree: factories.conditionTreeBranch.build({
            aggregator: Aggregator.And,
            conditions: [
              factories.conditionTreeLeaf.build({
                field: 'id',
                operator: Operator.Equal,
                value: '123e4567-e89b-12d3-a456-426614174000',
              }),
              scopeCondition,
            ],
          }),
          timezone: 'Europe/Paris',
          segment: 'a-valid-segment',
          search: 'searched argument',
        }),
        dataSource.getCollection('books'),
        expect.any(Function),
      );
    });

    it('should return the record as the csv format', async () => {
      const { options, services } = setup();

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
      const csvRoute = new CsvRoute(services, options, dataSource, 'books');

      const projectionParams = { 'fields[books]': 'name' };
      const customProperties = {
        query: {
          ...projectionParams,
          header: 'id,name',
          filename: 'csv_file_name',
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
      expect(csvResult).toEqual(['id,name\n', 'a,1\nab,2\nabc,3\n']);
    });
  });
});

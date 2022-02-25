import {
  Aggregator,
  CollectionUtils,
  Filter,
  Operator,
  PaginatedFilter,
  PrimitiveTypes,
  Projection,
} from '@forestadmin/datasource-toolkit';
import { createMockContext } from '@shopify/jest-koa-mocks';

import * as factories from '../../__factories__';
import { readCsv } from '../../utils/csv-generator.test';
import CsvGenerator from '../../../src/utils/csv-generator';
import CsvRoute from '../../../src/routes/access/csv-related';

describe('CsvRelatedRoute', () => {
  const setupWithOneToManyRelation = () => {
    const services = factories.forestAdminHttpDriverServices.build();
    const options = factories.forestAdminHttpDriverOptions.build();
    const router = factories.router.mockAllMethods().build();

    const persons = factories.collection.build({
      name: 'persons',
      schema: factories.collectionSchema.build({
        segments: ['a-valid-segment'],
        fields: {
          id: factories.columnSchema.isPrimaryKey().build(),
          name: factories.columnSchema.build({ columnType: PrimitiveTypes.String }),
        },
      }),
    });

    const books = factories.collection.build({
      name: 'books',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.isPrimaryKey().build(),
          myPersons: factories.oneToManySchema.build({
            foreignCollection: 'persons',
          }),
        },
      }),
    });
    const dataSource = factories.dataSource.buildWithCollections([persons, books]);

    return {
      dataSource,
      services,
      options,
      router,
    };
  };

  test('should register GET related route', () => {
    const { options, services, router } = setupWithOneToManyRelation();
    const bookCollection = factories.collection.build({ name: 'books' });
    const dataSource = factories.dataSource.buildWithCollections([bookCollection]);
    const csvRoute = new CsvRoute(services, options, dataSource, 'books', 'myPersons');

    csvRoute.setupRoutes(router);

    expect(router.get).toHaveBeenCalledWith(
      '/books/:parentId/relationships/myPersons.csv',
      expect.any(Function),
    );
  });

  describe('handleRelatedCsv', () => {
    it('should set the response headers correctly', async () => {
      const { options, services, dataSource } = setupWithOneToManyRelation();

      const csvRoute = new CsvRoute(services, options, dataSource, 'books', 'myPersons');

      const customProperties = {
        params: { parentId: '2d162303-78bf-599e-b197-93590ac3d315' },
        query: { filename: 'csv_file_name', 'fields[persons]': 'name', timezone: 'Europe/Paris' },
      };
      const context = createMockContext({ customProperties });
      await csvRoute.handleRelatedCsv(context);

      expect(context.response.headers).toEqual({
        'content-disposition': 'attachment; filename="attachment; filename=csv_file_name"',
        'last-modified': expect.any(String),
        'x-accel-buffering': 'no',
        'cache-control': 'no-cache',
        'content-type': 'application/octet-stream',
      });
    });

    it('calls the csv generator with the right params', async () => {
      const { options, services, dataSource } = setupWithOneToManyRelation();
      const csvRoute = new CsvRoute(services, options, dataSource, 'books', 'myPersons');

      const conditionTreeParams = {
        filters: JSON.stringify({
          aggregator: 'and',
          conditions: [
            { field: 'id', operator: 'equal', value: '123e4567-e89b-12d3-a456-426614174000' },
          ],
        }),
      };
      const projectionParams = { 'fields[persons]': 'id,name' };
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

      const listRelation = jest.spyOn(CollectionUtils, 'listRelation').mockResolvedValue([
        { id: 1, name: 'a' },
        { id: 2, name: 'ab' },
        { id: 3, name: 'abc' },
      ]);
      const csvGenerator = jest.spyOn(CsvGenerator, 'generate');

      await csvRoute.handleRelatedCsv(context);

      await readCsv(context.response.body as AsyncGenerator<string>);
      expect(csvGenerator).toHaveBeenCalledWith(
        new Projection('id', 'name'),
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
        dataSource.getCollection('persons'),
        expect.any(Function),
      );

      const parentId = ['123e4567-e89b-12d3-a456-426614174088'];
      expect(listRelation).toHaveBeenCalledWith(
        dataSource.getCollection('books'),
        parentId,
        'myPersons',
        expect.any(PaginatedFilter),
        expect.any(Projection),
      );
    });

    it('should return the records as the csv format', async () => {
      const { options, services, dataSource } = setupWithOneToManyRelation();
      const csvRoute = new CsvRoute(services, options, dataSource, 'books', 'myPersons');

      const projectionParams = { 'fields[persons]': 'name' };
      const customProperties = {
        params: { parentId: '123e4567-e89b-12d3-a456-426614174088' },
        query: {
          ...projectionParams,
          header: 'name',
          filename: 'csv_file_name',
          timezone: 'Europe/Paris',
        },
      };

      const context = createMockContext({ customProperties });

      jest
        .spyOn(CollectionUtils, 'listRelation')
        .mockResolvedValue([{ name: 'a' }, { name: 'ab' }, { name: 'abc' }]);

      await csvRoute.handleRelatedCsv(context);

      const csvResult = await readCsv(context.response.body as AsyncGenerator<string>);
      expect(csvResult).toEqual(['name\n', 'a\nab\nabc\n']);
    });
  });
});

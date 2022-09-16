import { CollectionUtils, PaginatedFilter, Projection } from '@forestadmin/datasource-toolkit';
import { createMockContext } from '@shopify/jest-koa-mocks';

import * as factories from '../../__factories__';
import { CollectionActionEvent } from '../../../../src/agent/services/authorization'';
import ContextFilterFactory from '../../../../src/agent/utils/context-filter-factory';
import CsvGenerator from '../../../../src/agent/utils/csv-generator';
import CsvRoute from '../../../../src/agent/routes/access/csv-related';
import readCsv from '../../__helper__/read-csv';

describe('CsvRelatedRoute', () => {
  const setupWithOneToManyRelation = () => {
    const services = factories.forestAdminHttpDriverServices.build();
    const options = factories.forestAdminHttpDriverOptions.build();
    const router = factories.router.mockAllMethods().build();

    const persons = factories.collection.build({
      name: 'persons',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.isPrimaryKey().build(),
          name: factories.columnSchema.build({ columnType: 'String' }),
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
      // given
      const { options, services, dataSource } = setupWithOneToManyRelation();
      const csvRoute = new CsvRoute(services, options, dataSource, 'books', 'myPersons');

      const projectionParams = { 'fields[persons]': 'id,name' };
      const scopeCondition = factories.conditionTreeLeaf.build();
      services.permissions.getScope = jest.fn().mockResolvedValue(scopeCondition);

      const personsCollection = dataSource.getCollection('persons');
      const context = createMockContext({
        requestBody: { data: [{ id: '123e4567-e89b-12d3-a456-426614174000' }] },
        state: { user: { email: 'john.doe@domain.com' } },
        customProperties: {
          query: {
            ...projectionParams,
            header: 'id,name',
            timezone: 'Europe/Paris',
          },
          params: { parentId: '123e4567-e89b-12d3-a456-111111111111' },
        },
      });

      const listRelation = jest.spyOn(CollectionUtils, 'listRelation').mockResolvedValue([]);
      const csvGenerator = jest.spyOn(CsvGenerator, 'generate');

      const paginatedFilter = factories.filter.build();
      const buildPaginated = jest
        .spyOn(ContextFilterFactory, 'buildPaginated')
        .mockReturnValue(paginatedFilter);

      // when
      await csvRoute.handleRelatedCsv(context);

      // then
      expect(buildPaginated).toHaveBeenCalledWith(personsCollection, context, scopeCondition);

      expect(services.authorization.assertCanOnCollection).toHaveBeenCalledWith(
        context,
        CollectionActionEvent.Browse,
        'books',
      );
      expect(services.authorization.assertCanOnCollection).toHaveBeenCalledWith(
        context,
        CollectionActionEvent.Export,
        'books',
      );

      await readCsv(context.response.body as AsyncGenerator<string>);
      expect(csvGenerator).toHaveBeenCalledWith(
        { email: 'john.doe@domain.com', timezone: 'Europe/Paris' },
        new Projection('id', 'name'),
        'id,name',
        paginatedFilter,
        personsCollection,
        expect.any(Function),
      );

      expect(listRelation).toHaveBeenCalledWith(
        dataSource.getCollection('books'),
        ['123e4567-e89b-12d3-a456-111111111111'],
        'myPersons',
        { email: 'john.doe@domain.com', timezone: 'Europe/Paris' },
        expect.any(PaginatedFilter),
        expect.any(Projection),
      );
    });

    it('should return the records as the csv format', async () => {
      const { options, services, dataSource } = setupWithOneToManyRelation();
      const csvRoute = new CsvRoute(services, options, dataSource, 'books', 'myPersons');

      const projectionParams = { 'fields[persons]': 'name,id' };
      const customProperties = {
        params: { parentId: '123e4567-e89b-12d3-a456-426614174088' },
        query: {
          ...projectionParams,
          header: 'name,id',
          filename: 'csv_file_name',
          timezone: 'Europe/Paris',
        },
      };

      const context = createMockContext({ customProperties });

      jest.spyOn(CollectionUtils, 'listRelation').mockResolvedValue([
        { id: 1, name: 'a' },
        { id: 2, name: 'ab' },
        { id: 3, name: 'abc' },
      ]);

      await csvRoute.handleRelatedCsv(context);

      const csvResult = await readCsv(context.response.body as AsyncGenerator<string>);
      expect(csvResult).toEqual(['name,id\n', 'a,1\nab,2\nabc,3']);
    });
  });
});

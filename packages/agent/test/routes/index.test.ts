import { DataSource } from '@forestadmin/datasource-toolkit';

// Mock the ai-proxy module to avoid langchain module resolution issues in tests
jest.mock('@forestadmin/ai-proxy', () => ({
  Router: jest.fn().mockImplementation(() => ({
    route: jest.fn(),
  })),
}));

import makeRoutes, {
  CAPABILITIES_ROUTES_CTOR,
  COLLECTION_ROUTES_CTOR,
  NATIVE_QUERY_ROUTES_CTOR,
  RELATED_RELATION_ROUTES_CTOR,
  RELATED_ROUTES_CTOR,
  ROOT_ROUTES_CTOR,
} from '../../src/routes';
import Chart from '../../src/routes/access/chart';
import Count from '../../src/routes/access/count';
import CountRelated from '../../src/routes/access/count-related';
import Csv from '../../src/routes/access/csv';
import CsvRelated from '../../src/routes/access/csv-related';
import Get from '../../src/routes/access/get';
import List from '../../src/routes/access/list';
import ListRelated from '../../src/routes/access/list-related';
import DataSourceNativeQueryRoute from '../../src/routes/access/native-query-datasource';
import Capabilities from '../../src/routes/capabilities';
import AssociateRelated from '../../src/routes/modification/associate-related';
import Create from '../../src/routes/modification/create';
import Delete from '../../src/routes/modification/delete';
import DissociateDeleteRelated from '../../src/routes/modification/dissociate-delete-related';
import Update from '../../src/routes/modification/update';
import UpdateField from '../../src/routes/modification/update-field';
import UpdateRelation from '../../src/routes/modification/update-relation';
import Authentication from '../../src/routes/security/authentication';
import IpWhitelist from '../../src/routes/security/ip-whitelist';
import ScopeInvalidation from '../../src/routes/security/scope-invalidation';
import ErrorHandling from '../../src/routes/system/error-handling';
import HealthCheck from '../../src/routes/system/healthcheck';
import Logger from '../../src/routes/system/logger';
import { RouteType } from '../../src/types';
import * as factories from '../__factories__';

describe('Route index', () => {
  it('should declare all the routes', () => {
    expect(ROOT_ROUTES_CTOR).toEqual([
      Authentication,
      ErrorHandling,
      HealthCheck,
      IpWhitelist,
      Logger,
      ScopeInvalidation,
    ]);
    expect(COLLECTION_ROUTES_CTOR).toEqual([
      Chart,
      Count,
      Create,
      Csv,
      Delete,
      Get,
      List,
      Update,
      UpdateField,
    ]);
    expect(RELATED_ROUTES_CTOR).toEqual([
      AssociateRelated,
      CountRelated,
      CsvRelated,
      DissociateDeleteRelated,
      ListRelated,
    ]);
    expect(CAPABILITIES_ROUTES_CTOR).toEqual([Capabilities]);
    expect(RELATED_RELATION_ROUTES_CTOR).toEqual([UpdateRelation]);
    expect(NATIVE_QUERY_ROUTES_CTOR).toEqual([DataSourceNativeQueryRoute]);
  });

  const BASE_ROUTE_SIZE =
    ROOT_ROUTES_CTOR.length + CAPABILITIES_ROUTES_CTOR.length + NATIVE_QUERY_ROUTES_CTOR.length;

  describe('makeRoutes', () => {
    describe('when a data source without relations', () => {
      const setupWithoutRelation = (): DataSource => {
        return factories.dataSource.buildWithCollections([
          factories.collection.build({ name: 'collectionA' }),
          factories.collection.build({ name: 'collectionB' }),
        ]);
      };

      test('should instantiate the basic routes', async () => {
        const dataSource = setupWithoutRelation();

        const routes = makeRoutes(
          dataSource,
          factories.forestAdminHttpDriverOptions.build(),
          factories.forestAdminHttpDriverServices.build(),
        );

        const countCollectionRoutes = COLLECTION_ROUTES_CTOR.length * dataSource.collections.length;
        expect(routes.length).toEqual(BASE_ROUTE_SIZE + countCollectionRoutes);
      });

      test('should order routes correctly', async () => {
        const dataSource = setupWithoutRelation();

        const routes = makeRoutes(
          dataSource,
          factories.forestAdminHttpDriverOptions.build(),
          factories.forestAdminHttpDriverServices.build(),
        );

        // with LoggerHandler in first
        expect(routes[0].type).toEqual(RouteType.LoggerHandler);

        // followed by ErrorHandler
        expect(routes[1].type).toEqual(RouteType.ErrorHandler);
      });
    });

    describe('when a data source with an one to many relation', () => {
      const setupWithOneToManyRelation = (): DataSource => {
        return factories.dataSource.buildWithCollections([
          factories.collection.build({
            name: 'books',
            schema: factories.collectionSchema.build({
              fields: {
                id: factories.columnSchema.uuidPrimaryKey().build(),
                personId: factories.columnSchema.build(),
              },
            }),
          }),

          factories.collection.build({
            name: 'persons',
            schema: factories.collectionSchema.build({
              fields: {
                id: factories.columnSchema.uuidPrimaryKey().build(),
                books: factories.oneToManySchema.build(),
              },
            }),
          }),
        ]);
      };

      test('should instantiate the basic and the related routes', async () => {
        const dataSource = setupWithOneToManyRelation();

        const routes = makeRoutes(
          dataSource,
          factories.forestAdminHttpDriverOptions.build(),
          factories.forestAdminHttpDriverServices.build(),
        );

        const countCollectionRoutes = COLLECTION_ROUTES_CTOR.length * dataSource.collections.length;
        expect(routes.length).toEqual(
          BASE_ROUTE_SIZE + countCollectionRoutes + RELATED_ROUTES_CTOR.length,
        );
      });
    });

    describe('when a data source with a many to many relation', () => {
      const setupManyToManyRelation = (): DataSource => {
        return factories.dataSource.buildWithCollections([
          factories.collection.build({
            name: 'libraries',
            schema: factories.collectionSchema.build({
              fields: {
                id: factories.columnSchema.uuidPrimaryKey().build(),
                manyToManyRelationField: factories.manyToManySchema.build(),
              },
            }),
          }),
          factories.collection.build({
            name: 'librariesBooks',
            schema: factories.collectionSchema.build({
              fields: {
                bookId: factories.columnSchema.uuidPrimaryKey().build(),
                libraryId: factories.columnSchema.uuidPrimaryKey().build(),
                myBook: factories.manyToOneSchema.build(),
                myLibrary: factories.manyToOneSchema.build(),
              },
            }),
          }),
          factories.collection.build({
            name: 'books',
            schema: factories.collectionSchema.build({
              fields: {
                id: factories.columnSchema.uuidPrimaryKey().build(),
                manyToManyRelationField: factories.manyToManySchema.build(),
              },
            }),
          }),
        ]);
      };

      test('should instantiate the basic, the related and the embedded routes', async () => {
        const dataSource = setupManyToManyRelation();

        const routes = makeRoutes(
          dataSource,
          factories.forestAdminHttpDriverOptions.build(),
          factories.forestAdminHttpDriverServices.build(),
        );

        const countCollectionRoutes = COLLECTION_ROUTES_CTOR.length * dataSource.collections.length;
        expect(routes.length).toEqual(
          BASE_ROUTE_SIZE +
            countCollectionRoutes +
            RELATED_ROUTES_CTOR.length * 2 +
            RELATED_RELATION_ROUTES_CTOR.length * 2,
        );
      });
    });

    describe('when a data source with ane one to many relation', () => {
      const setupWithOneToOneRelation = (): DataSource => {
        return factories.dataSource.buildWithCollections([
          factories.collection.build({
            name: 'book',
            schema: factories.collectionSchema.build({
              fields: {
                relation: factories.oneToOneSchema.build({
                  foreignCollection: 'owner',
                }),
              },
            }),
          }),
          factories.collection.build({
            name: 'owner',
            schema: factories.collectionSchema.build(),
          }),
        ]);
      };

      test('should instantiate the basic and embedded routes', async () => {
        const dataSource = setupWithOneToOneRelation();

        const routes = makeRoutes(
          dataSource,
          factories.forestAdminHttpDriverOptions.build(),
          factories.forestAdminHttpDriverServices.build(),
        );

        const countCollectionRoutes = COLLECTION_ROUTES_CTOR.length * dataSource.collections.length;
        expect(routes.length).toEqual(
          BASE_ROUTE_SIZE + countCollectionRoutes + RELATED_RELATION_ROUTES_CTOR.length,
        );
      });
    });

    describe('with a data source with a chart', () => {
      const setupWithChart = (): DataSource => {
        return factories.dataSource.build({
          schema: { charts: ['myChart'] },
          collections: [
            factories.collection.build({
              name: 'books',
              schema: factories.collectionSchema.build({
                charts: ['myChart'],
              }),
            }),
          ],
        });
      };

      test('should instantiate the basic routes', async () => {
        const dataSource = setupWithChart();

        const routes = makeRoutes(
          dataSource,
          factories.forestAdminHttpDriverOptions.build(),
          factories.forestAdminHttpDriverServices.build(),
        );

        // because there are two charts, there are two routes in addition to the basic ones
        expect(routes.length).toEqual(BASE_ROUTE_SIZE + COLLECTION_ROUTES_CTOR.length + 2);
      });
    });

    describe('with a data source with live query connections', () => {
      const setupWithChart = (): DataSource => {
        return factories.dataSource.build({
          nativeQueryConnections: { name: 'Postgre' },
          schema: { charts: ['myChart'] },
          collections: [
            factories.collection.build({
              name: 'books',
              schema: factories.collectionSchema.build({
                charts: ['myChart'],
              }),
            }),
          ],
        });
      };

      test('should instantiate the live query routes', async () => {
        const dataSource = setupWithChart();

        const routes = makeRoutes(
          dataSource,
          factories.forestAdminHttpDriverOptions.build(),
          factories.forestAdminHttpDriverServices.build(),
        );
        const lqRoute = routes.find(route => route instanceof DataSourceNativeQueryRoute);

        expect(lqRoute).toBeTruthy();
      });
    });

    describe('with AI configuration', () => {
      test('should instantiate AI proxy route when aiConfiguration is provided', async () => {
        const dataSource = factories.dataSource.buildWithCollection(
          factories.collection.build({ name: 'books' }),
        );
        const aiConfiguration = { provider: 'openai' as const, apiKey: 'test-key', model: 'gpt-4' };

        const routes = makeRoutes(
          dataSource,
          factories.forestAdminHttpDriverOptions.build(),
          factories.forestAdminHttpDriverServices.build(),
          aiConfiguration,
        );

        // Should have one more route than without AI configuration
        const routesWithoutAi = makeRoutes(
          dataSource,
          factories.forestAdminHttpDriverOptions.build(),
          factories.forestAdminHttpDriverServices.build(),
        );

        expect(routes.length).toEqual(routesWithoutAi.length + 1);
      });
    });
  });
});

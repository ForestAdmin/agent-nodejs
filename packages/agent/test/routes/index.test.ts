import { DataSource } from '@forestadmin/datasource-toolkit';
import makeRoutes, {
  COLLECTION_ROUTES_CTOR,
  EMBEDDED_ROUTES_CTOR,
  RELATED_ROUTES_CTOR,
  ROOT_ROUTES_CTOR,
} from '../../src/routes';

import * as factories from '../__factories__';
import Authentication from '../../src/routes/security/authentication';
import Chart from '../../src/routes/access/chart';
import Count from '../../src/routes/access/count';
import CountRelated from '../../src/routes/access/count-related';
import Create from '../../src/routes/modification/create';
import Delete from '../../src/routes/modification/delete';
import DissociateDeleteRelated from '../../src/routes/modification/dissociate-delete-related';
import ErrorHandling from '../../src/routes/system/error-handling';
import Get from '../../src/routes/access/get';
import HealthCheck from '../../src/routes/system/healthcheck';
import IpWhitelist from '../../src/routes/security/ip-whitelist';
import List from '../../src/routes/access/list';
import ListRelatedRoute from '../../src/routes/access/list-related';
import Logger from '../../src/routes/system/logger';
import ScopeInvalidation from '../../src/routes/security/scope-invalidation';
import Update from '../../src/routes/modification/update';
import UpdateEmbedded from '../../src/routes/modification/update-embedded';

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
    expect(COLLECTION_ROUTES_CTOR).toEqual([Chart, Count, Create, Delete, Get, List, Update]);
    expect(RELATED_ROUTES_CTOR).toEqual([CountRelated, DissociateDeleteRelated, ListRelatedRoute]);
    expect(EMBEDDED_ROUTES_CTOR).toEqual([UpdateEmbedded]);
  });

  describe('makeRoutes', () => {
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

    const setupWithoutRelation = (): DataSource => {
      return factories.dataSource.buildWithCollections([
        factories.collection.build({ name: 'collectionA' }),
        factories.collection.build({ name: 'collectionB' }),
      ]);
    };

    const setupManyToManyRelation = (): DataSource => {
      return factories.dataSource.buildWithCollections([
        factories.collection.build({
          name: 'libraries',
          schema: factories.collectionSchema.build({
            fields: {
              id: factories.columnSchema.isPrimaryKey().build(),
              manyToManyRelationField: factories.manyToManySchema.build(),
            },
          }),
        }),
        factories.collection.build({
          name: 'librariesBooks',
          schema: factories.collectionSchema.build({
            fields: {
              bookId: factories.columnSchema.isPrimaryKey().build(),
              libraryId: factories.columnSchema.isPrimaryKey().build(),
              myBook: factories.manyToOneSchema.build(),
              myLibrary: factories.manyToOneSchema.build(),
            },
          }),
        }),
        factories.collection.build({
          name: 'books',
          schema: factories.collectionSchema.build({
            fields: {
              id: factories.columnSchema.isPrimaryKey().build(),
              manyToManyRelationField: factories.manyToManySchema.build(),
            },
          }),
        }),
      ]);
    };

    const setupWithOneToManyRelation = (): DataSource => {
      return factories.dataSource.buildWithCollections([
        factories.collection.build({
          name: 'books',
          schema: factories.collectionSchema.build({
            fields: {
              id: factories.columnSchema.isPrimaryKey().build(),
              personId: factories.columnSchema.build(),
            },
          }),
        }),

        factories.collection.build({
          name: 'persons',
          schema: factories.collectionSchema.build({
            fields: {
              id: factories.columnSchema.isPrimaryKey().build(),
              books: factories.oneToManySchema.build(),
            },
          }),
        }),
      ]);
    };

    describe('when a data source without relations', () => {
      test('should instantiate the basic routes', async () => {
        const dataSource = setupWithoutRelation();

        const routes = makeRoutes(
          [dataSource],
          factories.forestAdminHttpDriverOptions.build(),
          factories.forestAdminHttpDriverServices.build(),
        );

        const countCollectionRoutes = COLLECTION_ROUTES_CTOR.length * dataSource.collections.length;
        expect(routes.length).toEqual(ROOT_ROUTES_CTOR.length + countCollectionRoutes);
      });
    });

    describe('when a data source with an one to many relation', () => {
      test('should instantiate the basic and the related routes', async () => {
        const dataSource = setupWithOneToManyRelation();

        const routes = makeRoutes(
          [dataSource],
          factories.forestAdminHttpDriverOptions.build(),
          factories.forestAdminHttpDriverServices.build(),
        );

        const countCollectionRoutes = COLLECTION_ROUTES_CTOR.length * dataSource.collections.length;
        expect(routes.length).toEqual(
          ROOT_ROUTES_CTOR.length + countCollectionRoutes + RELATED_ROUTES_CTOR.length,
        );
      });
    });

    describe('when a data source with a many to many relation', () => {
      test('should instantiate the basic, the related and the embedded routes', async () => {
        const dataSource = setupManyToManyRelation();

        const routes = makeRoutes(
          [dataSource],
          factories.forestAdminHttpDriverOptions.build(),
          factories.forestAdminHttpDriverServices.build(),
        );

        const countCollectionRoutes = COLLECTION_ROUTES_CTOR.length * dataSource.collections.length;
        expect(routes.length).toEqual(
          ROOT_ROUTES_CTOR.length +
            countCollectionRoutes +
            RELATED_ROUTES_CTOR.length * 2 +
            EMBEDDED_ROUTES_CTOR.length * 2,
        );
      });
    });

    describe('when a data source with ane one to many relation', () => {
      test('should instantiate the basic and embedded routes', async () => {
        const dataSource = setupWithOneToOneRelation();

        const routes = makeRoutes(
          [dataSource],
          factories.forestAdminHttpDriverOptions.build(),
          factories.forestAdminHttpDriverServices.build(),
        );

        const countCollectionRoutes = COLLECTION_ROUTES_CTOR.length * dataSource.collections.length;
        expect(routes.length).toEqual(
          ROOT_ROUTES_CTOR.length + countCollectionRoutes + EMBEDDED_ROUTES_CTOR.length,
        );
      });
    });
  });
});

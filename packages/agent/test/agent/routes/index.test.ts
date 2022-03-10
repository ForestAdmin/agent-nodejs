import { DataSource } from '@forestadmin/datasource-toolkit';
import makeRoutes, {
  COLLECTION_ROUTES_CTOR,
  RELATED_RELATION_ROUTES_CTOR,
  RELATED_ROUTES_CTOR,
  ROOT_ROUTES_CTOR,
} from '../../../src/agent/routes';

import * as factories from '../__factories__';
import Authentication from '../../../src/agent/routes/security/authentication';
import Chart from '../../../src/agent/routes/access/chart';
import Count from '../../../src/agent/routes/access/count';
import CountRelated from '../../../src/agent/routes/access/count-related';
import Create from '../../../src/agent/routes/modification/create';
import Delete from '../../../src/agent/routes/modification/delete';
import DissociateDeleteRelated from '../../../src/agent/routes/modification/dissociate-delete-related';
import ErrorHandling from '../../../src/agent/routes/system/error-handling';
import Get from '../../../src/agent/routes/access/get';
import HealthCheck from '../../../src/agent/routes/system/healthcheck';
import IpWhitelist from '../../../src/agent/routes/security/ip-whitelist';
import List from '../../../src/agent/routes/access/list';
import ListRelatedRoute from '../../../src/agent/routes/access/list-related';
import Logger from '../../../src/agent/routes/system/logger';
import ScopeInvalidation from '../../../src/agent/routes/security/scope-invalidation';
import Update from '../../../src/agent/routes/modification/update';
import UpdateRelation from '../../../src/agent/routes/modification/update-relation';

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
    expect(RELATED_RELATION_ROUTES_CTOR).toEqual([UpdateRelation]);
  });

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
        expect(routes.length).toEqual(ROOT_ROUTES_CTOR.length + countCollectionRoutes);
      });
    });

    describe('when a data source with an one to many relation', () => {
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

      test('should instantiate the basic and the related routes', async () => {
        const dataSource = setupWithOneToManyRelation();

        const routes = makeRoutes(
          dataSource,
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

      test('should instantiate the basic, the related and the embedded routes', async () => {
        const dataSource = setupManyToManyRelation();

        const routes = makeRoutes(
          dataSource,
          factories.forestAdminHttpDriverOptions.build(),
          factories.forestAdminHttpDriverServices.build(),
        );

        const countCollectionRoutes = COLLECTION_ROUTES_CTOR.length * dataSource.collections.length;
        expect(routes.length).toEqual(
          ROOT_ROUTES_CTOR.length +
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
          ROOT_ROUTES_CTOR.length + countCollectionRoutes + RELATED_RELATION_ROUTES_CTOR.length,
        );
      });
    });
  });
});

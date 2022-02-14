import { PrimitiveTypes } from '@forestadmin/datasource-toolkit';
import makeRoutes, {
  COLLECTION_ROUTES_CTOR,
  RELATED_ROUTES_CTOR,
  ROOT_ROUTES_CTOR,
} from '../../src/routes';

import * as factories from '../__factories__';
import Authentication from '../../src/routes/security/authentication';
import Count from '../../src/routes/access/count';
import CountRelatedRoute from '../../src/routes/access/count-related';
import Create from '../../src/routes/modification/create';
import Delete from '../../src/routes/modification/delete';
import DissociateRelatedRoute from '../../src/routes/modification/dissociate-delete-related';
import Get from '../../src/routes/access/get';
import HealthCheck from '../../src/routes/system/healthcheck';
import List from '../../src/routes/access/list';
import ListRelatedRoute from '../../src/routes/access/list-related';
import Update from '../../src/routes/modification/update';

describe('Route index', () => {
  describe('exports', () => {
    test('should export the required routes', () => {
      expect(ROOT_ROUTES_CTOR).toContain(Authentication);
      expect(ROOT_ROUTES_CTOR).toContain(HealthCheck);
    });

    describe.each([Count, Create, Delete, Get, List, Update])('the route', route => {
      it('should be defined', () => {
        expect(COLLECTION_ROUTES_CTOR).toContain(route);
      });
    });

    describe.each([CountRelatedRoute, ListRelatedRoute, DissociateRelatedRoute])(
      'the route',
      route => {
        it('should be defined', () => {
          expect(RELATED_ROUTES_CTOR).toContain(route);
        });
      },
    );
  });

  describe('makeRoutes', () => {
    const setupDataSources = () => {
      const books = factories.collection.build({
        name: 'books',
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.isPrimaryKey().build(),
            personId: factories.columnSchema.build({
              columnType: PrimitiveTypes.Number,
            }),
          },
        }),
      });

      const persons = factories.collection.build({
        name: 'persons',
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.isPrimaryKey().build(),
            books: factories.oneToManySchema.build({
              foreignCollection: 'books',
              foreignKey: 'personId',
            }),
          },
        }),
      });

      const dataSourceWithRelation = factories.dataSource.buildWithCollections([persons, books]);
      const dataSourceWithoutRelation = factories.dataSource.buildWithCollections([
        factories.collection.build({ name: 'collectionA' }),
        factories.collection.build({ name: 'collectionB' }),
      ]);

      return {
        dataSourceWithRelation,
        dataSourceWithoutRelation,
      };
    };

    test('should instantiate all the routes', async () => {
      const { dataSourceWithRelation, dataSourceWithoutRelation } = setupDataSources();

      const routes = makeRoutes(
        [dataSourceWithRelation, dataSourceWithoutRelation],
        factories.forestAdminHttpDriverOptions.build(),
        factories.forestAdminHttpDriverServices.build(),
      );

      const booksCollectionNoRelation = 1;
      const countRelationRoutes =
        RELATED_ROUTES_CTOR.length * dataSourceWithRelation.collections.length -
        booksCollectionNoRelation * RELATED_ROUTES_CTOR.length;
      const countCollectionRoutes =
        COLLECTION_ROUTES_CTOR.length * dataSourceWithRelation.collections.length +
        COLLECTION_ROUTES_CTOR.length * dataSourceWithoutRelation.collections.length;

      expect(routes.length).toEqual(
        ROOT_ROUTES_CTOR.length + countCollectionRoutes + countRelationRoutes,
      );
    });
  });
});

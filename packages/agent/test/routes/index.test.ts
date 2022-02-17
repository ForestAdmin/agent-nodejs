import { PrimitiveTypes } from '@forestadmin/datasource-toolkit';
import makeRoutes, {
  CollectionRoutesCtor,
  RelatedRoutesCtor,
  RootRoutesCtor,
} from '../../src/routes';

import * as factories from '../__factories__';
import Authentication from '../../src/routes/security/authentication';
import Count from '../../src/routes/access/count';
import CountRelatedRoute from '../../src/routes/access/count-related';
import Create from '../../src/routes/modification/create';
import Delete from '../../src/routes/modification/delete';
import Get from '../../src/routes/access/get';
import HealthCheck from '../../src/routes/system/healthcheck';
import List from '../../src/routes/access/list';
import Update from '../../src/routes/modification/update';

describe('Route index', () => {
  describe('exports', () => {
    test('should export the required routes', () => {
      expect(RootRoutesCtor).toContain(Authentication);
      expect(RootRoutesCtor).toContain(HealthCheck);
    });

    describe.each([Count, Create, Delete, Get, List, Update])('the route', route => {
      it('should be defined', () => {
        expect(CollectionRoutesCtor).toContain(route);
      });
    });

    describe.each([CountRelatedRoute])('the route', route => {
      it('should be defined', () => {
        expect(RelatedRoutesCtor).toContain(route);
      });
    });
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
        RelatedRoutesCtor.length * dataSourceWithRelation.collections.length -
        booksCollectionNoRelation * RelatedRoutesCtor.length;
      const countCollectionRoutes =
        CollectionRoutesCtor.length * dataSourceWithRelation.collections.length +
        CollectionRoutesCtor.length * dataSourceWithoutRelation.collections.length;

      expect(routes.length).toEqual(
        RootRoutesCtor.length + countCollectionRoutes + countRelationRoutes,
      );
    });
  });
});

import { PrimitiveTypes } from '@forestadmin/datasource-toolkit';
import * as factories from '../__factories__';
import ForestAdminHttpDriver from '../../src/forestadmin-http-driver';
import RoutesFactory from '../../src/routes/routes-factory';
import { RootRoutesCtor, CollectionRoutesCtor, RelatedRoutesCtor } from '../../src/routes';

describe('RoutesFactory', () => {
  test('should instantiate all the routes', async () => {
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

    const options = factories.forestAdminHttpDriverOptions.build();
    const dataSource = factories.dataSource.buildWithCollections([persons, books]);
    const httpDriver = new ForestAdminHttpDriver(dataSource, options);
    const services = factories.forestAdminHttpDriverServices.build();

    RoutesFactory.makeRoutes({
      dataSources: [dataSource],
      options,
      services,
      rootRoutes: RootRoutesCtor,
      collectionRoutes: CollectionRoutesCtor,
      relatedRoutes: RelatedRoutesCtor,
    });

    const countCollection = dataSource.collections.length;

    const booksCollectionNoRelation = 1;
    const countRelationRoutes =
      RelatedRoutesCtor.length * countCollection - booksCollectionNoRelation;
    const countCollectionRoutes = CollectionRoutesCtor.length * countCollection;

    expect(httpDriver.routes.length).toEqual(
      RootRoutesCtor.length + countCollectionRoutes + countRelationRoutes,
    );
  });
});

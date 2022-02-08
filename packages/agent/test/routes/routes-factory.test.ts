import { PrimitiveTypes } from '@forestadmin/datasource-toolkit';
import * as factories from '../__factories__';
import RoutesFactory from '../../src/routes/routes-factory';
import { RootRoutesCtor, CollectionRoutesCtor, RelatedRoutesCtor } from '../../src/routes';

describe('RoutesFactory', () => {
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

    const routes = RoutesFactory.makeRoutes({
      dataSources: [dataSourceWithRelation, dataSourceWithoutRelation],
      options: factories.forestAdminHttpDriverOptions.build(),
      services: factories.forestAdminHttpDriverServices.build(),
      rootRoutes: RootRoutesCtor,
      collectionRoutes: CollectionRoutesCtor,
      relatedRoutes: RelatedRoutesCtor,
    });

    const booksCollectionNoRelation = 1;
    const countRelationRoutes =
      RelatedRoutesCtor.length * dataSourceWithRelation.collections.length -
      booksCollectionNoRelation;
    const countCollectionRoutes =
      CollectionRoutesCtor.length * dataSourceWithRelation.collections.length +
      CollectionRoutesCtor.length * dataSourceWithoutRelation.collections.length;

    expect(routes.length).toEqual(
      RootRoutesCtor.length + countCollectionRoutes + countRelationRoutes,
    );
  });
});

import { PrimitiveTypes } from '@forestadmin/datasource-toolkit';

import * as factories from '../../__factories__';
import UpdateEmbeddedRoute from '../../../src/routes/modification/update-embedded';

describe('UpdateEmbeddedRoute', () => {
  const setupWithOneToManyRelation = () => {
    const services = factories.forestAdminHttpDriverServices.build();
    const options = factories.forestAdminHttpDriverOptions.build();
    const router = factories.router.mockAllMethods().build();

    const persons = factories.collection.build({
      name: 'persons',
      schema: factories.collectionSchema.build({
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

  test('should register PUT route', () => {
    const { services, dataSource, options, router } = setupWithOneToManyRelation();

    const count = new UpdateEmbeddedRoute(services, options, dataSource, 'books', 'myPersons');
    count.setupRoutes(router);

    expect(router.put).toHaveBeenCalledWith(
      '/books/:parentId/relationships/myPersons',
      expect.any(Function),
    );
  });

  describe('handleUpdateEmbeddedRoute', () => {});
});

import { PrimitiveTypes } from '@forestadmin/datasource-toolkit';

import * as factories from '../__factories__';

export const setupWithManyToManyRelation = () => {
  const services = factories.forestAdminHttpDriverServices.build();
  const options = factories.forestAdminHttpDriverOptions.build();
  const router = factories.router.mockAllMethods().build();

  const libraries = factories.collection.build({
    name: 'libraries',
    schema: factories.collectionSchema.build({
      fields: {
        id: factories.columnSchema.isPrimaryKey().build(),
        manyToManyRelationField: factories.manyToManySchema.build({
          throughCollection: 'librariesBooks',
          foreignRelation: 'myBook',
          foreignCollection: 'books',
          foreignKey: 'bookId',
          foreignKeyTarget: 'id',
          originKey: 'libraryId',
          originKeyTarget: 'id',
        }),
      },
    }),
  });

  const librariesBooks = factories.collection.build({
    name: 'librariesBooks',
    schema: factories.collectionSchema.build({
      fields: {
        bookId: factories.columnSchema.isPrimaryKey().build(),
        libraryId: factories.columnSchema.isPrimaryKey().build(),
        myBook: factories.manyToOneSchema.build({
          foreignCollection: 'books',
          foreignKey: 'bookId',
          foreignKeyTarget: 'id',
        }),
        myLibrary: factories.manyToOneSchema.build({
          foreignCollection: 'libraries',
          foreignKey: 'libraryId',
          foreignKeyTarget: 'id',
        }),
      },
    }),
  });

  const books = factories.collection.build({
    name: 'books',
    schema: factories.collectionSchema.build({
      fields: {
        id: factories.columnSchema.isPrimaryKey().build(),
        manyToManyRelationField: factories.manyToManySchema.build({
          throughCollection: 'librariesBooks',
          foreignRelation: 'myLibrary',
          foreignCollection: 'libraries',
          foreignKey: 'libraryId',
          foreignKeyTarget: 'id',
          originKey: 'bookId',
          originKeyTarget: 'id',
        }),
      },
    }),
  });
  const dataSource = factories.dataSource.buildWithCollections([librariesBooks, books, libraries]);

  return {
    dataSource,
    services,
    options,
    router,
  };
};

export const setupWithOneToManyRelation = () => {
  const services = factories.forestAdminHttpDriverServices.build();
  const options = factories.forestAdminHttpDriverOptions.build();
  const router = factories.router.mockAllMethods().build();

  const bookPersons = factories.collection.build({
    name: 'bookPersons',
    schema: factories.collectionSchema.build({
      fields: {
        id: factories.columnSchema.isPrimaryKey().build(),
        bookId: factories.columnSchema.build({
          columnType: PrimitiveTypes.Uuid,
        }),
      },
    }),
  });

  const books = factories.collection.build({
    name: 'books',
    schema: factories.collectionSchema.build({
      fields: {
        id: factories.columnSchema.isPrimaryKey().build(),
        myBookPersons: factories.oneToManySchema.build({
          foreignCollection: 'bookPersons',
          originKey: 'bookId',
          originKeyTarget: 'id',
        }),
      },
    }),
  });
  const dataSource = factories.dataSource.buildWithCollections([bookPersons, books]);

  return {
    dataSource,
    services,
    options,
    router,
  };
};

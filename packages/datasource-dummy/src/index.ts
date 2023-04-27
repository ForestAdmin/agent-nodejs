import { DataSourceCustomizer } from '@forestadmin/datasource-customizer';
import { DataSourceFactory } from '@forestadmin/datasource-toolkit';

import DummyDataSource from './datasource';

// eslint-disable-next-line import/prefer-default-export
export function createDummyDataSource(): DataSourceFactory {
  const customizer = new DataSourceCustomizer();

  customizer.addDataSource(async () => new DummyDataSource());

  customizer.customizeCollection('persons', collection =>
    collection.addOneToManyRelation('books', 'books', { originKey: 'authorId' }),
  );

  customizer.customizeCollection('books', collection =>
    collection
      .addManyToOneRelation('author', 'persons', { foreignKey: 'authorId' })
      .addManyToManyRelation('librairies', 'libraries', 'librariesBooks', {
        originKey: 'bookId',
        foreignKey: 'libraryId',
      }),
  );

  customizer.customizeCollection('libraries', collection =>
    collection.addManyToManyRelation('books', 'books', 'librariesBooks', {
      originKey: 'libraryId',
      foreignKey: 'bookId',
    }),
  );

  customizer.customizeCollection('librariesBooks', collection =>
    collection
      .addManyToOneRelation('book', 'books', { foreignKey: 'bookId' })
      .addManyToOneRelation('library', 'libraries', { foreignKey: 'libraryId' }),
  );

  return customizer.getFactory();
}

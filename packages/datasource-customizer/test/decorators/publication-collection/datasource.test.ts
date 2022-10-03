import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';
import { DataSource } from '@forestadmin/datasource-toolkit';
import PublicationCollectionDataSourceDecorator from '../../../src/decorators/publication-collection/datasource';

describe('PublicationCollectionDataSourceDecorator', () => {
  let dataSource: DataSource;
  let decoratedDataSource: PublicationCollectionDataSourceDecorator;

  beforeEach(() => {
    dataSource = factories.dataSource.buildWithCollections([
      factories.collection.build({
        name: 'libraries',
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.isPrimaryKey().build(),
            myBooks: factories.manyToManySchema.build({
              throughCollection: 'librariesBooks',
              foreignCollection: 'books',
              foreignKey: 'bookId',
              foreignKeyTarget: 'id',
              originKey: 'libraryId',
              originKeyTarget: 'id',
            }),
          },
        }),
      }),
      factories.collection.build({
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
      }),
      factories.collection.build({
        name: 'books',
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.isPrimaryKey().build(),
            myLibraries: factories.manyToManySchema.build({
              throughCollection: 'librariesBooks',
              foreignCollection: 'libraries',
              foreignKey: 'libraryId',
              foreignKeyTarget: 'id',
              originKey: 'bookId',
              originKeyTarget: 'id',
            }),
          },
        }),
      }),
    ]);

    decoratedDataSource = new PublicationCollectionDataSourceDecorator(dataSource);
  });

  test('should return all collections when no parameter is provided', () => {
    expect(decoratedDataSource.getCollection('libraries').schema).toStrictEqual(
      decoratedDataSource.getCollection('libraries').schema,
    );
    expect(decoratedDataSource.getCollection('librariesBooks').schema).toStrictEqual(
      decoratedDataSource.getCollection('librariesBooks').schema,
    );
    expect(decoratedDataSource.getCollection('books').schema).toStrictEqual(
      decoratedDataSource.getCollection('books').schema,
    );
  });

  describe('publicate', () => {
    it('should throw an error if a name is unknown', () => {
      expect(() => decoratedDataSource.publicate(['unknown'])).toThrowError(
        'Unknown collection name: "unknown"',
      );

      expect(() => decoratedDataSource.publicate(undefined, ['unknown'])).toThrowError(
        'Unknown collection name: "unknown"',
      );
    });

    it('should be able to remove "librariesBooks" collection', () => {
      decoratedDataSource.publicate(['libraries', 'books']);

      expect(() => decoratedDataSource.getCollection('librariesBooks')).toThrow();
      expect(decoratedDataSource.getCollection('libraries').schema.fields).not.toHaveProperty(
        'myLibrary',
      );
      expect(decoratedDataSource.getCollection('books').schema.fields).not.toHaveProperty(
        'myLibraries',
      );
    });

    it('should be able to remove "books" collection', () => {
      decoratedDataSource.publicate(undefined, ['books']);

      expect(() => decoratedDataSource.getCollection('books')).toThrow();
      expect(decoratedDataSource.getCollection('librariesBooks').schema.fields).not.toHaveProperty(
        'myBook',
      );
      expect(decoratedDataSource.getCollection('libraries').schema.fields).not.toHaveProperty(
        'myBooks',
      );
    });
  });
});

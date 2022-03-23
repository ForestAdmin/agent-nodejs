import * as factories from '../__factories__';
import { Projection, ProjectionFactory } from '../../src';

describe('ProjectionFactory', () => {
  describe('all', () => {
    const setupWithManyToOneAndOneToOneRelation = () => {
      const dataSource = factories.dataSource.buildWithCollections([
        factories.collection.build({
          name: 'books',
          schema: factories.collectionSchema.build({
            fields: {
              id: factories.columnSchema.isPrimaryKey().build(),
              myAuthor: factories.oneToOneSchema.build({
                foreignCollection: 'authors',
                foreignKey: 'bookId',
              }),
              formatId: factories.columnSchema.build(),
              myFormat: factories.manyToOneSchema.build({
                foreignCollection: 'formats',
                foreignKey: 'formatId',
              }),
              title: factories.columnSchema.build(),
            },
          }),
        }),
        factories.collection.build({
          name: 'authors',
          schema: factories.collectionSchema.build({
            fields: {
              id: factories.columnSchema.isPrimaryKey().build(),
              bookId: factories.columnSchema.build(),
              name: factories.columnSchema.build(),
            },
          }),
        }),
        factories.collection.build({
          name: 'formats',
          schema: factories.collectionSchema.build({
            fields: {
              id: factories.columnSchema.isPrimaryKey().build(),
              name: factories.columnSchema.build(),
            },
          }),
        }),
      ]);

      return { collection: dataSource.getCollection('books') };
    };

    it('should return all the collection fields and the relation fields', () => {
      const { collection } = setupWithManyToOneAndOneToOneRelation();

      expect(ProjectionFactory.all(collection)).toEqual(
        new Projection(
          'id',
          'myAuthor:id',
          'myAuthor:bookId',
          'myAuthor:name',
          'formatId',
          'myFormat:id',
          'myFormat:name',
          'title',
        ),
      );
    });
  });
});

import * as factories from '../__factories__';
import { Projection, ProjectionFactory } from '../../src';

describe('ProjectionFactory', () => {
  describe('all', () => {
    describe('with one to one and many to one relations', () => {
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

    describe('with other relation', () => {
      const setupWithOneToManyRelation = () => {
        const dataSource = factories.dataSource.buildWithCollections([
          factories.collection.build({
            name: 'bookPersons',
            schema: factories.collectionSchema.build({
              fields: {
                id: factories.columnSchema.isPrimaryKey().build(),
              },
            }),
          }),
          factories.collection.build({
            name: 'books',
            schema: factories.collectionSchema.build({
              fields: {
                id: factories.columnSchema.isPrimaryKey().build(),
                name: factories.columnSchema.build(),
                myBookPersons: factories.oneToManySchema.build({
                  foreignCollection: 'bookPersons',
                }),
              },
            }),
          }),
        ]);

        return { collection: dataSource.getCollection('books') };
      };

      it('should return all the collection fields without the relations', () => {
        const { collection } = setupWithOneToManyRelation();

        expect(ProjectionFactory.all(collection)).toEqual(new Projection('id', 'name'));
      });
    });
  });
});

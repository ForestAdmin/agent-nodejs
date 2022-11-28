import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';

import WriteDecorator from '../../../src/decorators/write/collection';

describe('WriteDecorator', () => {
  const setupWithManyToOneAndOneToOneRelation = () => {
    const dataSource = factories.dataSource.buildWithCollections([
      factories.collection.build({
        name: 'books',
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.uuidPrimaryKey().build(),
            myAuthor: factories.oneToOneSchema.build({
              foreignCollection: 'authors',
              originKey: 'bookId',
            }),
            formatId: factories.columnSchema.build({ columnType: 'Uuid' }),
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
            id: factories.columnSchema.uuidPrimaryKey().build(),
            bookId: factories.columnSchema.build({ columnType: 'Uuid' }),
            name: factories.columnSchema.build({ columnType: 'String' }),
          },
        }),
      }),
      factories.collection.build({
        name: 'formats',
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.uuidPrimaryKey().build(),
            name: factories.columnSchema.build({ columnType: 'String' }),
          },
        }),
      }),
    ]);

    return { dataSource, collection: dataSource.getCollection('books') };
  };

  it('creates the relations and attaches to the new collection', async () => {
    // given
    const { collection, dataSource } = setupWithManyToOneAndOneToOneRelation();
    const authorsCollection = dataSource.getCollection('authors');
    const formatsCollection = dataSource.getCollection('formats');

    const decoratedCollection = new WriteDecorator(collection, dataSource);
    const titleDefinition = jest.fn().mockResolvedValue({
      myAuthor: { name: 'Orius' },
      myFormat: { name: 'XXL' },
      title: 'a name',
    });
    decoratedCollection.replaceFieldWriting('title', titleDefinition);

    collection.create = jest
      .fn()
      .mockResolvedValue([{ id: '123e4567-e89b-12d3-a456-426614174087', title: 'a name' }]);
    authorsCollection.create = jest
      .fn()
      .mockResolvedValue([{ id: '123e4567-e89b-12d3-a456-111111111111', name: 'Orius' }]);
    formatsCollection.create = jest
      .fn()
      .mockResolvedValue([{ id: '123e4567-e89b-12d3-a456-222222222222', name: 'XXL' }]);

    // when
    const caller = factories.caller.build();
    await decoratedCollection.create(caller, [{ title: 'a title' }]);

    // then
    expect(collection.create).toHaveBeenCalledTimes(1);
    expect(collection.create).toHaveBeenCalledWith(caller, [
      { formatId: '123e4567-e89b-12d3-a456-222222222222', title: 'a name' },
    ]);
    expect(authorsCollection.create).toHaveBeenCalledWith(caller, [
      { bookId: '123e4567-e89b-12d3-a456-426614174087', name: 'Orius' },
    ]);
    expect(formatsCollection.create).toHaveBeenCalledWith(caller, [{ name: 'XXL' }]);
  });
});

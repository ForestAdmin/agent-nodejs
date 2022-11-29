import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';

import WriteDataSourceDecorator from '../../../../src/decorators/write/datasource';

describe('WriteDataSourceDecorator > with mixed relations', () => {
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

    const decorated = new WriteDataSourceDecorator(dataSource);

    return { dataSource, decorated };
  };

  it('creates the relations and attaches to the new collection', async () => {
    // given
    const { dataSource, decorated } = setupWithManyToOneAndOneToOneRelation();
    const books = dataSource.getCollection('books');
    const authors = dataSource.getCollection('authors');
    const formats = dataSource.getCollection('formats');
    const decoratedBooks = decorated.getCollection('books');

    const titleDefinition = jest.fn().mockResolvedValue({
      myAuthor: { name: 'Orius' },
      myFormat: { name: 'XXL' },
      title: 'a name',
    });
    decoratedBooks.replaceFieldWriting('title', titleDefinition);

    books.create = jest
      .fn()
      .mockResolvedValue([{ id: '123e4567-e89b-12d3-a456-426614174087', title: 'a name' }]);
    authors.create = jest
      .fn()
      .mockResolvedValue([{ id: '123e4567-e89b-12d3-a456-111111111111', name: 'Orius' }]);
    formats.create = jest
      .fn()
      .mockResolvedValue([{ id: '123e4567-e89b-12d3-a456-222222222222', name: 'XXL' }]);

    // when
    const caller = factories.caller.build();
    await decoratedBooks.create(caller, [{ title: 'a title' }]);

    // then
    expect(books.create).toHaveBeenCalledTimes(1);
    expect(books.create).toHaveBeenCalledWith(caller, [
      { formatId: '123e4567-e89b-12d3-a456-222222222222', title: 'a name' },
    ]);
    expect(authors.create).toHaveBeenCalledWith(caller, [
      { bookId: '123e4567-e89b-12d3-a456-426614174087', name: 'Orius' },
    ]);
    expect(formats.create).toHaveBeenCalledWith(caller, [{ name: 'XXL' }]);
  });
});

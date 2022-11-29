import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';

import WriteDataSourceDecorator from '../../../../src/decorators/write/datasource';

describe('WriteDataSourceDecorator > With many to one relations', () => {
  const setupWithTwoManyToOneRelations = () => {
    const formats = factories.collection.build({
      name: 'formats',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.uuidPrimaryKey().build(),
          name: factories.columnSchema.build({ columnType: 'String' }),
        },
      }),
    });

    const authors = factories.collection.build({
      name: 'authors',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.uuidPrimaryKey().build(),
          name: factories.columnSchema.build({ columnType: 'String' }),
          priceId: factories.columnSchema.build({ columnType: 'Uuid' }),
        },
      }),
    });

    const books = factories.collection.build({
      name: 'books',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.uuidPrimaryKey().build(),
          title: factories.columnSchema.build({ columnType: 'String' }),
          authorId: factories.columnSchema.build({ columnType: 'Uuid' }),
          myAuthor: factories.manyToOneSchema.build({
            foreignCollection: 'authors',
            foreignKey: 'authorId',
          }),
          formatId: factories.columnSchema.build({ columnType: 'Uuid' }),
          myFormat: factories.manyToOneSchema.build({
            foreignCollection: 'formats',
            foreignKey: 'formatId',
          }),
        },
      }),
    });
    const dataSource = factories.dataSource.buildWithCollections([authors, books, formats]);
    const decorated = new WriteDataSourceDecorator(dataSource);

    return { dataSource, decorated };
  };

  it('creates the relations and attaches to the new collection', async () => {
    // given
    const { dataSource, decorated } = setupWithTwoManyToOneRelations();
    const books = dataSource.getCollection('books');
    const authors = dataSource.getCollection('authors');
    const formats = dataSource.getCollection('formats');
    const decoratedBooks = decorated.getCollection('books');

    const titleDefinition = jest.fn().mockResolvedValue({
      myAuthor: { name: 'Orius' },
      myFormat: { name: 'XXL' },
      title: 'name',
    });
    decoratedBooks.replaceFieldWriting('title', titleDefinition);

    authors.create = jest
      .fn()
      .mockResolvedValue([{ id: '123e4567-e89b-12d3-a456-111111111111', name: 'Orius' }]);
    formats.create = jest
      .fn()
      .mockResolvedValue([{ id: '123e4567-e89b-12d3-a456-222222222222', name: 'XXL' }]);
    books.create = jest.fn().mockResolvedValue([{ title: 'name' }]);

    // when
    const caller = factories.caller.build();
    await decoratedBooks.create(caller, [{ title: 'a title' }]);

    // then
    expect(authors.create).toHaveBeenCalledWith(caller, [{ name: 'Orius' }]);
    expect(formats.create).toHaveBeenCalledWith(caller, [{ name: 'XXL' }]);
    expect(books.create).toHaveBeenCalledWith(caller, [
      {
        title: 'name',
        formatId: '123e4567-e89b-12d3-a456-222222222222',
        authorId: '123e4567-e89b-12d3-a456-111111111111',
      },
    ]);
  });
});

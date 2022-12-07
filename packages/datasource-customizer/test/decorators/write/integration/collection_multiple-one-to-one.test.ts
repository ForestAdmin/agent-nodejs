import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';

import WriteDataSourceDecorator from '../../../../src/decorators/write/datasource';

describe('WriteDataSourceDecorator > With one to one relations', () => {
  const setupWithTwoOneToOneRelations = () => {
    const dataSource = factories.dataSource.buildWithCollections([
      factories.collection.build({
        name: 'books',
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.uuidPrimaryKey().build(),
            myOwner: factories.oneToOneSchema.build({
              foreignCollection: 'owners',
              originKey: 'bookId',
            }),
            myFormat: factories.oneToOneSchema.build({
              foreignCollection: 'formats',
              originKey: 'bookId',
            }),
            title: factories.columnSchema.build(),
          },
        }),
      }),
      factories.collection.build({
        name: 'owners',
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
            bookId: factories.columnSchema.build({ columnType: 'Uuid' }),
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
    const { dataSource, decorated } = setupWithTwoOneToOneRelations();
    const books = dataSource.getCollection('books');
    const owners = dataSource.getCollection('owners');
    const formats = dataSource.getCollection('formats');

    const decoratedBooks = decorated.getCollection('books');
    const titleDefinition = jest.fn().mockResolvedValue({
      myOwner: { name: 'Orius' },
      myFormat: { name: 'XXL' },
      title: 'name',
    });
    decoratedBooks.replaceFieldWriting('title', titleDefinition);
    books.create = jest
      .fn()
      .mockResolvedValue([
        { id: '123e4567-e89b-12d3-a456-111111111111', notImportantColumn: 'foo' },
      ]);

    // when
    const caller = factories.caller.build();
    await decoratedBooks.create(caller, [{ title: 'a title' }]);

    // then
    expect(owners.create).toHaveBeenCalledWith(caller, [
      { name: 'Orius', bookId: '123e4567-e89b-12d3-a456-111111111111' },
    ]);
    expect(formats.create).toHaveBeenCalledWith(caller, [
      { name: 'XXL', bookId: '123e4567-e89b-12d3-a456-111111111111' },
    ]);
    expect(books.create).toHaveBeenCalledTimes(1);
    expect(books.create).toHaveBeenCalledWith(caller, [{ title: 'name' }]);
  });
});

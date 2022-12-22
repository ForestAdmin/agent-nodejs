import { Filter } from '@forestadmin/datasource-toolkit';
import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';

import WriteDataSourceDecorator from '../../../../src/decorators/write/datasource';

describe('WriteDataSourceDecorator > With one to one relations', () => {
  const setupWithOneToOneRelation = () => {
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
    ]);

    const decorated = new WriteDataSourceDecorator(dataSource);

    return { dataSource, decorated };
  };

  it('updates the right relation collection with the right params', async () => {
    // given
    const { dataSource, decorated } = setupWithOneToOneRelation();
    const books = dataSource.getCollection('books');
    const decoratedBooks = decorated.getCollection('books');

    const titleDefinition = jest.fn().mockResolvedValue({ myOwner: { name: 'NAME TO CHANGE' } });
    decoratedBooks.replaceFieldWriting('title', titleDefinition);
    books.list = jest.fn().mockResolvedValue([
      {
        id: '123e4567-e89b-12d3-a456-111111111111',
        myOwner: {
          id: '123e4567-e89b-12d3-a456-000000000000',
        },
      },
    ]);

    // when
    const caller = factories.caller.build();
    const filter = factories.filter.build({
      conditionTree: factories.conditionTreeLeaf.build({
        operator: 'Equal',
        value: 'a name',
        field: 'name',
      }),
    });

    await decoratedBooks.update(caller, filter, { title: 'a title' });

    // then
    expect(books.list).toHaveBeenCalledWith(caller, filter, ['id', 'myOwner:id']);

    const ownersCollection = dataSource.getCollection('owners');
    const conditionTreeBookId = factories.conditionTreeLeaf.build({
      operator: 'Equal',
      value: '123e4567-e89b-12d3-a456-000000000000',
      field: 'id',
    });
    expect(books.update).not.toHaveBeenCalled();
    expect(ownersCollection.update).toHaveBeenCalledWith(
      caller,
      new Filter({ conditionTree: conditionTreeBookId }),
      { name: 'NAME TO CHANGE' },
    );
  });

  it('creates the relation and attaches to the new collection', async () => {
    // given
    const { dataSource, decorated } = setupWithOneToOneRelation();
    const owners = dataSource.getCollection('owners');
    const books = dataSource.getCollection('books');
    const decoratedBooks = decorated.getCollection('books');

    const titleDefinition = jest
      .fn()
      .mockResolvedValue({ myOwner: { name: 'NAME TO CHANGE' }, title: 'name' });
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
      { name: 'NAME TO CHANGE', bookId: '123e4567-e89b-12d3-a456-111111111111' },
    ]);
    expect(books.create).toHaveBeenCalledWith(caller, [{ title: 'name' }]);
  });

  // Romain:
  // I'm skipping this test because I'm really not sure that this behavior is correct so I
  // removed it while refactoring the write decorator.
  //
  // It relies on specifying a field in the created record that is not in the schema, which
  // will break as soon as we have better validation.
  //
  // Note that I did keep the behavior for many to one relations, which feel more natural.
  // If this gets reintroduced, I think the syntax should be the same for both types of relations.
  //
  // decoratedBooks.replaceFieldWriting('title', { myOwner: { id: value, name: 'newName' } });

  // eslint-disable-next-line jest/no-disabled-tests
  it.skip('updates the relation and attaches to the new collection', async () => {
    // given
    const { dataSource, decorated } = setupWithOneToOneRelation();
    const books = dataSource.getCollection('books');
    const owners = dataSource.getCollection('owners');
    const decoratedBooks = decorated.getCollection('books');

    const titleDefinition = jest
      .fn()
      .mockResolvedValue({ myOwner: { name: 'NAME TO CHANGE' }, title: 'name' });
    decoratedBooks.replaceFieldWriting('title', titleDefinition);
    books.create = jest.fn().mockResolvedValue([{ title: 'name' }]);

    // when
    const caller = factories.caller.build();
    await decoratedBooks.create(caller, [
      { title: 'a title', bookId: '123e4567-e89b-12d3-a456-111111111111' },
    ]);

    // then
    expect(books.create).toHaveBeenCalledWith(caller, [{ title: 'name' }]);
    expect(owners.update).toHaveBeenCalledWith(
      caller,
      new Filter({
        conditionTree: factories.conditionTreeLeaf.build({
          operator: 'Equal',
          value: '123e4567-e89b-12d3-a456-111111111111',
          field: 'bookId',
        }),
      }),
      { name: 'NAME TO CHANGE' },
    );
  });
});

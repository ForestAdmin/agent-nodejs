import { Filter } from '@forestadmin/datasource-toolkit';
import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';

import WriteDataSourceDecorator from '../../../../src/decorators/write/datasource';

describe('WriteDataSourceDecorator > With many to one relations', () => {
  const setupWithManyToOneRelation = () => {
    const prices = factories.collection.build({
      name: 'prices',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.uuidPrimaryKey().build(),
          value: factories.columnSchema.build({ columnType: 'Number' }),
        },
      }),
    });

    const persons = factories.collection.build({
      name: 'persons',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.uuidPrimaryKey().build(),
          name: factories.columnSchema.build({ columnType: 'String' }),
          priceId: factories.columnSchema.build({ columnType: 'Uuid' }),
          myPrice: factories.manyToOneSchema.build({
            foreignCollection: 'prices',
            foreignKey: 'priceId',
          }),
        },
      }),
    });

    const books = factories.collection.build({
      name: 'books',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.uuidPrimaryKey().build(),
          authorId: factories.columnSchema.build({ columnType: 'Uuid' }),
          title: factories.columnSchema.build({ columnType: 'String' }),
          myAuthor: factories.manyToOneSchema.build({
            foreignCollection: 'persons',
            foreignKey: 'authorId',
          }),
        },
      }),
    });
    const dataSource = factories.dataSource.buildWithCollections([persons, books, prices]);
    const decorated = new WriteDataSourceDecorator(dataSource);

    return { dataSource, decorated };
  };

  it('updates the right relation collection with the right params', async () => {
    // given
    const { dataSource, decorated } = setupWithManyToOneRelation();
    const books = dataSource.getCollection('books');
    const persons = dataSource.getCollection('persons');
    const decoratedBooks = decorated.getCollection('books');

    const titleDefinition = jest.fn().mockResolvedValue({ myAuthor: { name: 'NAME TO CHANGE' } });
    decoratedBooks.replaceFieldWriting('title', titleDefinition);

    (books.list as jest.Mock).mockResolvedValue([
      { id: 1, myAuthor: { id: '123e4567-e89b-12d3-a456-111111111111' } },
      { id: 2, myAuthor: { id: '123e4567-e89b-12d3-a456-222222222222' } },
    ]);

    // when
    const caller = factories.caller.build();
    const conditionTree = factories.conditionTreeLeaf.build();
    const filter = factories.filter.build({ conditionTree });

    await decoratedBooks.update(caller, filter, { title: 'a title' });

    // then
    expect(books.update).not.toHaveBeenCalled();
    expect(books.list).toHaveBeenCalledWith(caller, filter, ['id', 'myAuthor:id']);
    expect(persons.update).toHaveBeenCalledWith(
      caller,
      new Filter({
        conditionTree: factories.conditionTreeLeaf.build({
          operator: 'In',
          value: ['123e4567-e89b-12d3-a456-111111111111', '123e4567-e89b-12d3-a456-222222222222'],
          field: 'id',
        }),
      }),
      { name: 'NAME TO CHANGE' },
    );
  });

  it('updates a 2 degree relation', async () => {
    // given
    const { dataSource, decorated } = setupWithManyToOneRelation();
    const books = dataSource.getCollection('books');
    const persons = dataSource.getCollection('persons');
    const prices = dataSource.getCollection('prices');
    const decoratedPrices = decorated.getCollection('prices');
    const decoratedBooks = decorated.getCollection('books');

    decoratedPrices.update = jest.fn();

    const titleDefinition = jest.fn().mockResolvedValue({ myAuthor: { myPrice: { value: 10 } } });
    decoratedBooks.replaceFieldWriting('title', titleDefinition);

    books.list = jest
      .fn()
      .mockResolvedValue([{ myAuthor: { id: '123e4567-e89b-12d3-a456-111111111111' } }]);

    persons.list = jest
      .fn()
      .mockResolvedValue([{ myPrice: { id: '123e4567-e89b-12d3-a456-333333333333' } }]);

    // when
    const caller = factories.caller.build();
    const conditionTree = factories.conditionTreeLeaf.build();
    await decoratedBooks.update(caller, factories.filter.build({ conditionTree }), {
      title: 'a title',
    });

    // then
    expect(books.list).toHaveBeenCalledWith(caller, new Filter({ conditionTree }), [
      'id',
      'myAuthor:id',
    ]);
    expect(persons.list).toHaveBeenCalledWith(
      caller,
      new Filter({
        conditionTree: factories.conditionTreeLeaf.build({
          field: 'id',
          value: '123e4567-e89b-12d3-a456-111111111111',
          operator: 'Equal',
        }),
      }),
      ['id', 'myPrice:id'],
    );

    expect(books.update).not.toHaveBeenCalled();
    expect(prices.update).toHaveBeenCalledWith(
      caller,
      new Filter({
        conditionTree: factories.conditionTreeLeaf.build({
          operator: 'Equal',
          value: '123e4567-e89b-12d3-a456-333333333333',
          field: 'id',
        }),
      }),
      { value: 10 },
    );
  });

  it('creates the relation and attaches to the new collection', async () => {
    // given
    const { dataSource, decorated } = setupWithManyToOneRelation();
    const books = dataSource.getCollection('books');
    const decoratedBooks = decorated.getCollection('books');

    const titleDefinition = jest.fn().mockResolvedValue({ myAuthor: { name: 'NAME TO CHANGE' } });
    decoratedBooks.replaceFieldWriting('title', titleDefinition);

    const personsCollection = dataSource.getCollection('persons');
    personsCollection.create = jest
      .fn()
      .mockResolvedValue([{ id: '123e4567-e89b-12d3-a456-111111111111', name: 'NAME TO CHANGE' }]);
    books.create = jest.fn().mockResolvedValue([{ title: 'name' }]);

    // when
    const caller = factories.caller.build();
    await decoratedBooks.create(caller, [{ title: 'a title' }]);

    // then
    expect(books.create).toHaveBeenCalledWith(caller, [
      { authorId: '123e4567-e89b-12d3-a456-111111111111' },
    ]);
    expect(personsCollection.create).toHaveBeenCalledWith(caller, [{ name: 'NAME TO CHANGE' }]);
  });

  it('updates the relation and attaches to the new collection', async () => {
    // given
    const { dataSource, decorated } = setupWithManyToOneRelation();
    const books = dataSource.getCollection('books');
    const persons = dataSource.getCollection('persons');
    const decoratedBooks = decorated.getCollection('books');

    const titleDefinition = jest.fn().mockResolvedValue({ myAuthor: { name: 'NAME TO CHANGE' } });
    decoratedBooks.replaceFieldWriting('title', titleDefinition);

    persons.create = jest
      .fn()
      .mockResolvedValue([{ id: '123e4567-e89b-12d3-a456-111111111111', name: 'NAME TO CHANGE' }]);
    books.create = jest.fn().mockResolvedValue([{ title: 'name' }]);

    // when
    const caller = factories.caller.build();
    await decoratedBooks.create(caller, [
      { title: 'a title', authorId: '123e4567-e89b-12d3-a456-111111111111' },
    ]);

    // then
    expect(books.create).toHaveBeenCalledWith(caller, [
      { authorId: '123e4567-e89b-12d3-a456-111111111111' },
    ]);
    expect(persons.update).toHaveBeenCalledWith(
      caller,
      new Filter({
        conditionTree: factories.conditionTreeLeaf.build({
          operator: 'Equal',
          value: '123e4567-e89b-12d3-a456-111111111111',
          field: 'id',
        }),
      }),
      { name: 'NAME TO CHANGE' },
    );
  });
});

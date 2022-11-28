import { Filter, PaginatedFilter } from '@forestadmin/datasource-toolkit';
import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';

import DataSourceDecorator from '../../../src/decorators/datasource-decorator';
import WriteDecorator from '../../../src/decorators/write/collection';

describe('WriteDecorator > With many to one relations', () => {
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

    return { dataSource, collection: dataSource.getCollection('books') };
  };

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

    return { dataSource, collection: dataSource.getCollection('books') };
  };

  it('updates the right relation collection with the right params', async () => {
    // given
    const { collection, dataSource } = setupWithManyToOneRelation();

    const decoratedCollection = new WriteDecorator(collection, dataSource);
    const titleDefinition = jest.fn().mockResolvedValue({ myAuthor: { name: 'NAME TO CHANGE' } });
    decoratedCollection.replaceFieldWriting('title', titleDefinition);

    const personsCollection = dataSource.getCollection('persons');
    collection.list = jest
      .fn()
      .mockResolvedValue([
        { authorId: '123e4567-e89b-12d3-a456-111111111111' },
        { authorId: '123e4567-e89b-12d3-a456-222222222222' },
      ]);

    // when
    const caller = factories.caller.build();
    const conditionTree = factories.conditionTreeLeaf.build();
    await decoratedCollection.update(caller, factories.filter.build({ conditionTree }), {
      title: 'a title',
    });

    // then
    expect(collection.list).toHaveBeenCalledWith(caller, new PaginatedFilter({ conditionTree }), [
      'authorId',
    ]);
    expect(collection.update).toHaveBeenCalledWith(
      caller,
      new PaginatedFilter({ conditionTree }),
      {},
    );
    expect(personsCollection.update).toHaveBeenCalledWith(
      caller,
      new Filter({
        conditionTree: factories.conditionTreeLeaf.build({
          operator: 'In',
          value: ['123e4567-e89b-12d3-a456-111111111111', '123e4567-e89b-12d3-a456-222222222222'],
          field: 'id',
        }),
      }),
      {
        name: 'NAME TO CHANGE',
      },
    );
  });

  it('updates a 2 degree relation', async () => {
    // given
    const { collection, dataSource } = setupWithManyToOneRelation();

    const decoratedDataSource = new DataSourceDecorator(dataSource, WriteDecorator);

    const pricesCollection = decoratedDataSource.getCollection('prices');
    pricesCollection.update = jest.fn();

    const decoratedCollection = decoratedDataSource.getCollection('books');
    const titleDefinition = jest.fn().mockResolvedValue({ myAuthor: { myPrice: { value: 10 } } });
    decoratedCollection.replaceFieldWriting('title', titleDefinition);

    decoratedCollection.list = jest
      .fn()
      .mockResolvedValue([{ authorId: '123e4567-e89b-12d3-a456-111111111111' }]);

    const personsCollection = decoratedDataSource.getCollection('persons');
    personsCollection.list = jest
      .fn()
      .mockResolvedValue([{ priceId: '123e4567-e89b-12d3-a456-333333333333' }]);

    // when
    const caller = factories.caller.build();
    const conditionTree = factories.conditionTreeLeaf.build();
    await decoratedCollection.update(caller, factories.filter.build({ conditionTree }), {
      title: 'a title',
    });

    // then
    expect(decoratedCollection.list).toHaveBeenCalledWith(
      caller,
      new PaginatedFilter({ conditionTree }),
      ['authorId'],
    );
    expect(personsCollection.list).toHaveBeenCalledWith(
      caller,
      new Filter({
        conditionTree: factories.conditionTreeLeaf.build({
          field: 'id',
          value: ['123e4567-e89b-12d3-a456-111111111111'],
          operator: 'In',
        }),
      }),
      ['priceId'],
    );

    expect(collection.update).toHaveBeenCalledWith(
      caller,
      new PaginatedFilter({ conditionTree }),
      {},
    );
    expect(pricesCollection.update).toHaveBeenCalledWith(
      caller,
      new Filter({
        conditionTree: factories.conditionTreeLeaf.build({
          operator: 'In',
          value: ['123e4567-e89b-12d3-a456-333333333333'],
          field: 'id',
        }),
      }),
      { value: 10 },
    );
  });

  it('creates the relation and attaches to the new collection', async () => {
    // given
    const { collection, dataSource } = setupWithManyToOneRelation();

    const decoratedCollection = new WriteDecorator(collection, dataSource);
    const titleDefinition = jest.fn().mockResolvedValue({ myAuthor: { name: 'NAME TO CHANGE' } });
    decoratedCollection.replaceFieldWriting('title', titleDefinition);

    const personsCollection = dataSource.getCollection('persons');
    personsCollection.create = jest
      .fn()
      .mockResolvedValue([{ id: '123e4567-e89b-12d3-a456-111111111111', name: 'NAME TO CHANGE' }]);
    collection.create = jest.fn().mockResolvedValue([{ title: 'name' }]);

    // when
    const caller = factories.caller.build();
    await decoratedCollection.create(caller, [{ title: 'a title' }]);

    // then
    expect(collection.create).toHaveBeenCalledWith(caller, [
      { authorId: '123e4567-e89b-12d3-a456-111111111111' },
    ]);
    expect(personsCollection.create).toHaveBeenCalledWith(caller, [{ name: 'NAME TO CHANGE' }]);
  });

  it('creates the relations and attaches to the new collection', async () => {
    // given
    const { collection, dataSource } = setupWithTwoManyToOneRelations();
    const authorsCollection = dataSource.getCollection('authors');
    const formatsCollection = dataSource.getCollection('formats');

    const decoratedCollection = new WriteDecorator(collection, dataSource);
    const titleDefinition = jest.fn().mockResolvedValue({
      myAuthor: { name: 'Orius' },
      myFormat: { name: 'XXL' },
      title: 'name',
    });
    decoratedCollection.replaceFieldWriting('title', titleDefinition);

    authorsCollection.create = jest
      .fn()
      .mockResolvedValue([{ id: '123e4567-e89b-12d3-a456-111111111111', name: 'Orius' }]);
    formatsCollection.create = jest
      .fn()
      .mockResolvedValue([{ id: '123e4567-e89b-12d3-a456-222222222222', name: 'XXL' }]);
    collection.create = jest.fn().mockResolvedValue([{ title: 'name' }]);

    // when
    const caller = factories.caller.build();
    await decoratedCollection.create(caller, [{ title: 'a title' }]);

    // then
    expect(authorsCollection.create).toHaveBeenCalledWith(caller, [{ name: 'Orius' }]);
    expect(formatsCollection.create).toHaveBeenCalledWith(caller, [{ name: 'XXL' }]);
    expect(collection.create).toHaveBeenCalledWith(caller, [
      {
        title: 'name',
        formatId: '123e4567-e89b-12d3-a456-222222222222',
        authorId: '123e4567-e89b-12d3-a456-111111111111',
      },
    ]);
  });

  it('updates the relation and attaches to the new collection', async () => {
    // given
    const { collection, dataSource } = setupWithManyToOneRelation();

    const decoratedCollection = new WriteDecorator(collection, dataSource);
    const titleDefinition = jest.fn().mockResolvedValue({ myAuthor: { name: 'NAME TO CHANGE' } });
    decoratedCollection.replaceFieldWriting('title', titleDefinition);

    const personsCollection = dataSource.getCollection('persons');
    personsCollection.create = jest
      .fn()
      .mockResolvedValue([{ id: '123e4567-e89b-12d3-a456-111111111111', name: 'NAME TO CHANGE' }]);
    collection.create = jest.fn().mockResolvedValue([{ title: 'name' }]);

    // when
    const caller = factories.caller.build();
    await decoratedCollection.create(caller, [
      { title: 'a title', authorId: '123e4567-e89b-12d3-a456-111111111111' },
    ]);

    // then
    expect(collection.create).toHaveBeenCalledWith(caller, [
      { authorId: '123e4567-e89b-12d3-a456-111111111111' },
    ]);
    expect(personsCollection.update).toHaveBeenCalledWith(
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

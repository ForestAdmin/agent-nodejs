import { Filter } from '@forestadmin/datasource-toolkit';
import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';

import WriteDecorator from '../../../src/decorators/write/collection';

describe('WriteDecorator > With one to one relations', () => {
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

    return { dataSource, collection: dataSource.getCollection('books') };
  };

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

    return { dataSource, collection: dataSource.getCollection('books') };
  };

  it('updates the right relation collection with the right params', async () => {
    // given
    const { collection, dataSource } = setupWithOneToOneRelation();
    const decoratedCollection = new WriteDecorator(collection, dataSource);
    const titleDefinition = jest.fn().mockResolvedValue({ myOwner: { name: 'NAME TO CHANGE' } });
    decoratedCollection.replaceFieldWriting('title', titleDefinition);
    collection.list = jest.fn().mockResolvedValue([{ id: '123e4567-e89b-12d3-a456-111111111111' }]);

    // when
    const caller = factories.caller.build();
    const filter = factories.filter.build({
      conditionTree: factories.conditionTreeLeaf.build({
        operator: 'Equal',
        value: 'a name',
        field: 'name',
      }),
    });

    await decoratedCollection.update(caller, filter, { title: 'a title' });

    // then
    expect(collection.list).toHaveBeenCalledWith(caller, filter, ['id']);

    const ownersCollection = dataSource.getCollection('owners');
    const conditionTreeBookId = factories.conditionTreeLeaf.build({
      operator: 'In',
      value: ['123e4567-e89b-12d3-a456-111111111111'],
      field: 'bookId',
    });
    expect(collection.update).toHaveBeenCalledWith(caller, filter, {});
    expect(ownersCollection.update).toHaveBeenCalledWith(
      caller,
      new Filter({ conditionTree: conditionTreeBookId }),
      { name: 'NAME TO CHANGE' },
    );
  });

  it('creates the relation and attaches to the new collection', async () => {
    // given
    const { collection, dataSource } = setupWithOneToOneRelation();
    const ownersCollection = dataSource.getCollection('owners');

    const decoratedCollection = new WriteDecorator(collection, dataSource);
    const titleDefinition = jest
      .fn()
      .mockResolvedValue({ myOwner: { name: 'NAME TO CHANGE' }, title: 'name' });
    decoratedCollection.replaceFieldWriting('title', titleDefinition);
    collection.create = jest
      .fn()
      .mockResolvedValue([
        { id: '123e4567-e89b-12d3-a456-111111111111', notImportantColumn: 'foo' },
      ]);

    // when
    const caller = factories.caller.build();
    await decoratedCollection.create(caller, [{ title: 'a title' }]);

    // then
    expect(ownersCollection.create).toHaveBeenCalledWith(caller, [
      { name: 'NAME TO CHANGE', bookId: '123e4567-e89b-12d3-a456-111111111111' },
    ]);
    expect(collection.create).toHaveBeenCalledWith(caller, [{ title: 'name' }]);
  });

  it('creates the relations and attaches to the new collection', async () => {
    // given
    const { collection, dataSource } = setupWithTwoOneToOneRelations();
    const ownersCollection = dataSource.getCollection('owners');
    const formatsCollection = dataSource.getCollection('formats');

    const decoratedCollection = new WriteDecorator(collection, dataSource);
    const titleDefinition = jest.fn().mockResolvedValue({
      myOwner: { name: 'Orius' },
      myFormat: { name: 'XXL' },
      title: 'name',
    });
    decoratedCollection.replaceFieldWriting('title', titleDefinition);
    collection.create = jest
      .fn()
      .mockResolvedValue([
        { id: '123e4567-e89b-12d3-a456-111111111111', notImportantColumn: 'foo' },
      ]);

    // when
    const caller = factories.caller.build();
    await decoratedCollection.create(caller, [{ title: 'a title' }]);

    // then
    expect(ownersCollection.create).toHaveBeenCalledWith(caller, [
      { name: 'Orius', bookId: '123e4567-e89b-12d3-a456-111111111111' },
    ]);
    expect(formatsCollection.create).toHaveBeenCalledWith(caller, [
      { name: 'XXL', bookId: '123e4567-e89b-12d3-a456-111111111111' },
    ]);
    expect(collection.create).toHaveBeenCalledTimes(1);
    expect(collection.create).toHaveBeenCalledWith(caller, [{ title: 'name' }]);
  });

  it('updates the relation and attaches to the new collection', async () => {
    // given
    const { collection, dataSource } = setupWithOneToOneRelation();
    const ownersCollection = dataSource.getCollection('owners');

    const decoratedCollection = new WriteDecorator(collection, dataSource);
    const titleDefinition = jest
      .fn()
      .mockResolvedValue({ myOwner: { name: 'NAME TO CHANGE' }, title: 'name' });
    decoratedCollection.replaceFieldWriting('title', titleDefinition);
    collection.create = jest.fn().mockResolvedValue([{ title: 'name' }]);

    // when
    const caller = factories.caller.build();
    await decoratedCollection.create(caller, [
      { title: 'a title', bookId: '123e4567-e89b-12d3-a456-111111111111' },
    ]);

    // then
    expect(collection.create).toHaveBeenCalledWith(caller, [{ title: 'name' }]);
    expect(ownersCollection.update).toHaveBeenCalledWith(
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

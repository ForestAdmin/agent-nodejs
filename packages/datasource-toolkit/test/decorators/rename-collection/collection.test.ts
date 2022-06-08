import * as factories from '../../__factories__';
import DataSourceDecorator from '../../../src/decorators/datasource-decorator';
import PaginatedFilter from '../../../src/interfaces/query/filter/paginated';
import RenameCollectionCollectionDecorator from '../../../src/decorators/rename-collection/collection';

describe('RenameCollectionDecorator', () => {
  test('should return the real name when it is not renamed', () => {
    const dataSource = factories.dataSource.buildWithCollection(
      factories.collection.build({ name: 'name 1' }),
    );
    const decoratedDataSource = new DataSourceDecorator(
      dataSource,
      RenameCollectionCollectionDecorator,
    );

    const collection: RenameCollectionCollectionDecorator =
      decoratedDataSource.getCollection('name 1');

    expect(collection.name).toEqual('name 1');
  });

  test('should return the new name when it is renamed', () => {
    const dataSource = factories.dataSource.buildWithCollection(
      factories.collection.build({ name: 'name 1' }),
    );
    const decoratedDataSource = new DataSourceDecorator(
      dataSource,
      RenameCollectionCollectionDecorator,
    );

    const collection: RenameCollectionCollectionDecorator =
      decoratedDataSource.getCollection('name 1');
    collection.rename('name 2');

    expect(collection.name).toEqual('name 2');
  });

  describe('list', () => {
    const setupRenamedCollection = childListMock => {
      const collectionToRename = factories.collection.build({ name: 'name' });
      collectionToRename.list = childListMock;
      const dataSource = factories.dataSource.buildWithCollections([
        collectionToRename,
        factories.collection.build({ name: 'relation' }),
      ]);
      const decoratedDataSource = new DataSourceDecorator(
        dataSource,
        RenameCollectionCollectionDecorator,
      );

      const collection: RenameCollectionCollectionDecorator =
        decoratedDataSource.getCollection('name 1');
      collection.rename('renamedName');

      return dataSource;
    };

    test('should refined the condition tree with the real name of the collection', async () => {
      const childListMock = jest.fn();
      const dataSource = setupRenamedCollection(childListMock);
      const relationCollection = dataSource.getCollection('relation');
      const caller = factories.caller.build();
      const projection = factories.projection.build();

      await relationCollection.list(
        caller,
        new PaginatedFilter({
          conditionTree: factories.conditionTreeLeaf.build({
            field: 'renamedName:aField',
          }),
        }),
        projection,
      );

      expect(childListMock).toHaveBeenCalledWith(
        caller,
        new PaginatedFilter({
          conditionTree: factories.conditionTreeLeaf.build({
            field: 'name:aField',
          }),
        }),
        projection,
      );
    });
  });
});

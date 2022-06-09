import * as factories from '../../__factories__';
import DataSourceDecorator from '../../../src/decorators/datasource-decorator';
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
});

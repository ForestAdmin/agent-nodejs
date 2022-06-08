import * as factories from '../../__factories__';
import RenameCollectionCollectionDecorator from '../../../src/decorators/renameCollection/collection';

describe('RenameCollectionDecorator', () => {
  test('should throw when renaming a field which does not exists', () => {
    const collection = factories.collection.build({ name: 'name 1' });
    const dataSource = factories.dataSource.build();
    const decoratedCollection = new RenameCollectionCollectionDecorator(collection, dataSource);

    decoratedCollection.rename('name 2');

    expect(decoratedCollection.name).toEqual('name 2');
  });
});

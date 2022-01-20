import { PaginatedFilter, CollectionSchema, Collection } from '../../src';
import CollectionDecorator from '../../src/decorators/collection-decorator';
import DataSourceDecorator from '../../src/decorators/datasource-decorator';
import * as factories from '../__factories__';

class MyCollectionDecorator extends CollectionDecorator {
  public override childCollection: Collection;

  protected refineFilter(): PaginatedFilter {
    throw new Error('Method not implemented.');
  }

  protected refineSchema(): CollectionSchema {
    throw new Error('Method not implemented.');
  }
}

describe('DataSourceDecorator', () => {
  test('should decorate child collections', () => {
    const dataSource = factories.dataSource.buildWithCollections([
      factories.collection.build({
        name: 'collection1',
      }),
    ]);

    const decorator = new DataSourceDecorator(dataSource, MyCollectionDecorator);

    expect(decorator.collections).toHaveLength(1);
    expect(decorator.collections[0]).toBeInstanceOf(MyCollectionDecorator);
    expect(decorator.collections[0].dataSource).toBe(decorator);
    expect(decorator.collections[0].childCollection).toBe(dataSource.collections[0]);
  });
});

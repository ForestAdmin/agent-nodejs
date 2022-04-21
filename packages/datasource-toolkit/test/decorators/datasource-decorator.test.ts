import * as factories from '../__factories__';
import { DecoratedCollection } from '../__factories__/collection';
import DataSourceDecorator from '../../src/decorators/datasource-decorator';

describe('DataSourceDecorator', () => {
  test('should decorate child collections', () => {
    const dataSource = factories.dataSource.buildWithCollections([factories.collection.build()]);
    const decorator = new DataSourceDecorator(dataSource, DecoratedCollection);

    expect(decorator.collections).toHaveLength(1);
    expect(decorator.collections[0]).toBeInstanceOf(DecoratedCollection);
    expect(decorator.collections[0].dataSource).toBe(decorator);
    expect(decorator.collections[0].childCollection).toBe(dataSource.collections[0]);
  });

  test('should add collection to decorator if child datasource add a collection', () => {
    const dataSource = factories.dataSource.build();
    const decorator = new DataSourceDecorator(dataSource, DecoratedCollection);

    expect(decorator.collections).toHaveLength(0);

    dataSource.addCollection(factories.collection.build());

    expect(decorator.collections).toHaveLength(1);
  });
});

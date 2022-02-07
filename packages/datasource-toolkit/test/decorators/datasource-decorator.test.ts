import DataSourceDecorator from '../../src/decorators/datasource-decorator';
import * as factories from '../__factories__';
import { DecoratedCollection } from '../__factories__/collection';

describe('DataSourceDecorator', () => {
  test('should decorate child collections', () => {
    const dataSource = factories.dataSource.buildWithCollections([factories.collection.build()]);
    const decorator = new DataSourceDecorator(dataSource, DecoratedCollection);

    expect(decorator.collections).toHaveLength(1);
    expect(decorator.collections[0]).toBeInstanceOf(DecoratedCollection);
    expect(decorator.collections[0].dataSource).toBe(decorator);
    expect(decorator.collections[0].childCollection).toBe(dataSource.collections[0]);
  });
});

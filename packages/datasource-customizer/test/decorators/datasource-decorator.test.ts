import { Collection } from '@forestadmin/datasource-toolkit';
import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';

import CollectionDecorator from '../../src/decorators/collection-decorator';
import DataSourceDecorator from '../../src/decorators/datasource-decorator';

class DecoratedCollection extends CollectionDecorator {
  public override childCollection: Collection;
}

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

  test('should proxy calls to schema', () => {
    const dataSource = factories.dataSource.build();
    const decorator = new DataSourceDecorator(dataSource, DecoratedCollection);

    expect(decorator.schema).toBe(dataSource.schema);
  });

  test('should proxy calls to renderChart', () => {
    const dataSource = factories.dataSource.build();
    const decorator = new DataSourceDecorator(dataSource, DecoratedCollection);
    const caller = factories.caller.build();

    decorator.renderChart(caller, 'myChart');
    expect(dataSource.renderChart).toHaveBeenCalledWith(caller, 'myChart');
  });
});

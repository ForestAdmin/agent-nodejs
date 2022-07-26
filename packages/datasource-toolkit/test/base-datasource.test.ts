// eslint-disable-next-line max-classes-per-file
import * as factories from './__factories__';
import { Collection } from '../src/interfaces/collection';
import BaseDataSource from '../src/base-datasource';

class ConcreteDataSource extends BaseDataSource<Collection> {}

describe('BaseDataSource', () => {
  it('should instantiate properly when extended', () => {
    expect(new ConcreteDataSource()).toBeDefined();
  });

  describe('With a single collection', () => {
    const expectedCollection = factories.collection.build({ name: '__collection__' });
    class DataSourceWithCollection extends BaseDataSource<Collection> {
      constructor() {
        super();

        this.addCollection(expectedCollection);
      }
    }

    it('should expose collections from datasource as an array', () => {
      const dataSource = new DataSourceWithCollection();
      expect(dataSource.collections).toStrictEqual([expectedCollection]);
    });

    it('should export an empty schema', () => {
      const dataSource = new DataSourceWithCollection();
      expect(dataSource.schema).toStrictEqual({ charts: [] });
    });

    it('should get collection from datasource', () => {
      const dataSource = new DataSourceWithCollection();

      expect(dataSource.getCollection(expectedCollection.name)).toBe(expectedCollection);
    });

    it('should fail to get collection if one with the same name is not present', () => {
      const dataSource = new DataSourceWithCollection();

      expect(() => dataSource.getCollection('__no_such_collection__')).toThrow(
        "Collection '__no_such_collection__' not found.",
      );
    });

    it('should throw if renderChart() is called', () => {
      const dataSource = new DataSourceWithCollection();

      expect(() => dataSource.renderChart(null, 'myChart')).toThrow(
        `No chart named 'myChart' exists on this datasource.`,
      );
    });
  });

  describe('With conflicting collection names', () => {
    class DuplicatedCollectionErrorDataSource extends ConcreteDataSource {
      constructor() {
        super();

        this.addCollection(factories.collection.build({ name: '__duplicated__' }));
        this.addCollection(factories.collection.build({ name: '__duplicated__' }));
      }
    }

    it('should prevent instantiation when adding collection with duplicated name', () => {
      expect(() => new DuplicatedCollectionErrorDataSource()).toThrow(
        "Collection '__duplicated__' already defined in datasource",
      );
    });
  });
});

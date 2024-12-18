// eslint-disable-next-line max-classes-per-file
import * as factories from './__factories__';
import { Caller, MissingCollectionError } from '../src';
import BaseDataSource from '../src/base-datasource';
import { Collection } from '../src/interfaces/collection';

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
        new MissingCollectionError(
          "Collection '__no_such_collection__' not found. List of available collections: __collection__",
        ),
      );
    });

    it('should throw if renderChart() is called', () => {
      const dataSource = new DataSourceWithCollection();

      expect(() => dataSource.renderChart(null as unknown as Caller, 'myChart')).toThrow(
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

  describe('addNativeQueryConnection', () => {
    describe('when adding with an already existing name', () => {
      it('should throw an error', () => {
        const dataSource = new BaseDataSource();
        dataSource.addNativeQueryConnection('main', {});

        expect(() => dataSource.addNativeQueryConnection('main', {})).toThrow(
          new Error(`NativeQueryConnection 'main' is already defined in datasource`),
        );
      });
    });

    it('should add the native query connection', () => {
      const dataSource = new BaseDataSource();

      expect(dataSource.nativeQueryConnections).toEqual({});

      dataSource.addNativeQueryConnection('main', {});

      expect(dataSource.nativeQueryConnections).toEqual({ main: {} });
    });
  });

  describe('executeNativeQuery', () => {
    it('should throw', async () => {
      const dataSource = new BaseDataSource();

      await expect(dataSource.executeNativeQuery('main', 'query', {})).rejects.toThrow(
        new Error(`Native Query is not supported on this datasource`),
      );
    });
  });
});

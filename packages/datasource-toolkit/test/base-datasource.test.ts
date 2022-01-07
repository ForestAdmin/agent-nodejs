// eslint-disable-next-line max-classes-per-file
import BaseDataSource from '../src/base-datasource';
import { Collection } from '../src';

class ConcreteDatasource extends BaseDataSource<Collection> {}

describe('BaseDatasource', () => {
  it('should instanciate properly when extended', () => {
    expect(new ConcreteDatasource()).toBeDefined();
  });

  describe('getCollection', () => {
    const expectedCollection = { name: '__collection__' } as Collection;
    class DataSourceWithCollection extends BaseDataSource<Collection> {
      constructor() {
        super();
        this.collections.push(expectedCollection);
      }
    }

    it('should get collection from datasource', () => {
      const collection = new DataSourceWithCollection();

      expect(collection.getCollection('__collection__')).toBe(expectedCollection);
    });

    it('should fail to get collection if one with the same name is not present', () => {
      const dataSource = new DataSourceWithCollection();

      expect(() => dataSource.getCollection('__no_such_action__')).toThrow();
    });
  });
});

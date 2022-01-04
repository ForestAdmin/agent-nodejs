import { SequelizeCollection } from '../src';
import SequelizeDataSource from '../src/datasource';

class ConcreteSequelizeDataSource extends SequelizeDataSource {}

describe('SequelizeDataSource', () => {
  it('should instanciate properly when extended', () => {
    expect(new ConcreteSequelizeDataSource()).toBeDefined();
  });

  it('should have no predefined collection', () => {
    expect(new ConcreteSequelizeDataSource().collections).toBeArrayOfSize(0);
  });

  describe('getCollection', () => {
    it('should return null for unknown collection name', () => {
      const sequelizeDataSource = new ConcreteSequelizeDataSource();

      expect(sequelizeDataSource.getCollection('__no_such_collection')).toBeNull();
    });

    it('should return known collection when given its name', () => {
      const collections = [{ name: 'dummy' }] as SequelizeCollection[];
      const sequelizeDataSource = new ConcreteSequelizeDataSource(collections);

      expect(sequelizeDataSource.getCollection(collections[0].name)).toBeDefined();
    });
  });
});

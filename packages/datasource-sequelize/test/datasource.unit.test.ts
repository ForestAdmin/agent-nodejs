import { Sequelize } from 'sequelize';

import { SequelizeCollection, SequelizeDataSource } from '../src';

describe('SequelizeDataSource', () => {
  it('should fail to instantiate without a Sequelize instance', () => {
    expect(() => new SequelizeDataSource(null)).toThrow('Invalid (null) Sequelize instance.');
  });

  it('should have no predefined collection', () => {
    expect(
      new SequelizeDataSource({ models: {} } as unknown as Sequelize).collections,
    ).toBeArrayOfSize(0);
  });

  it('should create collection based on models', () => {
    const sequelize = new Sequelize({ dialect: 'postgres' });
    sequelize.define('cars', {});

    const datasource = new SequelizeDataSource(sequelize);

    expect(datasource.getCollection('cars')).toBeInstanceOf(SequelizeCollection);
  });

  it('should keep the same collections order', () => {
    const firstSequelize = new Sequelize({ dialect: 'postgres' });
    firstSequelize.define('cars', {});
    firstSequelize.define('owner', {});
    const firstDataSource = new SequelizeDataSource(firstSequelize);

    const secondSequelize = new Sequelize({ dialect: 'postgres' });
    secondSequelize.define('owner', {});
    secondSequelize.define('cars', {});
    const secondDataSource = new SequelizeDataSource(secondSequelize);

    const firstCollectionNames = firstDataSource.collections.map(({ name }) => name);
    const secondCollectionNames = secondDataSource.collections.map(({ name }) => name);

    expect(firstCollectionNames).toStrictEqual(secondCollectionNames);
  });
});

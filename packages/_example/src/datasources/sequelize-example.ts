import { DataTypes, Sequelize } from 'sequelize';

import { SequelizeCollection, SequelizeDataSource } from '@forestadmin/datasource-sequelize';

const prepareDataSource = (): SequelizeDataSource => {
  const sequelize = new Sequelize('postgres://example:password@localhost:5442/example');

  sequelize.define(
    'example',
    {
      name: {
        type: DataTypes.STRING,
      },
      value: {
        type: DataTypes.INTEGER,
      },
    },
    {
      tableName: 'example',
    },
  );

  const dataSource = new SequelizeDataSource([], sequelize);
  const exampleCollection = new SequelizeCollection('example', dataSource, sequelize);
  dataSource.addCollection(exampleCollection);

  return dataSource;
};

const dataSource = prepareDataSource();

export default dataSource;

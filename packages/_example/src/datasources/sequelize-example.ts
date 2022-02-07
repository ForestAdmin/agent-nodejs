import { DataTypes, Sequelize } from 'sequelize';

import { SequelizeCollection, SequelizeDataSource } from '@forestadmin/datasource-sequelize';

const prepareDataSource = async (): Promise<SequelizeDataSource> => {
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

  await sequelize.sync();

  const dataSource = new SequelizeDataSource([], sequelize);
  const exampleCollection = new SequelizeCollection('example', dataSource, sequelize);

  dataSource.addCollection(exampleCollection);

  return dataSource;
};

export default prepareDataSource;

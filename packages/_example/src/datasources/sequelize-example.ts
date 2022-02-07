import { DataTypes, Sequelize } from 'sequelize';

import { SequelizeCollection, SequelizeDataSource } from '@forestadmin/datasource-sequelize';

const prepareDatabase = async (): Promise<Sequelize> => {
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

  return sequelize;
};

const prepareDataSource = async (): Promise<SequelizeDataSource> => {
  // NOTICE: First call to ensure DB is ready to function.
  //         This is a hack to prevent open handle with Jest.
  (await prepareDatabase()).sync().then(connection => connection.close());

  const sequelize = await prepareDatabase();

  const dataSource = new SequelizeDataSource([], sequelize);
  const exampleCollection = new SequelizeCollection('example', dataSource, sequelize);

  dataSource.addCollection(exampleCollection);

  return dataSource;
};

export default prepareDataSource;

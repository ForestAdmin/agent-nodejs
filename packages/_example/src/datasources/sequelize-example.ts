import { SequelizeCollection, SequelizeDataSource } from '@forestadmin/datasource-sequelize';
import { DataTypes, Sequelize } from 'sequelize';

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
  const sequelize = await prepareDatabase();

  // NOTICE: First call to ensure DB is ready to function.
  //         This is a hack to prevent open handle with Jest.
  if (process.env.NODE_ENV !== 'test') {
    await sequelize.sync();
  }

  const dataSource = new SequelizeDataSource(sequelize);
  const exampleCollection = new SequelizeCollection(
    'example',
    dataSource,
    sequelize.model('example'),
  );

  dataSource.addCollection(exampleCollection);

  return dataSource;
};

export default prepareDataSource;

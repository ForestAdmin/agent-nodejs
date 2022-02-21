import { DataTypes, Sequelize } from 'sequelize';

import { SequelizeCollection, SequelizeDataSource } from '@forestadmin/datasource-sequelize';

const prepareDatabase = async (): Promise<Sequelize> => {
  const sequelize = new Sequelize('postgres://example:password@localhost:5442/example');

  const example = sequelize.define(
    'example',
    {
      name: {
        type: DataTypes.STRING,
      },
      val: {
        type: DataTypes.INTEGER,
        field: 'value',
      },
    },
    {
      tableName: 'example',
    },
  );

  const userSeqExample = sequelize.define(
    'userSeqExample',
    {
      toto: {
        type: DataTypes.STRING,
        field: 'name',
      },
    },
    {
      tableName: 'userSeqExample',
    },
  );

  userSeqExample.hasMany(example);
  example.belongsTo(userSeqExample);

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
  const userSeqExempleCollection = new SequelizeCollection(
    'userSeqExample',
    dataSource,
    sequelize.model('userSeqExample'),
  );

  dataSource.addCollection(exampleCollection);
  dataSource.addCollection(userSeqExempleCollection);

  return dataSource;
};

export default prepareDataSource;

import { DataTypes, Dialect, Sequelize } from 'sequelize';

import {
  ActionCollectionDecorator,
  ComputedCollectionDecorator,
  DataSource,
  DataSourceDecorator,
  OperatorsEmulateCollectionDecorator,
  OperatorsReplaceCollectionDecorator,
  PublicationCollectionDecorator,
  RenameCollectionDecorator,
  SearchCollectionDecorator,
  SegmentCollectionDecorator,
  SortEmulateCollectionDecorator,
} from '@forestadmin/datasource-toolkit';
import { SequelizeDataSource } from '@forestadmin/datasource-sequelize';

export async function prepareDatabase(
  dialect: Dialect,
  connectionString: string,
): Promise<Sequelize> {
  const sequelize = new Sequelize(connectionString, { logging: false });

  const City = sequelize.define(
    `${dialect}City`,
    {
      cityId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      city: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      lastUpdate: {
        type: DataTypes.DATE,
        defaultValue: Sequelize.fn(dialect === 'mssql' ? 'getdate' : 'now'),
        allowNull: false,
      },
    },
    {
      tableName: 'city',
      underscored: true,
      timestamps: false,
    },
  );

  const Country = sequelize.define(
    `${dialect}Country`,
    {
      countryId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      country: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      lastUpdate: {
        type: DataTypes.DATE,
        defaultValue: Sequelize.fn(dialect === 'mssql' ? 'getdate' : 'now'),
        allowNull: false,
      },
    },
    {
      tableName: 'country',
      underscored: true,
      timestamps: false,
    },
  );

  const Address = sequelize.define(
    `${dialect}Address`,
    {
      addressId: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      address: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      address2: {
        type: DataTypes.STRING,
      },
      postalCode: {
        type: DataTypes.STRING,
      },
      lastUpdate: {
        type: DataTypes.DATE,
        defaultValue: Sequelize.fn(dialect === 'mssql' ? 'getdate' : 'now'),
        allowNull: false,
      },
    },
    {
      tableName: 'address',
      underscored: true,
      timestamps: false,
    },
  );

  Country.hasMany(City, { foreignKey: 'countryId', sourceKey: 'countryId' });
  City.belongsTo(Country, { foreignKey: 'countryId', targetKey: 'countryId' });
  City.hasMany(Address, { foreignKey: 'cityId', sourceKey: 'cityId' });
  Address.belongsTo(City, { foreignKey: 'cityId', targetKey: 'cityId' });

  return sequelize;
}

export default async function prepareDataSource(connectionString: string): Promise<DataSource> {
  const [, dialect] = /(.*):\/\//.exec(connectionString);
  const sequelize = await prepareDatabase(dialect as Dialect, connectionString);

  const dataSource = new SequelizeDataSource(sequelize);

  let deco: DataSource = new DataSourceDecorator(dataSource, ComputedCollectionDecorator);
  deco = new DataSourceDecorator(deco, OperatorsEmulateCollectionDecorator);
  deco = new DataSourceDecorator(deco, OperatorsReplaceCollectionDecorator);
  deco = new DataSourceDecorator(deco, SortEmulateCollectionDecorator);
  deco = new DataSourceDecorator(deco, SegmentCollectionDecorator);
  deco = new DataSourceDecorator(deco, RenameCollectionDecorator);
  deco = new DataSourceDecorator(deco, PublicationCollectionDecorator);
  deco = new DataSourceDecorator(deco, SearchCollectionDecorator);
  deco = new DataSourceDecorator(deco, ActionCollectionDecorator);

  return deco;
}

import { DataTypes, Dialect, Sequelize } from 'sequelize';

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
      capital: {
        type: DataTypes.ENUM('civil', 'economic', 'cultural'),
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

export default async (connectionString: string): Promise<SequelizeDataSource> => {
  const [, dialect] = /(.*):\/\//.exec(connectionString);
  const sequelize = await prepareDatabase(dialect as Dialect, connectionString);

  return new SequelizeDataSource(sequelize);
};

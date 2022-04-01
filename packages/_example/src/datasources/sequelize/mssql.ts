import { SequelizeDataSource } from '@forestadmin/datasource-sequelize';

import { DataTypes, Sequelize } from 'sequelize';

export async function prepareDatabase(): Promise<Sequelize> {
  const uri = 'mssql://sa:yourStrong(!)Password@localhost:1433';
  let connection: Sequelize;

  try {
    connection = new Sequelize(uri, { logging: false });
    await connection.getQueryInterface().createDatabase('example');
  } catch (e) {
    console.error(e);
  } finally {
    await connection.close();
  }

  const sequelize = new Sequelize(`${uri}/example`, { logging: false });

  const dvd = sequelize.define(
    'dvd',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      rentalPrice: {
        type: DataTypes.FLOAT,
        allowNull: false,
      },
      storeId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
    },
    {
      tableName: 'dvd',
      underscored: true,
      timestamps: false,
    },
  );

  const rental = sequelize.define(
    'rental',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      startDate: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      endDate: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    {
      tableName: 'rental',
      underscored: true,
      timestamps: false,
    },
  );

  dvd.belongsToMany(rental, { through: 'dvd_rental', foreignKey: 'dvdId' });
  rental.belongsToMany(dvd, { through: 'dvd_rental', foreignKey: 'rentalId' });

  return sequelize;
}

export default async (): Promise<SequelizeDataSource> => {
  return new SequelizeDataSource(await prepareDatabase());
};

import { SequelizeDataSource } from '@forestadmin/datasource-sequelize';

import { DataTypes, Sequelize } from 'sequelize';

export async function prepareDatabase(): Promise<Sequelize> {
  const connectionString = 'postgres://example:password@localhost:5442/example';
  const sequelize = new Sequelize(connectionString, { logging: false });

  sequelize.define(
    'owner',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      firstName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      lastName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    },
    {
      tableName: 'owner',
      underscored: true,
      timestamps: false,
    },
  );

  return sequelize;
}

export default async (): Promise<SequelizeDataSource> => {
  return new SequelizeDataSource(await prepareDatabase());
};

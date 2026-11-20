import { DataTypes, Sequelize } from 'sequelize';

import { sqlUri } from './sql-options';

const sequelizeMySql = new Sequelize(sqlUri('mysql'), { logging: false });

sequelizeMySql.define(
  'store',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    ownerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    tableName: 'store',
    underscored: true,
    timestamps: false,
  },
);

export default sequelizeMySql;

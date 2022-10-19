import { DataTypes, Sequelize } from 'sequelize';

const connectionString = 'postgres://example:password@localhost:5442/example';
const sequelizePostgres = new Sequelize(connectionString, { logging: false });

sequelizePostgres.define(
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

sequelizePostgres.define(
  'review',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    storeId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: 'review',
    underscored: true,
    timestamps: false,
  },
);

export default sequelizePostgres;

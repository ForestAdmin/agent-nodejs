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
    virtualFullName: {
      type: DataTypes.VIRTUAL,
      get() {
        return `${this.getDataValue('firstName')} ${this.getDataValue('lastName')}`;
      },
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
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    message: {
      type: DataTypes.STRING,
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

import { DataTypes, Sequelize } from 'sequelize';

const connectionString = 'mysql://example:password@localhost:3306/example';
const sequelizeMySql = new Sequelize(connectionString, { logging: false });

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
    isOpen: {
      type: DataTypes.BOOLEAN,
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

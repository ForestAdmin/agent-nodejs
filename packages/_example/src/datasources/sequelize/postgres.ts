import { DataTypes, Sequelize } from 'sequelize';

export default function prepareDatabase(): Sequelize {
  const connectionString = 'postgres://example:password@localhost:5442/example';
  const sequelize = new Sequelize(connectionString, { logging: false });

  const country = sequelize.define('country', {
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
  });

  const owner = sequelize.define(
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

  owner.belongsTo(country);

  return sequelize;
}

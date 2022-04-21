import { DataTypes, Sequelize } from 'sequelize';

export default function prepareDatabase(): Sequelize {
  const connectionString = 'mysql://example:password@localhost:3306/example';
  const sequelize = new Sequelize(connectionString, { logging: false });

  sequelize.define(
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

  return sequelize;
}

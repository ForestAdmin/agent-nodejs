import { DataTypes, Sequelize } from 'sequelize';

export default async function seedDirectSqlDatasource(): Promise<void> {
  let sequelize: Sequelize;

  try {
    sequelize = new Sequelize('mariadb://example:password@localhost:3808/example', {
      logging: false,
    });

    const card = sequelize.define(
      'card',
      {
        cardNumber: {
          type: DataTypes.BIGINT,
          defaultValue: 1111222233334444,
        },
        cardType: {
          type: DataTypes.ENUM('visa', 'mastercard', 'american express'),
          defaultValue: 'visa',
        },
        isActive: {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
        },
      },
      {
        underscored: true,
        tableName: 'card',
        timestamps: false,
      },
    );

    const customer = sequelize.define(
      'customer',
      {
        name: {
          type: DataTypes.STRING,
          defaultValue: 'customer#',
        },
        firstName: {
          type: DataTypes.STRING,
          allowNull: false,
        },
      },
      {
        tableName: 'customer',
        paranoid: true,
        timestamps: true,
      },
    );

    card.belongsTo(customer);
    customer.hasMany(card);

    await sequelize.sync({ force: true });
  } catch (error) {
    console.error(error);
  } finally {
    if (sequelize) sequelize.close();
  }
}

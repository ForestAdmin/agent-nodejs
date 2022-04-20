import { DataTypes, Sequelize } from 'sequelize';
import faker from '@faker-js/faker';

export async function prepareDatabase(): Promise<Sequelize> {
  const sequelize = new Sequelize('mariadb://example:password@localhost:3808/example', {
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

  return sequelize;
}

export async function createCustomerCardRecords(connection: Sequelize): Promise<void> {
  let customerRecords = [];

  for (let i = 0; i < 5; i += 1) {
    customerRecords.push({
      name: faker.name.lastName(),
      firstName: faker.name.firstName(),
    });
  }

  customerRecords = await connection.model('customer').bulkCreate(customerRecords);

  const cardRecords = [];

  for (let i = 0; i < 5; i += 1) {
    cardRecords.push({
      cardNumber: Number(faker.finance.creditCardNumber('################')),
      cardType: faker.helpers.randomize(['visa', 'mastercard', 'american express']),
      isActive: faker.helpers.randomize([true, false]),
      customerId: customerRecords[i].id,
    });
  }

  await connection.model('card').bulkCreate(cardRecords);
}

import type { ConnectionDetails } from './connection-details';
import type { Sequelize } from 'sequelize';

import { DataTypes } from 'sequelize';

import setupEmptyDatabase from './setup-empty-database';

export default async (
  connectionDetails: ConnectionDetails,
  database: string,
  schema?: string,
): Promise<Sequelize> => {
  let sequelize: Sequelize | null = null;

  try {
    const optionalSchemaOption = schema ? { schema } : {};
    sequelize = await setupEmptyDatabase(connectionDetails, database, optionalSchemaOption);

    if (schema) {
      await sequelize.getQueryInterface().dropSchema(schema);
      await sequelize.getQueryInterface().createSchema(schema);
    }

    const member = sequelize.define(
      'member',
      { role: DataTypes.STRING },
      {
        tableName: 'member',
        ...optionalSchemaOption,
        timestamps: false,
        indexes: [
          {
            name: 'member_groupId_role',
            unique: true,
            fields: ['groupId', 'role'],
          },
        ],
      },
    );
    const group = sequelize.define(
      'group',
      {},
      { tableName: 'group', ...optionalSchemaOption, timestamps: false },
    );
    const product = sequelize.define(
      'product',
      {},
      { tableName: 'product', ...optionalSchemaOption, timestamps: false },
    );
    const order = sequelize.define(
      'order',
      {},
      { tableName: 'order', ...optionalSchemaOption, timestamps: false },
    );
    const customer = sequelize.define(
      'customer',
      {},
      { tableName: 'customer', ...optionalSchemaOption, timestamps: false },
    );
    const account = sequelize.define(
      'account',
      {
        customerId: {
          type: DataTypes.INTEGER,
          unique: true,
        },
      },
      { tableName: 'account', ...optionalSchemaOption, timestamps: false },
    );

    member.belongsTo(group);
    group.hasMany(member);
    product.belongsToMany(order, { through: 'productOrder' });
    order.belongsToMany(product, { through: 'productOrder' });
    customer.hasOne(account);
    account.belongsTo(customer);

    await sequelize.sync({ force: true, ...optionalSchemaOption });

    return sequelize;
  } catch (e) {
    console.error('Error', e);
    throw e;
  }
};

export const RELATION_MAPPING = {
  member: {
    group: 'BelongsTo',
  },
  group: {
    members: 'HasMany',
  },
  product: {
    orders: 'BelongsToMany',
  },
  order: {
    products: 'BelongsToMany',
  },
  productOrder: {
    product: 'BelongsTo',
    order: 'BelongsTo',
  },
  customer: {
    account: 'HasOne',
  },
  account: {
    customer: 'BelongsTo',
  },
};

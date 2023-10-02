import { stringify } from 'querystring';
import { DataTypes, Sequelize } from 'sequelize';

export default async (baseUri: string, database: string, schema?: string): Promise<Sequelize> => {
  let sequelize: Sequelize | null = null;

  try {
    sequelize = new Sequelize(baseUri, { logging: true });
    const queryInterface = sequelize.getQueryInterface();

    await queryInterface.dropDatabase(database);
    await queryInterface.createDatabase(database);

    if (schema) {
      await queryInterface.dropSchema(schema);
      console.log('Creating schema');

      try {
        await queryInterface.createSchema(schema, { logging: true });
      } catch (e) {
        console.error('Error', e);
        throw e;
      }
    }

    await sequelize.close();

    sequelize = new Sequelize(`${baseUri}/${database}`, {
      logging: true,
      schema,
    });

    const member = sequelize.define(
      'member',
      { role: DataTypes.STRING },
      { tableName: 'member', schema, timestamps: false },
    );
    const group = sequelize.define('group', {}, { tableName: 'group', schema, timestamps: false });
    const product = sequelize.define(
      'product',
      {},
      { tableName: 'product', schema, timestamps: false },
    );
    const order = sequelize.define('order', {}, { tableName: 'order', schema, timestamps: false });
    const account = sequelize.define(
      'account',
      {},
      { tableName: 'account', schema, timestamps: false },
    );
    const customer = sequelize.define(
      'customer',
      {},
      { tableName: 'customer', schema, timestamps: false },
    );

    member.belongsTo(group);
    group.hasMany(member);
    product.belongsToMany(order, { through: 'productOrder' });
    order.belongsToMany(product, { through: 'productOrder' });
    customer.hasOne(account);
    account.belongsTo(customer);

    try {
      await sequelize.sync({ force: true, schema, logging: true });
    } catch (e) {
      console.error('Error', e);
      throw e;
    }

    await sequelize
      .getQueryInterface()
      .addConstraint(
        { tableName: account.name, schema },
        { type: 'unique', fields: ['customerId'] },
      );
    await sequelize
      .getQueryInterface()
      .addConstraint(
        { tableName: member.name, schema },
        { type: 'unique', fields: ['groupId', 'role'] },
      );

    return sequelize;
  } catch (e) {
    console.error('Error', e);
    throw e;
  } finally {
    await sequelize?.close();
  }
};

export const RELATION_MAPPING = {
  member: {
    group: {
      associationType: 'BelongsTo',
    },
  },
  group: {
    members: {
      associationType: 'HasMany',
    },
  },
  product: {
    orders: {
      associationType: 'BelongsToMany',
    },
  },
  order: {
    products: {
      associationType: 'BelongsToMany',
    },
  },
  productOrder: {
    product: {
      associationType: 'BelongsTo',
    },
    order: {
      associationType: 'BelongsTo',
    },
  },
  customer: {
    account: {
      associationType: 'HasOne',
    },
  },
  account: {
    customer: {
      associationType: 'BelongsTo',
    },
  },
};

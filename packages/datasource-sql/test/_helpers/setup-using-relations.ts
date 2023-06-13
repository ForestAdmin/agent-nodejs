import { DataTypes, Sequelize } from 'sequelize';

export default async (baseUri: string, database: string): Promise<Sequelize> => {
  let sequelize: Sequelize | null = null;

  try {
    sequelize = new Sequelize(baseUri, { logging: false });
    await sequelize.getQueryInterface().dropDatabase(database);
    await sequelize.getQueryInterface().createDatabase(database);

    await sequelize.close();

    sequelize = new Sequelize(`${baseUri}/${database}`, { logging: false });

    const member = sequelize.define(
      'member',
      { role: DataTypes.STRING },
      { tableName: 'member', timestamps: false },
    );
    const group = sequelize.define('group', {}, { tableName: 'group', timestamps: false });
    const product = sequelize.define('product', {}, { tableName: 'product', timestamps: false });
    const order = sequelize.define('order', {}, { tableName: 'order', timestamps: false });
    const account = sequelize.define('account', {}, { tableName: 'account', timestamps: false });
    const customer = sequelize.define('customer', {}, { tableName: 'customer', timestamps: false });

    member.belongsTo(group);
    group.hasMany(member);
    product.belongsToMany(order, { through: 'productOrder' });
    order.belongsToMany(product, { through: 'productOrder' });
    customer.hasOne(account);
    account.belongsTo(customer);

    await sequelize.sync({ force: true });
    await sequelize
      .getQueryInterface()
      .addConstraint(account.name, { type: 'unique', fields: ['customerId'] });
    await sequelize
      .getQueryInterface()
      .addConstraint(member.name, { type: 'unique', fields: ['groupId', 'role'] });

    return sequelize;
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

import { DataTypes, Sequelize } from 'sequelize';

export default async (baseUri: string, database: string, schema?: string): Promise<Sequelize> => {
  let sequelize: Sequelize | null = null;

  try {
    sequelize = new Sequelize(baseUri, { logging: false });
    const queryInterface = sequelize.getQueryInterface();

    await queryInterface.dropDatabase(database);
    await queryInterface.createDatabase(database);

    await sequelize.close();

    const optionalSchemaOption = schema ? { schema } : {};
    sequelize = new Sequelize(`${baseUri}/${database}`, {
      logging: false,
      ...optionalSchemaOption,
    });

    if (schema) {
      await sequelize.getQueryInterface().dropSchema(schema);
      await sequelize.getQueryInterface().createSchema(schema);
    }

    const member = sequelize.define(
      'member',
      { role: DataTypes.STRING },
      { tableName: 'member', ...optionalSchemaOption, timestamps: false },
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
    const account = sequelize.define(
      'account',
      {},
      { tableName: 'account', ...optionalSchemaOption, timestamps: false },
    );
    const customer = sequelize.define(
      'customer',
      {},
      { tableName: 'customer', ...optionalSchemaOption, timestamps: false },
    );

    member.belongsTo(group);
    group.hasMany(member);
    product.belongsToMany(order, { through: 'productOrder' });
    order.belongsToMany(product, { through: 'productOrder' });
    customer.hasOne(account);
    account.belongsTo(customer);

    await sequelize.sync({ force: true, ...optionalSchemaOption });

    await sequelize
      .getQueryInterface()
      .addConstraint(
        { tableName: account.name, ...optionalSchemaOption },
        { type: 'unique', fields: ['customerId'] },
      );
    await sequelize
      .getQueryInterface()
      .addConstraint(
        { tableName: member.name, ...optionalSchemaOption },
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

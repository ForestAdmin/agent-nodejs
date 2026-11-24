import { DataTypes, Sequelize } from 'sequelize';

import { sequelizeAttributes } from './data-model';

const connectionString = 'postgres://example:password@localhost:5442/example';
const sequelizePostgres = new Sequelize(connectionString, { logging: false });

const MODEL_OPTIONS = { underscored: true, timestamps: false };
const IBAN_VISIBLE_CHARACTERS = 4;

const customers = sequelizePostgres.define('customers', sequelizeAttributes('customers'), {
  tableName: 'customers',
  ...MODEL_OPTIONS,
});

const individuals = sequelizePostgres.define('individuals', sequelizeAttributes('individuals'), {
  tableName: 'individuals',
  ...MODEL_OPTIONS,
});

const businesses = sequelizePostgres.define('businesses', sequelizeAttributes('businesses'), {
  tableName: 'businesses',
  ...MODEL_OPTIONS,
});

const accounts = sequelizePostgres.define(
  'accounts',
  {
    ...sequelizeAttributes('accounts'),
    masked_iban: {
      type: DataTypes.VIRTUAL(DataTypes.STRING, ['iban']),
      get() {
        const iban: string = this.getDataValue('iban');

        return iban
          ? `${iban.slice(0, IBAN_VISIBLE_CHARACTERS)} **** ${iban.slice(-IBAN_VISIBLE_CHARACTERS)}`
          : null;
      },
    },
  },
  { tableName: 'accounts', ...MODEL_OPTIONS },
);

const customerMembers = sequelizePostgres.define(
  'customer_members',
  sequelizeAttributes('customer_members'),
  { tableName: 'customer_members', ...MODEL_OPTIONS },
);

accounts.belongsTo(customers, { as: 'customer', foreignKey: 'customer_id', constraints: false });
customers.hasMany(accounts, { as: 'accounts', foreignKey: 'customer_id', constraints: false });

customers.belongsTo(businesses, { as: 'business', foreignKey: 'business_id', constraints: false });
businesses.hasOne(customers, { as: 'customer', foreignKey: 'business_id', constraints: false });

customers.belongsToMany(individuals, {
  as: 'members',
  through: { model: customerMembers, unique: false },
  foreignKey: 'customer_id',
  otherKey: 'individual_id',
  constraints: false,
});
individuals.belongsToMany(customers, {
  as: 'customers',
  through: { model: customerMembers, unique: false },
  foreignKey: 'individual_id',
  otherKey: 'customer_id',
  constraints: false,
});
customerMembers.belongsTo(customers, {
  as: 'customer',
  foreignKey: 'customer_id',
  constraints: false,
});
customerMembers.belongsTo(individuals, {
  as: 'individual',
  foreignKey: 'individual_id',
  constraints: false,
});

export default sequelizePostgres;

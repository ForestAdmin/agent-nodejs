import { Sequelize } from 'sequelize';

import { sequelizeAttributes } from './data-model';
import { sqlUri } from './sql-options';

const sequelizeMySql = new Sequelize(sqlUri('mysql'), { logging: false });

const MODEL_OPTIONS = { underscored: true, timestamps: false };

const transactions = sequelizeMySql.define('transactions', sequelizeAttributes('transactions'), {
  tableName: 'transactions',
  ...MODEL_OPTIONS,
});

const counterparties = sequelizeMySql.define(
  'counterparties',
  sequelizeAttributes('counterparties'),
  { tableName: 'counterparties', ...MODEL_OPTIONS },
);

transactions.belongsTo(counterparties, {
  as: 'counterparty',
  foreignKey: 'counterparty_id',
  constraints: false,
});
counterparties.hasMany(transactions, {
  as: 'transactions',
  foreignKey: 'counterparty_id',
  constraints: false,
});

export default sequelizeMySql;

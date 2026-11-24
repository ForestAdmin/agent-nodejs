import { Sequelize } from 'sequelize';

import { sequelizeAttributes } from './data-model';
import { sqlUri } from './sql-options';

const sequelizeMsSql = new Sequelize(sqlUri('mssql'), { logging: false });

const MODEL_OPTIONS = { underscored: true, timestamps: false };

const chargebacks = sequelizeMsSql.define('chargebacks', sequelizeAttributes('chargebacks'), {
  tableName: 'chargebacks',
  ...MODEL_OPTIONS,
});

const disputeRequests = sequelizeMsSql.define(
  'dispute_requests',
  sequelizeAttributes('dispute_requests'),
  { tableName: 'dispute_requests', ...MODEL_OPTIONS },
);

const disputeTransactions = sequelizeMsSql.define(
  'dispute_transactions',
  sequelizeAttributes('dispute_transactions', ['sepa_dispute_id']),
  { tableName: 'dispute_transactions', ...MODEL_OPTIONS },
);

chargebacks.belongsTo(disputeRequests, {
  as: 'dispute_request',
  foreignKey: 'dispute_request_id',
  constraints: false,
});

disputeRequests.belongsToMany(chargebacks, {
  as: 'chargebacks',
  through: { model: disputeTransactions, unique: false },
  foreignKey: 'dispute_request_id',
  otherKey: 'chargeback_id',
  constraints: false,
});
chargebacks.belongsToMany(disputeRequests, {
  as: 'dispute_requests',
  through: { model: disputeTransactions, unique: false },
  foreignKey: 'chargeback_id',
  otherKey: 'dispute_request_id',
  constraints: false,
});
disputeTransactions.belongsTo(disputeRequests, {
  as: 'dispute_request',
  foreignKey: 'dispute_request_id',
  constraints: false,
});
disputeTransactions.belongsTo(chargebacks, {
  as: 'chargeback',
  foreignKey: 'chargeback_id',
  constraints: false,
});

export default sequelizeMsSql;

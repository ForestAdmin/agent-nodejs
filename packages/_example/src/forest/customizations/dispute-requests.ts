import type { DisputeRequestsCustomizer } from '../typings';

export default (collection: DisputeRequestsCustomizer) =>
  collection
    .removeField('direct_debit_id', 'outgoing_transfer_id')
    .renameField('amount', 'disputed_amount')
    .addManyToOneRelation('customer', 'customers', { foreignKey: 'customer_id' })
    .addManyToOneRelation('transaction', 'transactions', { foreignKey: 'transaction_id' })
    .addManyToOneRelation('card_transaction', 'card_transactions', {
      foreignKey: 'card_transaction_id',
    })
    .addManyToOneRelation('alert', 'alerts', { foreignKey: 'alert_id' })
    .addManyToOneRelation('investigation', 'investigations', { foreignKey: 'investigation_id' });

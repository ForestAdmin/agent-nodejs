import type { ChargebacksCustomizer } from '../typings';

export default (collection: ChargebacksCustomizer) =>
  collection
    .addManyToOneRelation('customer', 'customers', { foreignKey: 'customer_id' })
    .addManyToOneRelation('transaction', 'transactions', { foreignKey: 'transaction_id' })
    .addManyToOneRelation('card_transaction', 'card_transactions', {
      foreignKey: 'card_transaction_id',
    })
    .addField('linked_transactions', {
      columnType: 'Number',
      dependencies: ['id'],
      getValues: async (records, context) => {
        const rows = await context.collection.nativeDriver.rawQuery(
          'SELECT chargeback_id, CAST(COUNT(*) AS INTEGER) AS count FROM dispute_transactions WHERE chargeback_id IN (:ids) GROUP BY chargeback_id',
          { ids: records.map(r => r.id) },
        );

        return records.map(record => rows.find(r => r.chargeback_id === record.id)?.count ?? 0);
      },
    });

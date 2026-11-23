import type { CardTransactionsCustomizer } from '../typings';

import { randomUUID } from 'crypto';

import newReference from '../references';

const DISPUTABLE_STATUSES = ['CLEARED', 'SETTLED'];
const REASONS = {
  '10.4': 'Fraud: card absent environment',
  '12.6': 'Duplicate processing',
  '13.1': 'Merchandise or services not received',
  '13.3': 'Not as described or defective merchandise',
};

export default (collection: CardTransactionsCustomizer) =>
  collection
    .addManyToOneRelation('card', 'cards', { foreignKey: 'card_id' })
    .addManyToOneRelation('transaction', 'transactions', { foreignKey: 'transaction_id' })
    .addManyToOneRelation('merchant', 'card_merchants', { foreignKey: 'merchant_id' })
    .addManyToOneRelation('device_owner', 'individuals', { foreignKey: 'device@@@individual_id' })

    .addAction('Open chargeback', {
      scope: 'Single',
      form: [
        {
          label: 'Reason code',
          type: 'Enum',
          enumValues: Object.keys(REASONS),
          isRequired: true,
          description: ctx => REASONS[ctx.formValues['Reason code']] ?? '',
        },
      ],
      execute: async (context, resultBuilder) => {
        const { _id: cardTransactionId, ...cardTransaction } = await context.getRecord([
          '_id',
          'card_id',
          'transaction_id',
          'original_amount',
          'original_currency',
          'status',
        ]);

        if (!DISPUTABLE_STATUSES.includes(cardTransaction.status)) {
          return resultBuilder.error(
            `Only a cleared or settled payment can be disputed, this one is ${cardTransaction.status}`,
          );
        }

        const chargebacks = context.dataSource.getCollection('chargebacks');
        const existing = await chargebacks.list(
          {
            conditionTree: {
              field: 'card_transaction_id',
              operator: 'Equal',
              value: cardTransactionId,
            },
          },
          ['reference'],
        );

        if (existing.length) {
          return resultBuilder.error(
            `This payment is already disputed by ${existing[0].reference}`,
          );
        }

        const [card] = await context.dataSource
          .getCollection('cards')
          .list(
            { conditionTree: { field: 'id', operator: 'Equal', value: cardTransaction.card_id } },
            ['customer_id', 'network'],
          );

        const reasonCode = context.formValues['Reason code'];
        const now = new Date().toISOString();
        const reference = newReference('CBK');

        await chargebacks.create([
          {
            id: randomUUID(),
            reference,
            customer_id: card?.customer_id ?? null,
            card_transaction_id: cardTransactionId,
            transaction_id: cardTransaction.transaction_id,
            amount: cardTransaction.original_amount,
            currency: cardTransaction.original_currency,
            network: card?.network ?? null,
            reason_code: reasonCode,
            reason_description: REASONS[reasonCode],
            status: 'INITIATED',
            source: 'CUSTOMER_REQUEST',
            is_overdue: false,
            provisional_credit_issued: false,
            filed_at: now,
            created_at: now,
            updated_at: now,
          },
        ]);

        return resultBuilder.success(`Chargeback ${reference} opened`);
      },
    });

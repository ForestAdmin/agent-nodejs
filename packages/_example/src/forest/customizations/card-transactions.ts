import type { CardTransactionsCustomizer } from '../typings';

import { REASON_CODES, openChargebackCase } from './chargebacks';

const DISPUTABLE_STATUSES = ['CLEARED', 'SETTLED'];
const VISA_LABEL = 1;
const MASTERCARD_LABEL = 3;

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
          label: 'Reason',
          type: 'Enum',
          enumValues: Object.keys(REASON_CODES),
          isRequired: true,
          description: async ctx => {
            const codes = REASON_CODES[ctx.formValues.Reason];
            if (!codes) return '';
            const { card } = await ctx.getRecord(['card:network']);

            return codes[card?.network === 'MASTERCARD' ? MASTERCARD_LABEL : VISA_LABEL];
          },
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
          'card:customer_id',
          'card:network',
          'transaction:account_id',
          'transaction:created_at',
        ]);

        if (!DISPUTABLE_STATUSES.includes(cardTransaction.status)) {
          return resultBuilder.error(
            `Only a cleared or settled payment can be disputed, this one is ${cardTransaction.status}`,
          );
        }

        const existing = await context.dataSource.getCollection('chargebacks').list(
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

        const { reference } = await openChargebackCase(context, {
          reason: context.formValues.Reason,
          network: cardTransaction.card?.network ?? null,
          customerId: cardTransaction.card?.customer_id ?? null,
          transactionId: cardTransaction.transaction_id,
          cardTransactionId,
          amount: cardTransaction.original_amount,
          currency: cardTransaction.original_currency,
          paidAt: cardTransaction.transaction?.created_at,
          accountId: cardTransaction.transaction?.account_id,
        });

        return resultBuilder.success(`Chargeback ${reference} opened`);
      },
    });

import type { CollectionCustomizer, TSchema } from '@forestadmin/datasource-customizer';

import { byId, now } from './utils';

// Our refund reasons → suggested (reason_code, description) per network.
const REASON_MAPPING: Record<string, Record<string, [string, string]>> = {
  UNAUTHORIZED: {
    MASTERCARD: ['4837', 'No Cardholder Authorization'],
    VISA: ['10.4', 'Fraud — Card-Absent Environment'],
  },
  DUPLICATE_CHARGE: {
    MASTERCARD: ['4834', 'Duplicate Processing / Paid by Other Means'],
    VISA: ['12.6.1', 'Duplicate Processing'],
  },
  ITEM_NOT_RECEIVED: {
    MASTERCARD: ['4855', 'Goods or Services Not Provided'],
    VISA: ['13.1', 'Merchandise / Services Not Received'],
  },
  SERVICE_NOT_RENDERED: {
    MASTERCARD: ['4853', 'Cardholder Dispute — Services Not Provided'],
    VISA: ['13.2', 'Cancelled Recurring Transaction'],
  },
  CANCELLED_ORDER: {
    MASTERCARD: ['4860', 'Credit Not Processed'],
    VISA: ['13.6', 'Credit Not Processed'],
  },
};

export default function customizeRefundRequests(
  collection: CollectionCustomizer<TSchema, 'refund_requests'>,
): void {
  // Relationships
  collection
    .addManyToOneRelation('customer', 'customers', { foreignKey: 'customer_id' })
    .addOneToManyRelation('chargebacks', 'chargebacks', { originKey: 'refund_request_id' });

  collection.addAction('Decline Refund', {
    scope: 'Single',
    form: [
      {
        label: 'Decline Reason',
        type: 'String',
        isRequired: true,
        description: 'Explain why this refund request cannot be approved.',
      },
    ],
    execute: async (context, resultBuilder) => {
      const id = await context.getRecordId();

      await context.collection.update(byId(id), {
        status: 'DECLINED',
        resolution_notes: context.formValues['Decline Reason'],
        reviewed_at: now(),
        reviewed_by: context.caller.email,
      });

      return resultBuilder.success('Refund request declined.');
    },
  });

  collection.addAction('Open Chargeback', {
    scope: 'Single',
    form: [
      {
        label: 'Network',
        type: 'Enum',
        enumValues: ['VISA', 'MASTERCARD'],
        isRequired: true,
        description: 'Card network the disputed transaction was processed on.',
      },
      {
        label: 'Merchant Name',
        type: 'String',
        isRequired: true,
        description: "Merchant as it appeared on the cardholder's statement.",
      },
      {
        label: 'Analyst Notes',
        type: 'String',
        description: 'Why are we escalating this refund to a chargeback?',
      },
    ],
    execute: async (context, resultBuilder) => {
      const refundId = await context.getRecordId();
      const refund = await context.getRecord([
        'customer_id',
        'transaction_id',
        'transaction_date',
        'amount',
        'currency',
        'reason',
        'status',
      ]);
      const network = context.formValues.Network;
      const analyst = context.caller.email;
      const chargebacks = context.dataSource.getCollection('chargebacks');

      if (refund.status === 'ESCALATED') {
        const existing = await chargebacks.list(
          { conditionTree: { field: 'refund_request_id', operator: 'Equal', value: refundId } },
          ['reference'],
        );

        if (existing.length) {
          return resultBuilder.error(
            `Refund already escalated to chargeback ${existing[0].reference}.`,
          );
        }
      }

      const [code, description] = REASON_MAPPING[refund.reason as string]?.[network] ?? [
        'GENERAL',
        'General Dispute',
      ];

      // Pick the customer's primary active card (fallback: most recently issued).
      const cards = await context.dataSource
        .getCollection('cards')
        .list(
          { conditionTree: { field: 'customer_id', operator: 'Equal', value: refund.customer_id } },
          ['id', 'status', 'issued_at'],
        );
      cards.sort((a, b) => {
        if ((a.status === 'ACTIVE') !== (b.status === 'ACTIVE')) {
          return a.status === 'ACTIVE' ? -1 : 1;
        }

        return String(b.issued_at).localeCompare(String(a.issued_at));
      });
      const cardId = cards[0]?.id ?? null;

      const all = await chargebacks.list({}, ['id']);
      const nextId = all.reduce((max, r) => Math.max(max, Number(r.id)), 0) + 1;
      const reference = `CB-${new Date().getUTCFullYear()}-${String(nextId).padStart(5, '0')}`;

      await chargebacks.create([
        {
          id: nextId,
          reference,
          customer_id: refund.customer_id,
          card_id: cardId,
          refund_request_id: refundId,
          transaction_id: refund.transaction_id,
          merchant_name: context.formValues['Merchant Name'],
          transaction_amount: refund.amount,
          transaction_currency: refund.currency,
          transaction_date: refund.transaction_date,
          amount: refund.amount,
          currency: refund.currency,
          network,
          reason_code: code,
          reason_description: description,
          source: 'CUSTOMER_DISPUTE',
          status: 'INITIATED',
          filed_at: now(),
          provisional_credit_issued: false,
          analyst_email: analyst,
          resolution_notes: context.formValues['Analyst Notes'] ?? null,
          created_at: now(),
          updated_at: now(),
        },
      ]);

      await context.collection.update(byId(refundId), {
        status: 'ESCALATED',
        escalated_to: 'CHARGEBACK',
        reviewed_at: now(),
        reviewed_by: analyst,
      });

      return resultBuilder.success(
        `Chargeback ${reference} opened on ${network} (${code}). Refund marked as ESCALATED.`,
      );
    },
  });
}

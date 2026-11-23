import type { DisputeRequestsCustomizer } from '../typings';

import { REASON_CODES, blockCard, blockText, openChargebackCase } from './chargebacks';
import {
  and,
  book,
  codeText,
  coll,
  euros,
  listMove,
  merchantOf,
  moveTo,
  now,
  one,
  patch,
} from '../case-helpers';
import { addQueues } from '../queues';

const ROUTES = ['CHARGEBACK', 'BANK_REFUND', 'CONTACT_MERCHANT', 'DECLINED'];
const OPEN_CASE_ROUTES = ['CHARGEBACK'];
const ROUTABLE = ['NEW', 'WAITING_CUSTOMER'];
const CLOSE_NOTES = {
  CONTACT_MERCHANT: 'Customer asked to contact the merchant first; can come back after 15 days.',
  DECLINED: 'Not eligible.',
  BANK_REFUND:
    'No chargeback right on this payment, so the bank refunded it and bears the loss (PSD2).',
};
const DISPUTE = [
  'id',
  'reference',
  'status',
  'customer_id',
  'transaction_id',
  'amount',
  'reason',
  'payment_type',
  'card_transaction_id',
  'transaction:account_id',
  'transaction:created_at',
];

async function linkDisputed(context, dispute, links) {
  const rows = await coll(context, 'dispute_transactions').list(
    and(
      { field: 'dispute_request_id', operator: 'Equal', value: dispute.id },
      { field: 'role', operator: 'Equal', value: 'DISPUTED' },
    ),
    ['id', 'chargeback_id'],
  );
  const free = rows.find(r => !r.chargeback_id);

  if (free) {
    await patch(context, 'dispute_transactions', free.id, links);
  } else {
    await listMove(context, dispute.transaction_id, 'DISPUTED', {
      dispute_request_id: dispute.id,
      ...links,
    });
  }
}

async function openChargeback(context, dispute) {
  if (dispute.payment_type !== 'CARD' || !dispute.card_transaction_id) {
    return [null, 'A chargeback is only for a card payment.'];
  }

  const reason = dispute.reason === 'SCAM' ? 'UNAUTHORIZED' : dispute.reason;
  if (!REASON_CODES[reason]) return [null, `No card network reason code for ${dispute.reason}.`];
  const payment = await one(
    context,
    'card_transactions',
    dispute.card_transaction_id,
    ['card:network'],
    '_id',
  );
  const cb = await openChargebackCase(context, {
    reason,
    network: payment.card.network,
    customerId: dispute.customer_id,
    transactionId: dispute.transaction_id,
    cardTransactionId: dispute.card_transaction_id,
    disputeRequestId: dispute.id,
    amount: dispute.amount,
    paidAt: dispute.transaction.created_at,
    accountId: dispute.transaction.account_id,
  });
  await linkDisputed(context, dispute, { chargeback_id: cb.id });

  return [cb, null];
}

async function bankRefund(context, dispute) {
  const merchant = await merchantOf(context, dispute.transaction_id);
  const refund = await book(
    context,
    dispute.transaction.account_id,
    'CREDIT',
    Number(dispute.amount),
    `REMBOURSEMENT LITIGE ${merchant}`,
  );
  await listMove(context, refund.id, 'REFUND', { dispute_request_id: dispute.id });

  return [{ reference: `refund of ${euros(dispute.amount)}` }, null];
}

const OPENERS = { CHARGEBACK: openChargeback, BANK_REFUND: bankRefund };

async function routeDispute(context, resultBuilder) {
  const dispute = await context.getRecord(DISPUTE);

  if (!ROUTABLE.includes(dispute.status)) {
    return resultBuilder.error(`${dispute.reference} is ${dispute.status}: routed already.`);
  }

  const { Route: route, Note: note } = context.formValues;
  const [opened, error] = OPENERS[route] ? await OPENERS[route](context, dispute) : [null, null];
  if (error) return resultBuilder.error(error);
  const routed = OPEN_CASE_ROUTES.includes(route);
  const block =
    dispute.payment_type === 'CARD' &&
    dispute.reason === 'UNAUTHORIZED' &&
    route !== 'CONTACT_MERCHANT' &&
    dispute.card_transaction_id
      ? await blockCard(context, dispute.card_transaction_id)
      : null;
  const notes = note || CLOSE_NOTES[route] || null;
  await moveTo(
    context,
    'DISPUTE_REQUESTS',
    dispute,
    routed ? 'ROUTED' : 'CLOSED',
    {
      route,
      routed_at: now(),
      assigned_to: context.caller.email,
      closed_at: routed ? null : now(),
      resolution_notes: routed ? null : notes,
    },
    routed ? route : notes,
  );

  return resultBuilder.success(
    `${dispute.reference} ${routed ? 'routed' : 'closed'} (${codeText(route)})${
      opened ? `: ${opened.reference}` : ''
    }.${block ? ` Card: ${blockText(block)}.` : ''}`,
  );
}

export default (collection: DisputeRequestsCustomizer) =>
  addQueues(collection)
    .removeField('direct_debit_id', 'outgoing_transfer_id')
    .renameField('amount', 'disputed_amount')
    .addManyToOneRelation('customer', 'customers', { foreignKey: 'customer_id' })
    .addManyToOneRelation('transaction', 'transactions', { foreignKey: 'transaction_id' })
    .addManyToOneRelation('card_transaction', 'card_transactions', {
      foreignKey: 'card_transaction_id',
    })
    .addManyToOneRelation('alert', 'alerts', { foreignKey: 'alert_id' })
    .addManyToOneRelation('investigation', 'investigations', { foreignKey: 'investigation_id' })

    .addAction('Route dispute', {
      scope: 'Single',
      form: [
        { label: 'Route', type: 'Enum', enumValues: ROUTES, isRequired: true },
        { label: 'Note', type: 'String', widget: 'TextArea' },
      ],
      execute: routeDispute,
    });

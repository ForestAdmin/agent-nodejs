import type { ChargebacksCustomizer } from '../typings';

import {
  DAY_IN_MS,
  book,
  codeText,
  daysFromNow,
  digitsOf,
  euros,
  history,
  listMove,
  merchantOf,
  moveTo,
  now,
  one,
  openCase,
  patch,
} from '../case-helpers';
import { addQueues } from '../queues';

export const REASON_CODES = {
  UNAUTHORIZED: [
    '10.4',
    'Other Fraud – Card-Absent Environment',
    '4837',
    'No Cardholder Authorization',
  ],
  DUPLICATE_CHARGE: ['12.6.1', 'Duplicate Processing', '4834', 'Point-of-Interaction Error'],
  CANCELLED_ORDER: ['13.7', 'Cancelled Merchandise/Services', '4853', 'Cardholder Dispute'],
  CANCELLED_RECURRING: ['13.2', 'Cancelled Recurring Transaction', '4853', 'Cardholder Dispute'],
  ITEM_NOT_RECEIVED: [
    '13.1',
    'Merchandise/Services Not Received',
    '4855',
    'Goods or Services Not Provided',
  ],
  SERVICE_NOT_RENDERED: [
    '13.1',
    'Merchandise/Services Not Received',
    '4855',
    'Goods or Services Not Provided',
  ],
  WRONG_AMOUNT: ['12.5', 'Incorrect Amount', '4834', 'Point-of-Interaction Error'],
};
const FRAUD_CODES = ['10.3', '10.4', '4837', '4863'];
const CARD_DISPUTE_DAYS = 120;
const VISA_ANSWER_DAYS = 30;
const MASTERCARD_ANSWER_DAYS = 45;
const CASE_ID_DIGITS = 10;
const DECIDED = ['WON', 'LOST', 'WITHDRAWN'];
const TO_FILE = ['INITIATED', 'WAITING_CARDHOLDER'];
const ANSWERED = ['REPRESENTED', 'PRE_ARBITRATION'];
const BLOCKABLE = ['ACTIVE', 'PENDING'];
const CHARGEBACK = [
  'id',
  'reference',
  'status',
  'customer_id',
  'transaction_id',
  'card_transaction_id',
  'dispute_request_id',
  'network',
  'reason_code',
  'amount',
  'processor_dispute_id',
  'provisional_credit_issued',
  'reason_description',
  'transaction:account_id',
];

const networkTool = (network: string) =>
  network === 'VISA' ? 'Visa dispute system' : 'Mastercard dispute system';
const answerDays = (network: string) =>
  network === 'MASTERCARD' ? MASTERCARD_ANSWER_DAYS : VISA_ANSWER_DAYS;
const daysTo = (date: Date) => Math.ceil((date.getTime() - Date.now()) / DAY_IN_MS);

async function provisionalCredit(context, cb, accountId: string) {
  const merchant = await merchantOf(context, cb.transaction_id);
  const label = FRAUD_CODES.includes(cb.reason_code)
    ? 'REMBOURSEMENT OPERATION NON AUTORISEE CB'
    : 'CREDIT PROVISOIRE LITIGE CB';
  const transaction = await book(
    context,
    accountId,
    'CREDIT',
    Number(cb.amount),
    `${label} ${merchant}`,
  );
  await patch(context, 'chargebacks', cb.id, {
    provisional_credit_issued: true,
    provisional_credit_transaction_id: transaction.id,
  });
  await listMove(context, transaction.id, 'PROVISIONAL_CREDIT', { chargeback_id: cb.id });

  return transaction;
}

export async function openChargebackCase(
  context,
  {
    reason,
    network,
    customerId,
    transactionId,
    cardTransactionId,
    disputeRequestId = null,
    amount,
    currency = 'EUR',
    paidAt,
    accountId,
  },
) {
  const [visa, visaLabel, mc, mcLabel] = REASON_CODES[reason];
  const due = new Date(new Date(paidAt).getTime() + CARD_DISPUTE_DAYS * DAY_IN_MS);
  const cb = await openCase(context, 'chargebacks', 'CBK', {
    customer_id: customerId,
    transaction_id: transactionId,
    card_transaction_id: cardTransactionId,
    dispute_request_id: disputeRequestId,
    network,
    source: 'CUSTOMER_REQUEST',
    reason_code: network === 'VISA' ? visa : mc,
    reason_description: network === 'VISA' ? visaLabel : mcLabel,
    amount,
    currency,
    status: 'INITIATED',
    assigned_to: context.caller.email,
    provisional_credit_issued: false,
    representment_deadline: due.toISOString(),
    days_to_deadline: daysTo(due),
    is_overdue: due.getTime() < Date.now(),
    created_at: now(),
    updated_at: now(),
  });

  if (FRAUD_CODES.includes(cb.reason_code)) await provisionalCredit(context, cb, accountId);

  return cb;
}

const blockReference = (cardId: string) =>
  `MQ-${digitsOf(cardId, CASE_ID_DIGITS).padStart(CASE_ID_DIGITS, '0')}`;

export async function blockCard(context, cardTransactionId: string) {
  const payment = await one(
    context,
    'card_transactions',
    cardTransactionId,
    ['card:id', 'card:status', 'card:network', 'card:last_four_digits', 'card:blocked_reason'],
    '_id',
  );
  const card = payment?.card;
  if (!card?.id) return null;
  if (!BLOCKABLE.includes(card.status)) return { card, blocked: false };
  await patch(context, 'cards', card.id, {
    status: 'BLOCKED',
    blocked_reason: 'FRAUD',
    blocked_at: now(),
  });

  return { card, blocked: true };
}

export function blockText({ card, blocked }) {
  const name = `${codeText(card.network)} card •••• ${card.last_four_digits}`;

  if (blocked) {
    return `${name} blocked (fraud) through the card processor, ref ${blockReference(
      card.id,
    )} (simulated)`;
  }

  return `${name} ${card.status.toLowerCase()} already${
    card.blocked_reason ? ` (${card.blocked_reason.toLowerCase()})` : ''
  }`;
}

async function closeRequestOf(context, cb, notes: string) {
  const request = await one(context, 'dispute_requests', cb.dispute_request_id, ['status']);
  if (!request || request.status === 'CLOSED') return;
  await patch(context, 'dispute_requests', cb.dispute_request_id, {
    status: 'CLOSED',
    closed_at: now(),
    resolution_notes: notes,
  });
  await history(
    context,
    'DISPUTE_REQUESTS',
    cb.dispute_request_id,
    [request.status, 'CLOSED'],
    notes,
  );
}

async function blockLinkedCard(context, resultBuilder) {
  const cb = await context.getRecord(['card_transaction_id', 'reference']);
  const block = await blockCard(context, cb.card_transaction_id);
  if (!block) return resultBuilder.error(`No card on ${cb.reference}.`);
  if (!block.blocked) return resultBuilder.success(`${blockText(block)}: nothing to block.`);

  return resultBuilder.success(`${blockText(block)}.`);
}

async function fileWithNetwork(context, resultBuilder) {
  const cb = await context.getRecord(CHARGEBACK);

  if (!TO_FILE.includes(cb.status)) {
    return resultBuilder.error(`${cb.reference} is ${cb.status}: filed already.`);
  }

  const caseId =
    cb.processor_dispute_id ||
    `${cb.network === 'VISA' ? 'VROL' : 'MCOM'}-${digitsOf(cb.id, CASE_ID_DIGITS).padStart(
      CASE_ID_DIGITS,
      '0',
    )}`;
  const due = daysFromNow(answerDays(cb.network));
  await moveTo(
    context,
    'CHARGEBACKS',
    cb,
    'PRESENTED',
    {
      filed_at: now(),
      processor_dispute_id: caseId,
      representment_deadline: due.toISOString(),
      days_to_deadline: daysTo(due),
      is_overdue: false,
      updated_at: now(),
    },
    `Filed with ${codeText(cb.network)}`,
  );

  if (!cb.provisional_credit_issued && FRAUD_CODES.includes(cb.reason_code)) {
    await provisionalCredit(context, cb, cb.transaction.account_id);
  }

  return resultBuilder.success(
    `${cb.reference} filed with ${codeText(cb.network)} through ${networkTool(
      cb.network,
    )}, case ${caseId} (simulated).`,
  );
}

async function acceptLiability(context, resultBuilder) {
  const cb = await context.getRecord(CHARGEBACK);

  if (DECIDED.includes(cb.status)) {
    return resultBuilder.error(`${cb.reference} is decided (${cb.status}).`);
  }

  if (!cb.provisional_credit_issued) {
    const merchant = await merchantOf(context, cb.transaction_id);
    const refund = await book(
      context,
      cb.transaction.account_id,
      'CREDIT',
      Number(cb.amount),
      `REMBOURSEMENT LITIGE CB ${merchant}`,
    );
    await listMove(context, refund.id, 'REFUND', { chargeback_id: cb.id });
  }

  const notes = `The bank accepted liability and refunded the customer${
    context.formValues.Note ? `. ${context.formValues.Note}` : ''
  }`;
  await moveTo(
    context,
    'CHARGEBACKS',
    cb,
    'WITHDRAWN',
    {
      decision_at: now(),
      resolution_notes: notes,
      representment_deadline: null,
      days_to_deadline: null,
      is_overdue: false,
      updated_at: now(),
    },
    notes,
  );
  await closeRequestOf(context, cb, notes);

  return resultBuilder.success(`${cb.reference}: customer refunded ${euros(cb.amount)}.`);
}

async function filePreArbitration(context, resultBuilder) {
  const cb = await context.getRecord(CHARGEBACK);

  if (cb.status !== 'REPRESENTED') {
    return resultBuilder.error(
      `${cb.reference} is ${cb.status}: a pre-arbitration answers the merchant's representment.`,
    );
  }

  const due = daysFromNow(answerDays(cb.network));
  const answer = context.formValues['Our answer'];
  await moveTo(
    context,
    'CHARGEBACKS',
    cb,
    'PRE_ARBITRATION',
    {
      pre_arbitration_filed_at: now(),
      representment_deadline: due.toISOString(),
      days_to_deadline: daysTo(due),
      is_overdue: false,
      updated_at: now(),
    },
    `Pre-arbitration: ${answer}`,
  );

  return resultBuilder.success(
    `${cb.reference}: pre-arbitration filed through ${networkTool(cb.network)}, case ${
      cb.processor_dispute_id
    } (simulated).`,
  );
}

async function acceptRepresentment(context, resultBuilder) {
  const cb = await context.getRecord([
    ...CHARGEBACK,
    'representment_reason',
    'provisional_credit_reversed_at',
  ]);

  if (!ANSWERED.includes(cb.status)) {
    return resultBuilder.error(`${cb.reference} is ${cb.status}: the merchant has not answered.`);
  }

  const fraud = FRAUD_CODES.includes(cb.reason_code);
  let reversed = null;

  if (cb.provisional_credit_issued && !fraud && !cb.provisional_credit_reversed_at) {
    const merchant = await merchantOf(context, cb.transaction_id);
    reversed = await book(
      context,
      cb.transaction.account_id,
      'DEBIT',
      Number(cb.amount),
      `ANNULATION CREDIT PROVISOIRE ${merchant}`,
    );
    await listMove(context, reversed.id, 'CREDIT_REVERSAL', { chargeback_id: cb.id });
  }

  const why = (cb.representment_reason || 'evidence accepted').toLowerCase();
  const kept = cb.provisional_credit_issued && !reversed && !cb.provisional_credit_reversed_at;
  let outcome = 'nothing had been credited, nothing to take back';
  if (reversed || cb.provisional_credit_reversed_at) outcome = 'the credit was taken back';
  else if (kept) outcome = 'the refund stays, the bank bears the loss';
  const notes = `The merchant proved its case (${why}): ${outcome}${
    context.formValues.Note ? `. ${context.formValues.Note}` : ''
  }`;
  await moveTo(
    context,
    'CHARGEBACKS',
    cb,
    'LOST',
    {
      decision_at: now(),
      resolution_notes: notes,
      provisional_credit_reversed_at: reversed ? now() : null,
      representment_deadline: null,
      days_to_deadline: null,
      is_overdue: false,
      updated_at: now(),
    },
    notes,
  );
  await closeRequestOf(context, cb, notes);

  return resultBuilder.success(
    `${cb.reference} lost: ${
      reversed ? `${euros(cb.amount)} taken back from the customer` : outcome
    }.`,
  );
}

export default (collection: ChargebacksCustomizer) =>
  addQueues(collection)
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
    })

    .addAction('Block linked card', { scope: 'Single', execute: blockLinkedCard })
    .addAction('File with network', { scope: 'Single', execute: fileWithNetwork })
    .addAction('Accept Liability & Refund Customer', {
      scope: 'Single',
      form: [{ label: 'Note', type: 'String' }],
      execute: acceptLiability,
    })
    .addAction('File pre-arbitration', {
      scope: 'Single',
      form: [{ label: 'Our answer', type: 'String', widget: 'TextArea', isRequired: true }],
      execute: filePreArbitration,
    })
    .addAction('Accept representment', {
      scope: 'Single',
      form: [{ label: 'Note', type: 'String' }],
      execute: acceptRepresentment,
    });

import type { Card, Customer, Refund, Row } from './types';
import type { Knex } from 'knex';

import { dayOnlyAgo, daysAgo } from './dates';
import { ANALYSTS, CB_REASONS, CB_STATUS, MERCHANTS, NETWORKS, SOURCES } from './pools';
import {
  chance,
  choices,
  insertAll,
  pick,
  randint,
  round2,
  sample,
  shuffle,
  uniform,
} from './utils';

/**
 * Spreads chargebacks over 60 customers (1–5 each), each tied to one of the
 * customer's cards and, for customer disputes, occasionally to an existing refund
 * request — so the dispute trail links back to a real refund.
 */
export default async function seedChargebacks(
  knex: Knex,
  customers: Customer[],
  cardsByCust: Record<number, Card[]>,
  refundsByCust: Record<number, Refund[]>,
): Promise<void> {
  await knex.schema.createTable('chargebacks', table => {
    table.increments('id').primary();
    table.string('reference');
    table.integer('customer_id');
    table.integer('card_id');
    table.integer('refund_request_id');
    table.string('transaction_id');
    table.string('merchant_name');
    table.string('merchant_category');
    table.string('mcc_code');
    table.float('transaction_amount');
    table.string('transaction_currency');
    table.date('transaction_date');
    table.float('amount');
    table.string('currency');
    table.string('network');
    table.string('reason_code');
    table.string('reason_description');
    table.string('source');
    table.string('processor_dispute_id');
    table.string('status');
    table.datetime('filed_at');
    table.datetime('representment_deadline');
    table.datetime('decision_at');
    table.string('evidence_url');
    table.datetime('evidence_submitted_at');
    table.boolean('provisional_credit_issued');
    table.string('analyst_email');
    table.string('resolution_notes');
    table.datetime('created_at');
    table.datetime('updated_at');
  });

  const chargebacks: Row[] = [];
  let cbid = 0;
  const cbCusts = sample(customers, 60);
  const plan: Customer[] = [];

  for (const c of cbCusts) {
    for (let k = 0; k < choices([1, 2, 3, 5], [46, 30, 17, 7]); k += 1) plan.push(c);
  }

  for (const c of shuffle(plan)) {
    cbid += 1;
    const [merch, cat, mcc] = pick(MERCHANTS);
    const card = pick(cardsByCust[c.id]);
    const txAmount = round2(uniform(12, 2400));
    const amount = chance(0.35) ? round2(txAmount * uniform(0.2, 0.9)) : txAmount; // partial disputes
    const status = choices(CB_STATUS, [22, 16, 13, 13, 5, 5, 3, 3]);
    const filed = randint(1, 110);
    const [rcode, rdesc] = pick(CB_REASONS);
    const src = choices(SOURCES, [55, 30, 15]);
    let rr: number | null = null;

    if (src === 'CUSTOMER_DISPUTE' && refundsByCust[c.id] && chance(0.4)) {
      rr = pick(refundsByCust[c.id]).id;
    }

    const decided = ['WON', 'LOST', 'ACCEPTED'].includes(status);
    const presented = [
      'PRESENTED',
      'REPRESENTED',
      'WON',
      'LOST',
      'ARBITRATION',
      'PRE_ARBITRATION',
    ].includes(status);
    chargebacks.push({
      id: cbid,
      reference: `CB-2026-${String(cbid).padStart(5, '0')}`,
      customer_id: c.id,
      card_id: card.id,
      refund_request_id: rr,
      transaction_id: `TXN-${randint(10000, 99999)}`,
      merchant_name: merch,
      merchant_category: cat,
      mcc_code: mcc,
      transaction_amount: txAmount,
      transaction_currency: 'EUR',
      transaction_date: dayOnlyAgo(filed + randint(2, 20)),
      amount,
      currency: 'EUR',
      network: pick(NETWORKS),
      reason_code: rcode,
      reason_description: rdesc,
      source: src,
      processor_dispute_id: chance(0.7) ? `ADYEN-DSP-${randint(100000, 999999)}` : null,
      status,
      filed_at: daysAgo(filed),
      representment_deadline: daysAgo(filed - 30),
      decision_at: decided ? daysAgo(randint(1, Math.max(2, filed - 2))) : null,
      evidence_url:
        presented && chance(0.7) ? `https://disputes.neobank.eu/evidence/${cbid}.zip` : null,
      evidence_submitted_at:
        presented && chance(0.7) ? daysAgo(randint(1, Math.max(2, filed - 1))) : null,
      provisional_credit_issued: chance(0.4),
      analyst_email: chance(0.6) ? pick(ANALYSTS) : null,
      resolution_notes: decided
        ? pick([
            'Won at representment.',
            'Lost — insufficient evidence.',
            'Accepted liability.',
            'Pending issuer response.',
          ])
        : null,
      created_at: daysAgo(filed > 2 ? filed : 1),
      updated_at: daysAgo(randint(0, Math.max(1, filed - 1))),
    });
  }

  await insertAll(knex, 'chargebacks', chargebacks);
}

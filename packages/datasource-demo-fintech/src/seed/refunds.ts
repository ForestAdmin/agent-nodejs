import type { Customer, Refund } from './types';
import type { Knex } from 'knex';

import { dayOnlyAgo, daysAgo } from './dates';
import { ANALYSTS, REFUND_REASONS, REFUND_STATUSES } from './pools';
import { chance, choices, insertAll, pick, randint, round2, uniform } from './utils';

export interface RefundsResult {
  refunds: Refund[];
  refundsByCust: Record<number, Refund[]>;
}

/** 55 refund requests; resolved ones carry a reviewer and resolution notes. */
export default async function seedRefunds(
  knex: Knex,
  customers: Customer[],
): Promise<RefundsResult> {
  await knex.schema.createTable('refund_requests', table => {
    table.increments('id').primary();
    table.string('reference');
    table.integer('customer_id');
    table.string('transaction_id');
    table.date('transaction_date');
    table.datetime('requested_at');
    table.float('amount');
    table.string('currency');
    table.string('reason');
    table.string('reason_detail');
    table.string('status');
    table.datetime('reviewed_at');
    table.string('reviewed_by');
    table.string('resolution_notes');
    table.string('escalated_to');
    table.datetime('created_at');
  });

  const refunds: Refund[] = [];
  const refundsByCust: Record<number, Refund[]> = {};

  for (let rid = 1; rid <= 55; rid += 1) {
    const c = pick(customers);
    const txdate = randint(10, 90);
    const st = choices(REFUND_STATUSES, [30, 35, 20, 15]);
    const refund: Refund = {
      id: rid,
      reference: `RR-2026-${String(rid).padStart(5, '0')}`,
      customer_id: c.id,
      transaction_id: `TXN-${randint(10000, 99999)}`,
      transaction_date: dayOnlyAgo(txdate),
      requested_at: daysAgo(txdate - randint(1, 5)),
      amount: round2(uniform(9, 1200)),
      currency: 'EUR',
      reason: pick(REFUND_REASONS),
      reason_detail: chance(0.5)
        ? null
        : pick([
            'Charged twice for one order.',
            'Subscription not delivered.',
            'Parcel never arrived.',
            'Card used without consent.',
          ]),
      status: st,
      reviewed_at: st !== 'PENDING' ? daysAgo(randint(1, Math.max(2, txdate - 3))) : null,
      reviewed_by: st !== 'PENDING' ? pick(ANALYSTS) : null,
      resolution_notes:
        st === 'PENDING'
          ? null
          : pick([
              'Refunded to source.',
              'Declined — merchant evidence.',
              'Escalated to chargeback.',
              'Approved as goodwill.',
            ]),
      escalated_to: st === 'ESCALATED' ? 'chargebacks' : null,
      created_at: daysAgo(txdate - randint(0, 4)),
    };
    refunds.push(refund);
    (refundsByCust[c.id] ||= []).push(refund);
  }

  await insertAll(knex, 'refund_requests', refunds);

  return { refunds, refundsByCust };
}

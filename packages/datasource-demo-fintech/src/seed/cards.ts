import type { Card, Customer } from './types';
import type { Knex } from 'knex';

import { dayOnlyAgo, daysAgo } from './dates';
import { CARD_STATUSES, CARD_TYPES } from './pools';
import { choices, insertAll, pick, randint } from './utils';

export interface CardsResult {
  cards: Card[];
  cardsByCust: Record<number, Card[]>;
}

/** Issues 1–3 cards per customer; blocked cards carry a reason and a block date. */
export default async function seedCards(knex: Knex, customers: Customer[]): Promise<CardsResult> {
  await knex.schema.createTable('cards', table => {
    table.increments('id').primary();
    table.integer('customer_id');
    table.string('card_type');
    table.string('status');
    table.string('last_four_digits');
    table.datetime('issued_at');
    table.date('expires_at');
    table.string('blocked_reason');
    table.datetime('blocked_at');
  });

  const cards: Card[] = [];
  const cardsByCust: Record<number, Card[]> = {};
  let cid = 0;

  for (const c of customers) {
    const n = randint(1, 3);

    for (let k = 0; k < n; k += 1) {
      cid += 1;
      const st = choices(CARD_STATUSES, [70, 11, 8, 7, 4]);
      const issued = randint(20, 380);
      const card: Card = {
        id: cid,
        customer_id: c.id,
        card_type: choices(CARD_TYPES, [55, 45]),
        status: st,
        last_four_digits: String(randint(0, 9999)).padStart(4, '0'),
        issued_at: daysAgo(issued),
        expires_at: dayOnlyAgo(-randint(365, 1460)),
        blocked_reason: null,
        blocked_at: null,
      };

      if (st === 'BLOCKED') {
        card.blocked_reason = pick([
          'Suspected fraud',
          'Reported lost',
          'Compliance hold',
          'Customer request',
        ]);
        card.blocked_at = daysAgo(randint(1, Math.max(2, issued - 5)));
      }

      cards.push(card);
      (cardsByCust[c.id] ||= []).push(card);
    }
  }

  await insertAll(knex, 'cards', cards);

  return { cards, cardsByCust };
}

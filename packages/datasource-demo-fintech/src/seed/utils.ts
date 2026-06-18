// Random primitives for the demo seed, backed by faker. The data is intentionally
// re-rolled on every boot (no fixed seed) so the demo feels alive, while the
// coherence rules live in the entity builders, not here.
import type { Knex } from 'knex';

import { faker } from '@faker-js/faker';

export const randint = (lo: number, hi: number): number => faker.number.int({ min: lo, max: hi });
export const uniform = (lo: number, hi: number): number => faker.number.float({ min: lo, max: hi });
export const chance = (p: number): boolean => faker.number.float() < p;
export const pick = <T>(arr: T[]): T => faker.helpers.arrayElement(arr);
export const sample = <T>(arr: T[], k: number): T[] => faker.helpers.arrayElements(arr, k);
export const shuffle = <T>(arr: T[]): T[] => faker.helpers.shuffle(arr);
export const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Weighted pick mirroring the original generator (tolerates zero weights). */
export function choices<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = faker.number.float({ min: 0, max: total });

  for (let i = 0; i < items.length; i += 1) {
    r -= weights[i];
    if (r < 0) return items[i];
  }

  return items[items.length - 1];
}

/**
 * Bulk-insert in chunks to stay under SQLite's bound-parameter limit, regardless
 * of how wide a table is or how many rows a builder produces.
 */
export async function insertAll(
  knex: Knex,
  table: string,
  rows: Record<string, unknown>[],
): Promise<void> {
  if (rows.length) await knex.batchInsert(table, rows, 100);
}

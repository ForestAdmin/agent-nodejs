// Random primitives for the demo seed, backed by faker. The data is intentionally
// re-rolled on every boot (no fixed seed) so the demo feels alive, while the
// coherence rules live in the entity builders, not here.
import type { Knex } from 'knex';

export const randint = (lo: number, hi: number): number =>
  lo + Math.floor(Math.random() * (hi - lo + 1));
export const uniform = (lo: number, hi: number): number => lo + Math.random() * (hi - lo);
export const chance = (p: number): boolean => Math.random() < p;

export function pick<T>(arr: T[]): T {
  if (!arr.length) throw new Error('Cannot pick from an empty array');

  return arr[randint(0, arr.length - 1)];
}

/** Fisher-Yates on a copy, so pools shared across seeders are never mutated. */
export function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];

  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = randint(0, i);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

export const sample = <T>(arr: T[], k: number): T[] => shuffle(arr).slice(0, k);
export const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Weighted pick mirroring the original generator (tolerates zero weights). */
export function choices<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = uniform(0, total);

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

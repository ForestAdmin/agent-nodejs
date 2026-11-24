import type { Server } from 'http';

import express from 'express';
import { existsSync, readFileSync } from 'fs';

export const MERCHANTS_FILE = './assets/card-merchants.json';
export const MERCHANTS_PATH = 'card_merchants';

const DEFAULT_PORT = 3359;
const START = '_start';
const LIMIT = '_limit';
const SORT = '_sort';
const ORDER = '_order';
const SEARCH = 'q';
const RESERVED_PARAMS = [START, LIMIT, SORT, ORDER, SEARCH];

type Merchant = Record<string, string | number | boolean | null>;

function merchantsApiPort(): number {
  return Number(process.env.HTTP_PORT_MERCHANTS_API ?? DEFAULT_PORT);
}

export function merchantsApiUrl(): string {
  return `http://localhost:${merchantsApiPort()}`;
}

export function parseQuery(raw: string): Record<string, string | string[]> {
  const params = new URLSearchParams(raw);

  return Object.fromEntries(
    [...new Set(params.keys())].map(key => {
      const values = params.getAll(key);

      return [key, values.length === 1 ? values[0] : values];
    }),
  );
}

function asList(value: unknown): string[] {
  return [value].flat().map(String);
}

function compare(left: Merchant, right: Merchant, fields: string[], orders: string[]): number {
  for (const [index, field] of fields.entries()) {
    const direction = orders[index] === 'desc' ? -1 : 1;
    const result = String(left[field] ?? '').localeCompare(String(right[field] ?? ''));
    if (result) return result * direction;
  }

  return 0;
}

export function queryMerchants(
  merchants: Merchant[],
  query: Record<string, unknown>,
): { total: number; page: Merchant[] } {
  const equalities = Object.entries(query).filter(([key]) => !RESERVED_PARAMS.includes(key));
  const search = query[SEARCH] ? String(query[SEARCH]).toLowerCase() : null;

  const matching = merchants
    .filter(merchant =>
      equalities.every(([field, value]) => asList(value).includes(String(merchant[field]))),
    )
    .filter(
      merchant =>
        !search ||
        Object.values(merchant).some(
          value => typeof value === 'string' && value.toLowerCase().includes(search),
        ),
    );

  if (query[SORT]) {
    const fields = String(query[SORT]).split(',');
    const orders = String(query[ORDER] ?? '').split(',');
    matching.sort((left, right) => compare(left, right, fields, orders));
  }

  const start = Number(query[START] ?? 0);
  const end = query[LIMIT] === undefined ? matching.length : start + Number(query[LIMIT]);

  return { total: matching.length, page: matching.slice(start, end) };
}

export default function startMerchantsApi(): Server {
  if (!existsSync(MERCHANTS_FILE)) {
    throw new Error(`${MERCHANTS_FILE} is missing: run 'yarn db:seed' first`);
  }

  const merchants: Merchant[] = JSON.parse(readFileSync(MERCHANTS_FILE, 'utf8'));
  const app = express();
  app.set('query parser', parseQuery);

  app.get(`/${MERCHANTS_PATH}`, (req, res) => {
    const { total, page } = queryMerchants(merchants, req.query);
    res.set('X-Total-Count', String(total)).json(page);
  });

  return app.listen(merchantsApiPort());
}

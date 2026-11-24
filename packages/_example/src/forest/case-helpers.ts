import { randomUUID } from 'crypto';

export const DAY_IN_MS = 24 * 60 * 60 * 1000;
const REFERENCE_DIGITS = 6;
const DATE_LENGTH = 10;
const SIGNIFICANT_ID_CHARACTERS = 12;
const HEXADECIMAL = 16;

export const now = () => new Date().toISOString();
export const isoDate = (date: Date) => date.toISOString().slice(0, DATE_LENGTH);
export const daysFromNow = (days: number) => new Date(Date.now() + days * DAY_IN_MS);
export const round2 = (value: unknown) => Math.round(Number(value) * 100) / 100;
export const readable = (code: unknown) =>
  String(code || '')
    .replace(/_/g, ' ')
    .toLowerCase();
export const euros = (value: unknown) =>
  `${Number(value).toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} EUR`;

const ACRONYMS = new Set(['AML', 'PEP', 'KYC', 'SEPA', 'SCT', 'SDD', 'B2B', 'ATM', 'IBAN', 'MFA']);
const NAMED = {
  CHARGEBACK: 'Card chargeback',
  VISA: 'Visa',
  MASTERCARD: 'Mastercard',
  UNAUTHORIZED: 'Unauthorised',
};

export const codeText = (code: unknown) =>
  code
    ? NAMED[code as string] ||
      String(code)
        .split('_')
        .map((word, i) => {
          if (ACRONYMS.has(word)) return word;

          return i ? word.toLowerCase() : word.charAt(0) + word.slice(1).toLowerCase();
        })
        .join(' ')
    : '';

export const digitsOf = (id: string, count: number) =>
  String(parseInt(id.replace(/-/g, '').slice(0, SIGNIFICANT_ID_CHARACTERS), HEXADECIMAL)).slice(
    -count,
  );

export const coll = (context, table: string) => context.dataSource.getCollection(table);
export const byId = (id: unknown, key = 'id') => ({
  conditionTree: { field: key, operator: 'Equal', value: id },
});
export const where = (field: string, value: unknown) => ({
  conditionTree: { field, operator: Array.isArray(value) ? 'In' : 'Equal', value },
});
export const and = (...conditions) => ({ conditionTree: { aggregator: 'And', conditions } });

export async function one(context, table: string, id: unknown, fields: string[], key = 'id') {
  if (!id) return null;
  const [row] = await coll(context, table).list(byId(id, key), fields);

  return row || null;
}

export const patch = (context, table: string, id: unknown, values, key = 'id') =>
  coll(context, table).update(byId(id, key), values);

export async function nextReference(context, table: string, prefix: string) {
  const start = `${prefix}-${new Date().getUTCFullYear()}-`;
  const [last] = await coll(context, table).list(
    {
      conditionTree: { field: 'reference', operator: 'StartsWith', value: start },
      sort: [{ field: 'reference', ascending: false }],
      page: { skip: 0, limit: 1 },
    },
    ['reference'],
  );
  const next = last ? Number(last.reference.slice(start.length)) + 1 : 1;

  return `${start}${String(next).padStart(REFERENCE_DIGITS, '0')}`;
}

export async function history(
  context,
  recordType: string,
  id: string,
  [from, to]: [unknown, unknown],
  reason?: string | null,
  field = 'status',
) {
  await coll(context, 'status_changes').create([
    {
      id: randomUUID(),
      record_type: recordType,
      record_id: id,
      field,
      old_value: from || null,
      new_value: to,
      changed_by: context.caller.email,
      changed_at: now(),
      reason: reason || null,
    },
  ]);
}

export async function openCase(context, table: string, prefix: string, row, key = 'id') {
  const created = {
    [key]: randomUUID(),
    reference: await nextReference(context, table, prefix),
    ...row,
  };
  await coll(context, table).create([created]);
  await history(context, table.toUpperCase(), created[key], [null, created.status]);

  return created;
}

export async function moveTo(context, recordType: string, record, status: string, values, reason?) {
  await context.collection.update(context.filter, { status, ...values });
  await history(context, recordType, record.id, [record.status, status], reason);
}

export async function book(
  context,
  accountId: string,
  direction: 'CREDIT' | 'DEBIT',
  amount: number,
  description: string,
) {
  const account = await one(context, 'accounts', accountId, ['balance', 'available_balance']);
  const sign = direction === 'CREDIT' ? 1 : -1;
  const balance = round2(Number(account.balance) + sign * amount);
  const date = new Date();
  const transaction = {
    id: randomUUID(),
    account_id: accountId,
    rail: 'INTERNAL',
    direction,
    amount: round2(amount),
    currency: 'EUR',
    status: 'BOOKED',
    booked_at: date.toISOString(),
    created_at: date.toISOString(),
    value_date: isoDate(date),
    balance_after: balance,
    description,
    category: 'REFUNDS',
  };
  await coll(context, 'transactions').create([transaction]);
  await patch(context, 'accounts', accountId, {
    balance,
    available_balance: round2(Number(account.available_balance) + sign * amount),
    last_activity_at: date.toISOString(),
  });

  return transaction;
}

export const listMove = (context, transactionId: string, role: string, links) =>
  coll(context, 'dispute_transactions').create([
    {
      id: randomUUID(),
      transaction_id: transactionId,
      role,
      dispute_request_id: null,
      chargeback_id: null,
      ...links,
    },
  ]);

export async function merchantOf(context, transactionId: string) {
  const transaction = await one(context, 'transactions', transactionId, ['counterparty:name']);

  return transaction?.counterparty?.name?.toUpperCase() || 'MARCHAND';
}

export async function freezeAccount(context, account, reason: string, note?: string) {
  if (account.status === 'FROZEN' || account.status === 'CLOSED') {
    return `Account ${account.iban} is ${account.status.toLowerCase()} already.`;
  }

  await patch(context, 'accounts', account.id, {
    status: 'FROZEN',
    frozen_at: now(),
    freeze_reason: reason,
    freeze_note: note || null,
  });

  return null;
}

export async function unfreezeAccount(context, account) {
  if (account.status !== 'FROZEN') return `Account ${account.iban} is not frozen.`;

  await patch(context, 'accounts', account.id, {
    status: 'ACTIVE',
    frozen_at: null,
    freeze_reason: null,
    freeze_note: null,
  });

  return null;
}

/**
 * The ledger of the waves written after the statements (disputes, credit): a movement booked
 * later still lands in date order on its account, and the running balance is written again line
 * by line, so every statement keeps adding up.
 */
import { transactionRow } from './banking';
import { DAY, iso, isoDate, round2 } from './random';

function businessDays(date, n) {
  const d = new Date(date);
  let left = n;

  while (left > 0) {
    d.setTime(d.getTime() + DAY);
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) left -= 1;
  }

  return d;
}

function ledger(ctx) {
  // Once per build: every wave after the statements books through the same ledger.
  if (ctx.txOf) return;
  const txOf = new Map();
  ctx.rows.transactions.forEach(tx => {
    if (!txOf.has(tx.account_id)) txOf.set(tx.account_id, []);
    txOf.get(tx.account_id).push(tx);
  });
  ctx.txOf = txOf;
  ctx.accounts = new Map(ctx.rows.accounts.map(a => [a.id, a]));
  ctx.opening = new Map();
  ctx.waiting = new Map();
}

const signed = tx => (tx.direction === 'CREDIT' ? Number(tx.amount) : -Number(tx.amount));
const bookedOf = (ctx, account) =>
  (ctx.txOf.get(account.id) || [])
    .filter(tx => tx.status === 'BOOKED')
    .sort((a, b) => (a.booked_at < b.booked_at ? -1 : 1));

/** The balance before the first line, and what is waiting (pending payments), kept once. */
function remember(ctx, account) {
  if (ctx.opening.has(account.id)) return;
  const booked = bookedOf(ctx, account);
  const first = booked[0];
  ctx.opening.set(account.id, first ? round2(Number(first.balance_after) - signed(first)) : 0);
  ctx.waiting.set(account.id, round2(Number(account.balance) - Number(account.available_balance)));
}

/** Balances line by line again; available = balance - pending payments - active holds. */
function rebalance(ctx, account) {
  remember(ctx, account);
  let balance = ctx.opening.get(account.id);
  const booked = bookedOf(ctx, account);
  booked.forEach(tx => {
    balance = round2(balance + signed(tx));
    tx.balance_after = balance;
  });
  const held = (ctx.rows.holds || [])
    .filter(h => h.account_id === account.id && h.status === 'ACTIVE')
    .reduce((sum, h) => sum + Number(h.amount), 0);
  Object.assign(account, {
    balance,
    available_balance: round2(balance - ctx.waiting.get(account.id) - held),
    last_activity_at: booked.length
      ? booked[booked.length - 1].booked_at
      : account.last_activity_at,
  });
}

/** What the account can give from `date` on without going past its overdraft limit. */
function spendable(ctx, account, date, overdraft = true) {
  remember(ctx, account);
  const when = iso(date);
  const booked = bookedOf(ctx, account);
  const before = booked.filter(tx => tx.booked_at < when);
  let lowest = before.length
    ? Number(before[before.length - 1].balance_after)
    : ctx.opening.get(account.id);
  booked
    .filter(tx => tx.booked_at >= when)
    .forEach(tx => {
      lowest = Math.min(lowest, Number(tx.balance_after));
    });

  return round2(lowest + (overdraft ? Number(account.overdraft_limit || 0) : 0));
}

/** An internal movement (a refund, a loan payout or repayment), booked at `date`. */
function post(ctx, account, date, direction, amount, description, category = 'REFUNDS') {
  remember(ctx, account);
  const tx = transactionRow(account, {
    rail: 'INTERNAL',
    direction,
    amount: round2(amount),
    category,
    description,
    created_at: iso(date),
    booked_at: iso(date),
    value_date: isoDate(date),
  });
  ctx.rows.transactions.push(tx);
  ctx.txOf.get(account.id).push(tx);
  ctx.txById?.set(tx.id, tx);
  rebalance(ctx, account);

  return tx;
}

export { businessDays, ledger, post, rebalance, spendable };

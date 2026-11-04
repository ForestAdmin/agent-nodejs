/**
 * The desks' history: half a year of the work the Alerts, Investigations, MLRO, Disputes and
 * Payments desks decided, so their weekly charts (desk-charts.ts) draw a curve and their KPIs say
 * something true. What onboarding-funnel.ts did for the Onboarding desk.
 *
 * - Alerts: 9 to 12 everyday alerts cleared each week on top of the stories', raised by their
 *   rule on a real payment (a card purchase far above the usual basket, money in and out within
 *   48 hours, a month's income above twice the declared one): card purchases cleared the same
 *   day, AML patterns 4 hours to 3 days later; two thirds false positives. The note says what the
 *   lines show (desk-history-stories.ts).
 * - Investigations: 2 to 3 decided each week, 10 to 40 days after they opened, from an alert, a
 *   referral or (rarely) the press. Each books its story's lines on the customer's statement and
 *   its summary is written from them. About a third end in a SAR, at least one each month:
 *   drafted, sent to the MLRO, filed 1 to 8 working days later, acknowledged and answered by
 *   TRACFIN. The SAR rule holds: the customer's accounts are frozen from the filing to TRACFIN's
 *   answer (a customer with a quiet window and no declined payments is picked); the customer turns
 *   high risk, an event-driven KYC review opens, the freeze and its release go in their history.
 * - Disputes: 5 to 8 a week, routed by the disputes desk: a chargeback (only an unauthorised
 *   payment is credited at once; others are credited when won, with a steady monthly win rate),
 *   the merchant first, declined for the bank's own reasons, or a SEPA refund.
 * - Payments: high-value transfers decided on working days by the payments team, booked when
 *   validated; a call back on the risky ones, one in eight tried twice; 0 to 3 rejected a week
 *   (payee check no match the customer could not confirm, not reached, or denied after rule
 *   ATO-001's alert, then investigated). 1 or 2 recalls received each week for a one-off payment
 *   sent to our customer by mistake, returned once they agree (AM09: the overpaid part).
 *
 * Every decision a person makes falls on a Paris working day, 08:00-19:00, and a last pass moves
 * the other waves' human steps there too. Cases whose decision would come after now are left out:
 * the open queues stay the ones the other waves write. Alerts get their due date from their
 * severity, card fraud within 24 hours (`due_at`), and the references are numbered again in date
 * order. Built last, on a stream of its own (random.ts withStream).
 */
import { toDate, upper } from './banking';
import { context, informationRequest, kycCase, op, trail } from './crime';
import * as S from './desk-history-stories';
import * as D from './disputes';
import { ledger, post, rebalance, spendable } from './ledger';
import {
  DAY,
  NOW,
  addWorkingDays,
  between,
  chance,
  iso,
  isoDate,
  parisMonday,
  parisParts,
  parisTime,
  pick,
  random as rand,
  round2,
  uuid,
  weighted,
  workBefore,
  workMoment,
} from './random';
import { WEEKS } from '../charts/desk-charts';

const { clearanceNote } = S;

const HOUR = 3600 * 1000;
const MINUTE = 60 * 1000;
const at = (date, hours) => new Date(date.getTime() + hours * HOUR);
const later = (a, b) => (a > b ? a : b);
// Nothing decided in the last half hour: a build at the top of the hour sees the same past.
const LATEST = new Date(NOW.getTime() - 30 * MINUTE);
// Disputes start earlier: a chargeback claimed in March is decided in the charts' first months.
const DISPUTE_LEAD_WEEKS = 0;
// When an alert is due, from its severity; card fraud within 24 hours.
const DUE_HOURS = { CRITICAL: 24, HIGH: 72, MEDIUM: 168, LOW: 336 };
const CARD_FRAUD = ['UNUSUAL_CARD_SPEND', 'CARD_TESTING'];
const CARD_FRAUD_HOURS = 24;
const dueHours = a =>
  Math.min(
    DUE_HOURS[a.severity] || DUE_HOURS.MEDIUM,
    CARD_FRAUD.includes(a.alert_type) ? CARD_FRAUD_HOURS : Infinity,
  );
const RULE_CODE = {
  UNUSUAL_CARD_SPEND: 'FRD-002',
  RAPID_MOVEMENT: 'AML-002',
  UNUSUAL_VOLUME: 'AML-003',
  NEW_DEVICE_NEW_PAYEE: 'ATO-001',
};
const TAKEOVER_SUMMARY =
  'Takeover attempt stopped at the call back: a new phone added a payee and asked for the transfer, nothing left the account. Device revoked, access reset with the customer.';
const DENIED_REASON = 'Customer denies making this transfer: account takeover suspected';
const DENIED_NOTE = 'Did not make this transfer, and did not add this payee';
// What support sees on a frozen account: the SAR itself stays confidential (no tipping off).
const COMPLIANCE_HOLD = 'Compliance hold: refer any question to Compliance, give no reason.';

// Ids of every case this module writes.
const HISTORY = {
  alerts: new Set(),
  investigations: new Set(),
  sar_reports: new Set(),
  dispute_requests: new Set(),
  chargebacks: new Set(),
  sepa_disputes: new Set(),
  kyc_cases: new Set(),
};

// ---- working time --------------------------------------------------------------------------------

const isWorking = date => {
  const p = parisParts(date);

  return p.weekday < 5 && p.h >= 8 && p.h < 19;
};

/** A working moment of the week of `monday` (Paris), Monday to Friday 08:00-18:59. */
function workIn(monday) {
  const p = parisParts(monday);

  return parisTime(p.y, p.m, p.d + between(0, 4), between(8, 18), between(0, 59), between(0, 59));
}

/**
 * The next working moment at or after `date`, spread like a team's day: off hours, some time in
 * the next working morning or early afternoon, never in a burst at 08:00.
 */
function nextWork(date) {
  if (isWorking(date)) return new Date(date);
  const p = parisParts(workMoment(date));
  const hour = weighted([
    [8, 22],
    [9, 30],
    [10, 22],
    [11, 12],
    [14, 9],
    [15, 5],
  ]);

  return parisTime(p.y, p.m, p.d, hour, between(hour === 8 ? 10 : 0, 59), between(0, 59));
}

/** The last working moment at or before `date`, in the afternoon of the working day before. */
function prevWork(date) {
  if (isWorking(date)) return new Date(date);
  const p = parisParts(workBefore(date));

  return parisTime(p.y, p.m, p.d, between(13, 18), between(0, 59), between(0, 59));
}

/**
 * Up to `minutes` of the working day before `date` (a working moment), after `floor`: when the
 * day or the floor leaves less room, a moment drawn in what is left (never stuck to the floor).
 */
function shortlyBefore(date, minutes, floor) {
  const p = parisParts(date);
  const dayStart = parisTime(p.y, p.m, p.d, 8);
  const low = Math.max(dayStart.getTime(), floor.getTime());
  const room = date.getTime() - low;
  if (room <= 2000) return new Date(Math.max(floor.getTime() + 1000, date.getTime() - 1000));
  const back = Math.min(minutes * MINUTE, room * (0.2 + 0.7 * rand()));

  return new Date(date.getTime() - Math.max(1000, back));
}

/** A working moment `n` working days before `date`, at a working hour of that day. */
function workingDaysBefore(date, n) {
  const p = parisParts(date);
  let day = p.d;

  for (let left = n; left > 0; ) {
    day -= 1;
    if (parisParts(parisTime(p.y, p.m, day, 12)).weekday < 5) left -= 1;
  }

  return parisTime(p.y, p.m, day, between(9, 18), between(0, 59), between(0, 59));
}

/** Monday 00:00 (Paris) of week `k`: 0 is WEEKS weeks ago, WEEKS this week. */
function mondayOf(k) {
  const p = parisParts(parisMonday(NOW));

  return parisTime(p.y, p.m, p.d + 7 * (k - WEEKS), 0);
}

/** The share of this week's working time gone by (1 for a past week). */
function weekShare(monday) {
  const end = new Date(monday.getTime() + 5 * DAY);
  if (end <= NOW) return 1;

  return Math.max(0, Math.min(1, (NOW.getTime() - monday) / (5 * DAY)));
}

/** `n` decision moments of the week, in order, none after LATEST (this week: its days so far). */
function momentsOf(monday, n) {
  const list = [];

  for (let tries = 0; list.length < n && tries < 20 * n; tries += 1) {
    const moment = workIn(monday);
    if (moment <= LATEST) list.push(moment);
  }

  return list.sort((a, b) => a - b);
}

const shuffle = list => {
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }

  return list;
};

const median = values => {
  const sorted = [...values].sort((a, b) => a - b);

  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
};

// ---- who can carry a new case --------------------------------------------------------------------

/**
 * Customers already in a story or a case (any alert, investigation, dispute, hold, closure, seizure,
 * insolvency, estate), not active, or with an account that is not: never given a history case, so
 * every story keeps its own customers.
 */
function busyCustomers(ctx) {
  const { rows } = ctx;
  const busy = new Set(ctx.stories ? [...ctx.stories.keys()] : []);
  const add = list => list.forEach(r => r.customer_id && busy.add(r.customer_id));
  [
    rows.alerts,
    rows.investigations,
    rows.sar_reports,
    rows.dispute_requests,
    rows.chargebacks,
    rows.sepa_disputes,
    rows.complaints,
    rows.closures,
    rows.authority_requests,
    rows.collection_cases,
    rows.deceased_cases || [],
    rows.insolvency_proceedings || [],
  ].forEach(add);
  const owner = new Map(rows.accounts.map(a => [a.id, a.customer_id]));
  rows.holds.forEach(h => busy.add(owner.get(h.account_id)));
  rows.accounts.filter(a => a.status !== 'ACTIVE').forEach(a => busy.add(a.customer_id));
  rows.transactions
    // A card payment waiting to clear is everyday life; a held payment or a transfer waiting is a case.
    .filter(t => t.status === 'HELD' || (t.status === 'PENDING' && t.rail === 'TRANSFER'))
    .forEach(t => busy.add(owner.get(t.account_id)));
  rows.customers.filter(c => c.status !== 'ACTIVE').forEach(c => busy.add(c.id));

  return busy;
}

/** Booked lines per account, oldest first; and each customer's own payments out, by time. */
function statements(ctx) {
  const { rows } = ctx;
  const linesOf = new Map();
  rows.transactions
    .filter(t => t.status === 'BOOKED')
    .forEach(t => {
      if (!linesOf.has(t.account_id)) linesOf.set(t.account_id, []);
      linesOf.get(t.account_id).push(t);
    });
  linesOf.forEach(list => list.sort((a, b) => (a.created_at < b.created_at ? -1 : 1)));
  const debitsOf = new Map();
  rows.transactions
    .filter(t => t.direction === 'DEBIT' && !['FEE', 'INTERNAL'].includes(t.rail))
    .filter(t => t.status !== 'REJECTED')
    .forEach(t => {
      const customer = ctx.accounts.get(t.account_id).customer_id;
      if (!debitsOf.has(customer)) debitsOf.set(customer, []);
      debitsOf.get(customer).push(toDate(t.created_at).getTime());
    });
  debitsOf.forEach(list => list.sort((a, b) => a - b));
  Object.assign(ctx, { linesOf, debitsOf });
}

/** The customer's first payment out after `date` (ms), or Infinity. */
function nextDebit(ctx, customerId, date) {
  const list = ctx.debitsOf.get(customerId) || [];
  let [low, high] = [0, list.length];

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (list[mid] <= date.getTime()) low = mid + 1;
    else high = mid;
  }

  return low < list.length ? list[low] : Infinity;
}

const currentAccount = (ctx, customerId) =>
  (ctx.accountsOf.get(customerId) || []).find(a => a.type === 'CURRENT' && a.status === 'ACTIVE');

// ---- what the rules see: the payments that set them off ------------------------------------------

/**
 * Every payment of an available customer that one of the everyday rules flags: a card purchase
 * above five times the usual basket (FRD-002), money in then 80% of it out within 48 hours
 * (AML-002), a month's income above twice the declared one (AML-003). Indexed by day.
 */
/** FRD-002: card purchases above four times the account’s usual basket (150 EUR at least). */
function cardSpend(ctx, base, lines) {
  const cards = lines.filter(
    t => t.rail === 'CARD' && t.direction === 'DEBIT' && ctx.cardOf.get(t.id)?.type === 'PURCHASE',
  );
  if (cards.length < 10) return [];
  const usual = median(cards.map(t => Number(t.amount)));

  return cards
    .filter(t => Number(t.amount) > Math.max(150, 4 * usual))
    .map(t => ({
      ...base,
      type: 'UNUSUAL_CARD_SPEND',
      tx: t,
      lines: [t],
      at: new Date(toDate(t.created_at).getTime() + between(1, 15) * MINUTE),
    }));
}

/** AML-002: money in, then 80% of it out within 48 hours (the debit that crosses sets it off). */
function rapidMovement(base, lines) {
  const debits = lines.filter(t => t.direction === 'DEBIT');
  const events = [];
  lines
    .filter(
      t =>
        t.direction === 'CREDIT' &&
        ['TRANSFER', 'WERO', 'WALLET'].includes(t.rail) &&
        Number(t.amount) >= 800,
    )
    .forEach(credit => {
      const start = toDate(credit.created_at).getTime();
      const out = debits.filter(d => {
        const time = toDate(d.created_at).getTime();

        return time >= start && time <= start + 48 * HOUR;
      });
      let sum = 0;
      const crossing = out.findIndex(d => {
        sum += Number(d.amount);

        return sum >= 0.8 * Number(credit.amount);
      });
      if (crossing < 0) return;
      const d = out[crossing];
      events.push({
        ...base,
        type: 'RAPID_MOVEMENT',
        tx: d,
        lines: [d, credit, ...out.slice(0, crossing).slice(-3)],
        at: new Date(toDate(d.created_at).getTime() + between(5, 90) * MINUTE),
      });
    });

  return events;
}

/** AML-003: a calendar month's money in above twice the declared income (3,000 EUR at least). */
function unusualVolume(base, lines) {
  const ceiling = Math.max(3000, 2 * Number(base.customer.expected_monthly_in));
  const months = new Map();
  const events = [];
  lines
    .filter(t => t.direction === 'CREDIT')
    .forEach(t => {
      const key = t.created_at.slice(0, 7);
      const month = months.get(key) || { sum: 0, list: [], hit: false };
      month.sum += Number(t.amount);
      month.list.push(t);
      months.set(key, month);
      if (month.hit || month.sum <= ceiling) return;
      month.hit = true;
      const top = month.list.slice().sort((x, y) => y.amount - x.amount);
      events.push({
        ...base,
        type: 'UNUSUAL_VOLUME',
        tx: t,
        lines: [t, ...top.filter(x => x !== t).slice(0, 3)],
        at: new Date(toDate(t.created_at).getTime() + between(2, 20) * HOUR),
      });
    });

  return events;
}

function triggers(ctx) {
  const events = [];
  ctx.rows.accounts
    .filter(a => a.type === 'CURRENT' && a.status === 'ACTIVE')
    .forEach(account => {
      const customer = ctx.customers.get(account.customer_id);
      if (ctx.busy.has(customer.id)) return;
      const lines = ctx.linesOf.get(account.id) || [];
      const base = { customer, account };
      events.push(
        ...cardSpend(ctx, base, lines),
        ...rapidMovement(base, lines),
        ...unusualVolume(base, lines),
      );
    });
  const byDay = new Map();
  events.forEach(e => {
    const day = Math.floor(e.at.getTime() / DAY);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(e);
  });
  ctx.triggersByDay = byDay;
}

/** A customer can take another alert: at most two, a month apart, and not in another case. */
function alertable(ctx, customerId, date) {
  if (ctx.taken.has(customerId)) return false;
  const times = ctx.alertTimes.get(customerId) || [];

  return times.length < 2 && times.every(t => Math.abs(t - date.getTime()) > 30 * DAY);
}

/** The flagged payments raised between `from` and `to`, of customers who can take an alert. */
function triggersIn(ctx, from, to, keep: (e) => boolean = () => true) {
  const list = [];

  for (let day = Math.floor(from / DAY); day <= Math.floor(to / DAY); day += 1) {
    (ctx.triggersByDay.get(day) || []).forEach(e => {
      if (e.at > from && e.at < to && !e.used && keep(e) && alertable(ctx, e.customer.id, e.at)) {
        list.push(e);
      }
    });
  }

  return list;
}

/** The flagged payment closest to `target` in the window, AML first with probability `aml`. */
function pickTrigger(ctx, from, to, target, { aml = 0.4, keep }: Record<string, any> = {}) {
  const found = triggersIn(ctx, from, to, keep);
  if (!found.length) return null;
  const amlOnes = found.filter(e => e.type !== 'UNUSUAL_CARD_SPEND');
  const pool = amlOnes.length && chance(aml) ? amlOnes : found;
  const best = pool.reduce((a, b) => (Math.abs(a.at - target) <= Math.abs(b.at - target) ? a : b));
  best.used = true;
  if (!ctx.alertTimes.has(best.customer.id)) ctx.alertTimes.set(best.customer.id, []);
  ctx.alertTimes.get(best.customer.id).push(best.at.getTime());

  return best;
}

// ---- alerts --------------------------------------------------------------------------------------

/** An alert raised by its rule on a flagged payment, then cleared or escalated by an analyst. */
function historyAlert(ctx, trigger, { decided, status, clearance }: Record<string, any>) {
  const rule = ctx.rulesByCode.get(RULE_CODE[trigger.type]);
  const reviewer = op('l1');
  const score =
    status === 'ESCALATED'
      ? round2(70 + rand() * 24)
      : round2(32 + rand() * 40 + (chance(0.05) ? 25 : 0));
  const triggered = trigger.at;
  const cleared = status === 'CLEARED';
  const notes = cleared ? clearanceNote(ctx, trigger, clearance) : 'Escalated to an investigation.';
  const row = {
    id: uuid(),
    reference: null,
    alert_type: trigger.type,
    category: rule.category,
    rule_id: rule.id,
    source: 'RULE',
    created_by: 'system',
    customer_id: trigger.customer.id,
    login_event_id: null,
    investigation_id: null,
    severity: score >= 90 ? 'CRITICAL' : rule.default_severity,
    score,
    status,
    triggered_at: iso(triggered),
    assigned_to: reviewer,
    reviewed_by: reviewer,
    escalated_at: cleared ? null : iso(decided),
    resolved_at: cleared ? iso(decided) : null,
    clearance_reason: cleared ? clearance : null,
    resolution_notes: notes,
    device_checked_at: null,
    called_at: null,
    call_outcome: null,
  };
  ctx.rows.alerts.push(row);
  HISTORY.alerts.add(row.id);
  trigger.lines
    .filter(tx => toDate(tx.created_at) <= triggered)
    .forEach((tx, k) =>
      ctx.rows.alert_transactions.push({
        alert_id: row.id,
        transaction_id: tx.id,
        role: k === 0 ? 'TRIGGER' : 'CONTEXT',
      }),
    );
  trail(ctx.rows, 'ALERTS', row, [
    ['OPEN', triggered, 'system', rule.code],
    ['IN_REVIEW', shortlyBefore(decided, between(5, 50), triggered), reviewer],
    [status, decided, reviewer, notes],
  ]);

  return row;
}

/** Hours from an AML trigger to its decision: most the same or the next day, a few up to three days. */
const clearHours = () =>
  weighted([
    [[4, 8], 35],
    [[8, 24], 35],
    [[24, 48], 20],
    [[48, 72], 10],
  ]).reduce((low, high) => low + rand() * (high - low));

/** Paris calendar day of a moment, as YYYY-M-D. */
const parisDay = date => {
  const p = parisParts(date);

  return `${p.y}-${p.m}-${p.d}`;
};

/**
 * A card purchase the customer confirms is cleared the day it is flagged, or the next working
 * morning when it was flagged after hours: within its 24 hours.
 */
const sameDayClear = (flagged, decided) =>
  decided - flagged < 20 * HOUR &&
  (parisDay(flagged) === parisDay(decided) ||
    (!isWorking(flagged) && parisDay(nextWork(flagged)) === parisDay(decided)));

/**
 * Everyday alerts cleared each week: 9 to 12, this week so far too. Card purchases (about 40%) the
 * same day, AML patterns 4 hours to 3 days after the rule fired.
 */
function alertHistory(ctx) {
  for (let k = 0; k <= WEEKS; k += 1) {
    const monday = mondayOf(k);
    const n = Math.round(between(9, 12) * weekShare(monday));
    momentsOf(monday, n).forEach(decided => {
      const card = () =>
        pickTrigger(ctx, at(decided, -19).getTime(), at(decided, -0.3).getTime(), at(decided, -3), {
          aml: 0,
          keep: e => e.type === 'UNUSUAL_CARD_SPEND' && sameDayClear(e.at, decided),
        });
      const aml = () =>
        pickTrigger(
          ctx,
          at(decided, -72).getTime(),
          at(decided, -4).getTime(),
          at(decided, -clearHours()),
          { aml: 1, keep: e => e.type !== 'UNUSUAL_CARD_SPEND' },
        );
      // About 40% card purchases; when none fits the moment, the other kind.
      const trigger = chance(0.4) ? card() || aml() : aml() || card();
      if (!trigger) return;
      const clearance = weighted([
        ['FALSE_POSITIVE', 67],
        ['EXPLAINED_BY_PROFILE', 25],
      ]);
      historyAlert(ctx, trigger, { decided, status: 'CLEARED', clearance });
    });
  }
}

/** Cleared alerts written before this history keep their decision on a working day. */
function clearOnWorkingDays(ctx) {
  const { rows } = ctx;
  const linesOf = new Map();
  rows.status_changes
    .filter(c => c.record_type === 'ALERTS')
    .forEach(c => {
      if (!linesOf.has(c.record_id)) linesOf.set(c.record_id, []);
      linesOf.get(c.record_id).push(c);
    });
  rows.alerts
    .filter(a => a.status === 'CLEARED' && a.resolved_at && !HISTORY.alerts.has(a.id))
    .forEach(a => {
      const was = toDate(a.resolved_at);
      if (isWorking(was)) return;
      let now = nextWork(was);
      if (now > LATEST) now = prevWork(was);
      const triggered = toDate(a.triggered_at);
      if (now <= triggered) return;
      a.resolved_at = iso(now);
      const lines = linesOf.get(a.id) || [];
      lines
        .filter(c => c.new_value === 'CLEARED')
        .forEach(c => Object.assign(c, { changed_at: iso(now) }));
      lines
        .filter(
          c =>
            c.new_value === 'IN_REVIEW' &&
            (toDate(c.changed_at) > now || !isWorking(toDate(c.changed_at))),
        )
        .forEach(c =>
          Object.assign(c, { changed_at: iso(shortlyBefore(now, between(5, 40), triggered)) }),
        );
      // A quality review of that decision moves with it.
      const shift = now.getTime() - was.getTime();
      rows.qa_reviews
        .filter(q => q.alert_id === a.id)
        .forEach(q => {
          ['sampled_at', 'reviewed_at'].forEach(f => {
            if (!q[f]) return;
            const moved = new Date(Math.min(toDate(q[f]).getTime() + shift, LATEST.getTime()));
            q[f] = iso(later(moved, at(now, 1)));
          });
        });
    });
}

/** Every alert's due date, from its severity; card fraud within 24 hours. */
function dueDates(rows) {
  rows.alerts.forEach(a => {
    a.due_at = iso(at(toDate(a.triggered_at), dueHours(a)));
  });
}

// ---- investigations and SARs ---------------------------------------------------------------------

/**
 * When TRACFIN answers a SAR filed on `filed`: 6 to 20 days later, before the customer's next
 * payment out (the accounts were frozen until then). Null when no quiet window fits: the case is
 * then no SAR. `waiting` lets the answer fall after now (frozen today).
 */
function tracfinAnswer(ctx, customerId, filed, waiting) {
  const next = nextDebit(ctx, customerId, filed);
  const planned = nextWork(at(filed, between(6, 20) * 24));
  if (next === Infinity) return planned;
  const answered = prevWork(new Date(Math.min(planned.getTime(), next - 2 * HOUR)));
  if (answered.getTime() - filed < 5 * DAY) return null;
  if (answered > LATEST && !waiting) return null;

  return answered;
}

/** A SAR still waiting for TRACFIN: every open account frozen, the cards blocked (crime.ts rule). */
function freezeForTracfin(ctx, report) {
  const accounts = ctx.rows.accounts.filter(
    a => a.customer_id === report.customer_id && ['ACTIVE', 'DORMANT'].includes(a.status),
  );
  accounts.forEach(a =>
    Object.assign(a, {
      status: 'FROZEN',
      frozen_at: report.filed_at,
      freeze_reason: 'SAR_FILED',
      freeze_note: COMPLIANCE_HOLD,
    }),
  );
  const ids = new Set(accounts.map(a => a.id));
  ctx.rows.cards
    .filter(c => ids.has(c.account_id) && ['ACTIVE', 'PENDING'].includes(c.status))
    .forEach(c =>
      Object.assign(c, {
        status: 'BLOCKED',
        blocked_reason: 'AML_FREEZE',
        blocked_at: report.filed_at,
      }),
    );
}

function sarRow(ctx, inv, lines, { drafted, filed, answered, story }) {
  const dates = lines.map(tx => tx.created_at.slice(0, 10)).sort();
  const total = round2(lines.reduce((s, tx) => s + Number(tx.amount), 0));
  // TRACFIN's portal acknowledges a day or a few later, at its own hour.
  let acknowledged = nextWork(at(filed, between(1, 5) * 24 + between(-4, 4) + rand()));

  // Never after TRACFIN's answer: then somewhere between the filing and the answer.
  if (acknowledged >= answered) {
    acknowledged = new Date(filed.getTime() + (answered - filed) * (0.2 + 0.4 * rand()));
  }

  const ack = acknowledged <= LATEST;
  const done = answered <= LATEST;
  let status = 'SUBMITTED';
  if (ack) status = 'ACKNOWLEDGED';
  if (done) status = 'ANSWERED';
  const mlro = inv.decided_by;
  const row = {
    id: uuid(),
    reference: null,
    customer_id: inv.customer_id,
    investigation_id: inv.id,
    activity_type: story.alertType,
    activity_start_date: dates[0],
    activity_end_date: dates[dates.length - 1],
    total_amount: total,
    transaction_count: lines.length,
    currency: 'EUR',
    narrative: `${story.summary} ${lines.length} transactions between ${S.day(
      lines[0].created_at,
    )} and ${S.day(lines[lines.length - 1].created_at)}, ${S.euros(total)} in total.`,
    status,
    created_at: iso(drafted),
    filed_at: iso(filed),
    filed_by: mlro,
    fiu_reference: ack
      ? `TRACFIN-${acknowledged.getUTCFullYear()}-${between(100000, 999999)}`
      : null,
    acknowledged_at: ack ? iso(acknowledged) : null,
    tracfin_answer: done ? 'RELEASE_ACCOUNTS' : null,
    tracfin_answered_at: done ? iso(answered) : null,
    tracfin_note: done ? 'No objection: the accounts can be released.' : null,
    updated_at: iso(done ? answered : (ack && acknowledged) || filed),
  };
  ctx.rows.sar_reports.push(row);
  HISTORY.sar_reports.add(row.id);
  const steps = [
    ['DRAFT', drafted, inv.assigned_to],
    ['SUBMITTED', filed, mlro],
  ];
  if (ack) steps.push(['ACKNOWLEDGED', acknowledged, 'TRACFIN']);
  if (done) steps.push(['ANSWERED', answered, mlro, 'TRACFIN: release the accounts']);
  trail(ctx.rows, 'SAR_REPORTS', row, steps);
  if (!done) freezeForTracfin(ctx, row);

  return row;
}

/**
 * An investigation decided on `decided`, opened `days` before: its lines, history and, for a SAR,
 * the report. `alert` (escalated) is its origin when given.
 */
function historyInvestigation(
  ctx,
  {
    customer,
    type,
    origin,
    opened,
    decided,
    decision,
    lines,
    alert,
    sar,
    summary,
    story = null,
  }: Record<string, any>,
) {
  const owner = op('l2');
  const mlro = op('mlro');
  const started = shortlyBefore(nextWork(at(opened, 0.5 + rand() * 3.5)), 0, opened);
  const toMlro = sar ? sar.toMlro : null;
  const row = {
    id: uuid(),
    reference: null,
    customer_id: customer.id,
    type,
    origin,
    origin_kyc_case_id: null,
    origin_authority_request_id: null,
    status: 'CLOSED',
    assigned_to: owner,
    opened_at: iso(opened),
    due_at: iso(at(opened, 30 * 24)),
    summary,
    decision,
    decided_by: decision === 'SAR_FILED' ? mlro : owner,
    decided_at: iso(decided),
    sent_to_mlro_at: toMlro ? iso(toMlro) : null,
    amount_involved: round2(lines.reduce((s, tx) => s + Number(tx.amount), 0)) || null,
    priority:
      decision === 'SAR_FILED'
        ? 'HIGH'
        : weighted([
            ['LOW', 3],
            ['MEDIUM', 5],
            ['HIGH', 1],
          ]),
  };
  ctx.rows.investigations.push(row);
  HISTORY.investigations.add(row.id);
  ctx.taken.add(customer.id);
  if (alert) alert.investigation_id = row.id;
  lines.forEach(tx =>
    ctx.rows.investigation_transactions.push({
      investigation_id: row.id,
      transaction_id: tx.id,
      included_in_sar: decision === 'SAR_FILED',
      note: story ? story.notes(tx) : 'The transfer the customer says they never made',
      added_by: owner,
      added_at: iso(nextWork(at(started, rand() * 48))),
    }),
  );
  const steps = [
    ['OPEN', opened, owner],
    ['IN_PROGRESS', started, owner],
  ];
  if (toMlro) steps.push(['PENDING_MLRO', toMlro, owner]);
  steps.push(['CLOSED', decided, row.decided_by, decision]);
  trail(ctx.rows, 'INVESTIGATIONS', row, steps);

  if (sar) {
    sarRow(ctx, row, lines, {
      drafted: sar.drafted,
      filed: decided,
      answered: sar.answered,
      story,
    });
  }

  // The lines added later than the decision would read wrong: none after it.
  ctx.rows.investigation_transactions
    .filter(x => x.investigation_id === row.id && toDate(x.added_at) > decided)
    .forEach(x => Object.assign(x, { added_at: iso(started) }));

  return row;
}

/** The SAR's dates before the filing: sent to the MLRO 1 to 8 working days before, drafted then. */
function sarDates(ctx, customerId, opened, decided, waiting) {
  const answered = tracfinAnswer(ctx, customerId, decided, waiting);
  if (!answered) return null;
  const toMlro = workingDaysBefore(decided, between(1, 8));
  const earliest = at(opened, 24);
  if (toMlro <= earliest || toMlro >= decided) return null;
  const drafted = shortlyBefore(toMlro, between(60, 300), earliest);

  return { answered, toMlro, drafted };
}

/** Hours a story takes from its first line to the last, at most (desk-history-stories.ts). */
const STORY_SPAN = {
  strangersAbroad: 150,
  passThroughAbroad: 80,
  noSource: 340,
  carSale: 1,
  inheritance: 1,
  wedding: 100,
  flatDeposit: 45,
};

/**
 * Retail customers who can carry a history case whose story starts at `start`: free, an account
 * opened two months before, a phone in use, no KYC case open (the review a SAR opens would clash),
 * and for a SAR no run of declined payments around it (a quiet window must be a quiet customer).
 */
function caseCustomers(ctx, start, sar) {
  return ctx.rows.customers.filter(c => {
    if (c.customer_type !== 'RETAIL' || ctx.busy.has(c.id) || ctx.taken.has(c.id)) return false;
    if (sar && ctx.openKyc.has(c.id)) return false;
    const account = currentAccount(ctx, c.id);
    if (!account || toDate(account.opened_at) > at(start, -60 * 24)) return false;
    const person = ctx.holderOf(c);
    if (!person || !S.deviceOf(ctx, person.id, at(start, -12))) return false;
    if (!sar) return true;
    const declined = (ctx.declinesOf.get(c.id) || []).filter(
      t => t > start - 30 * DAY && t < start,
    );

    return declined.length <= 1;
  });
}

/**
 * Who referred a case: the relationship manager where the customer has one, otherwise support,
 * card operations or the onboarding team. The press, rarely.
 */
function referralNote(customer, press, decision) {
  if (press) {
    return decision === 'SAR_FILED'
      ? 'Adverse media: a press article names the customer in a fraud inquiry.'
      : 'Adverse media: an article names a person of the same name in a fraud inquiry; a namesake (another date of birth).';
  }

  if (customer.relationship_manager) {
    const name = customer.relationship_manager
      .split('@')[0]
      .split('.')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

    return `Referral from the relationship manager, ${name}: the account’s activity no longer matched what the customer declared.`;
  }

  return pick([
    'Referral from customer support, after the customer called about money received.',
    'Referral from card operations, who saw the account’s activity change while reviewing a card limit.',
    'Referral from the onboarding team, who saw these movements while updating the customer’s documents.',
  ]);
}

/** The alert the story's rule raised on its last line, escalated when the case opened. */
function storyAlert(ctx, told, story, opened) {
  const flagged = toDate(told.trigger.created_at);
  const triggered = new Date(flagged.getTime() + between(5, 90) * MINUTE);
  const trigger = {
    type: told.alertType,
    customer: story.customer,
    account: story.account,
    tx: told.trigger,
    lines: [told.trigger, ...told.lines.filter(t => t !== told.trigger)],
    at: triggered,
  };

  return historyAlert(ctx, trigger, { decided: opened, status: 'ESCALATED' });
}

/**
 * A customer for the story `name` of a case opened on `opened`, and when the story starts: null
 * when the statements leave no room before the opening, or nobody fits. For a SAR, the customer's
 * quiet window holds the freeze: nothing paid nor declined from the filing to TRACFIN's answer.
 */
function storyCustomer(ctx, name, { opened, decided, sar, waiting, fromAlert }) {
  // An alert fires a few hours to two days after the story's last line; a referral comes later.
  const room = (opened - ctx.statementStart) / HOUR - 48 - STORY_SPAN[name];
  const gap = Math.min(fromAlert ? between(8, 50) : between(3, 20) * 24, room);
  if (gap < (fromAlert ? 6 : 48)) return null;
  const start = at(opened, -(STORY_SPAN[name] + gap));
  let sarPlan = null;

  const quiet = c => {
    sarPlan = sarDates(ctx, c.id, opened, decided, waiting);
    if (!sarPlan) return false;
    const until = Math.min(sarPlan.answered.getTime(), NOW.getTime());

    return !(ctx.declinesOf.get(c.id) || []).some(t => t > decided.getTime() - DAY && t < until);
  };

  const customer = shuffle(caseCustomers(ctx, start, sar)).find(c => !sar || quiet(c));

  return customer ? { customer, start, sarPlan } : null;
}

/**
 * One investigation decided on `decided`, opened `days` before: a story picked for the decision
 * (SAR or not), a customer free for it, its lines booked, then the alert or the referral that
 * opened the case, and the summary written from the lines.
 */
function investigationOf(ctx, { decided, days, sar, waiting }) {
  // Off hours, the opening moves inside the 10 to 40 days: earlier for a short case, later for a long one.
  const opened = (days < 25 ? prevWork : nextWork)(at(decided, -days * 24));
  const fromAlert = chance(0.55);
  const press = !fromAlert && chance(0.08);
  const plan = { opened, decided, sar, waiting, fromAlert };
  let found = null;
  const name = shuffle([...(sar ? S.SAR_STORIES : S.CLEAR_STORIES)]).find(n => {
    found = storyCustomer(ctx, n, plan);

    return Boolean(found);
  });
  if (!name) return null;
  const { customer, start, sarPlan } = found;
  const story = {
    customer,
    account: currentAccount(ctx, customer.id),
    person: ctx.holderOf(customer),
  };
  const told = S.tellStory(ctx, name, story, start);
  rebalance(ctx, story.account);
  const decision = sar ? 'SAR_FILED' : 'NO_SAR';
  const origin = (fromAlert && 'ALERTS') || (press ? 'ADVERSE_MEDIA' : 'INTERNAL_REFERRAL');

  return historyInvestigation(ctx, {
    customer,
    type: 'AML',
    origin,
    opened,
    decided,
    decision,
    lines: told.lines,
    alert: fromAlert && storyAlert(ctx, told, story, opened),
    sar: sar ? sarPlan : null,
    story: told,
    summary: [
      fromAlert ? null : referralNote(customer, press, decision),
      told.summary,
      sar ? 'Reported to TRACFIN.' : 'No suspicion.',
    ]
      .filter(Boolean)
      .join(' '),
  });
}

function plannedInvestigation(ctx, plan) {
  const inv = investigationOf(ctx, plan);

  return inv || (plan.sar ? investigationOf(ctx, { ...plan, sar: false }) : null);
}

/**
 * 2 to 3 investigations decided each week, 10 to 40 days after they opened. About a third of the
 * money-laundering ones end in a SAR, and every month of the charts files at least one (this one
 * too, its SAR maybe still waiting for TRACFIN).
 */
function investigationHistory(ctx) {
  const plan = [];

  for (let k = 0; k <= WEEKS; k += 1) {
    const monday = mondayOf(k);
    const n = Math.round(between(2, 3) * weekShare(monday));
    momentsOf(monday, n).forEach(decided => plan.push({ decided, sar: chance(0.3) }));
  }

  // Every month gets a SAR: its first planned case asks for one if none does.
  const monthOf = d => {
    const p = parisParts(d);

    return `${p.y}-${p.m}`;
  };

  const thisMonth = monthOf(NOW);
  [...new Set(plan.map(c => monthOf(c.decided)))].forEach(month => {
    const cases = plan.filter(c => monthOf(c.decided) === month);
    if (!cases.some(c => c.sar)) cases[0].sar = true;
  });
  const filed = new Set();
  plan.forEach(c => {
    const month = monthOf(c.decided);
    // Nothing to investigate before the statements start: early cases opened after them.
    // Its story needs a few days of statement before the case opens.
    const room = Math.floor((c.decided - ctx.statementStart) / DAY) - 6;
    const days = Math.min(between(10, 40), room);
    if (days < 10) return;
    // A month with no SAR yet tries again with the next case, and this month may keep it waiting.
    const sar = c.sar || !filed.has(month);
    const inv = plannedInvestigation(ctx, {
      decided: c.decided,
      days,
      sar,
      waiting: month === thisMonth && !filed.has(month),
    });
    if (inv?.decision === 'SAR_FILED') filed.add(month);
  });
}

// ---- payments: high-value transfers, call backs, rejections ----------------------------------------

/** A phone the attacker added: first seen just before the payee, revoked when the fraud team acts. */
function attackerDevice(ctx, person, firstSeen, revoked) {
  const row = {
    id: uuid(),
    individual_id: person.id,
    fingerprint: Array.from({ length: 32 }, () => between(0, 15).toString(16)).join(''),
    platform: 'ANDROID',
    device_name: pick(['Samsung Galaxy A14', 'Xiaomi Redmi 12', 'Oppo A78']),
    app_version: `7.${between(10, 14)}.${between(0, 5)}`,
    first_seen_at: iso(firstSeen),
    last_seen_at: iso(at(firstSeen, 0.5)),
    is_trusted: false,
    revoked_at: iso(revoked),
  };
  ctx.rows.devices.push(row);

  return row;
}

/** Every transaction id another row points to: such a payment keeps its booking. */
function referencedTransactions(rows) {
  const seen = new Set();
  Object.entries(rows).forEach(([table, list]) => {
    if (
      [
        'transactions',
        'outgoing_transfers',
        'incoming_transfers',
        'card_transactions',
        'direct_debits',
        'wero_payments',
        'wallet_transfers',
      ].includes(table) ||
      !Array.isArray(list) ||
      !list.length
    ) {
      return;
    }

    const keys = Object.keys(list[0]).filter(k => k.endsWith('transaction_id'));
    if (!keys.length) return;
    list.forEach(r => keys.forEach(k => r[k] && seen.add(r[k])));
  });

  return seen;
}

const callLine = (ctx, transfer, when, by, result, reason) =>
  ctx.rows.status_changes.push({
    id: uuid(),
    record_type: 'OUTGOING_TRANSFERS',
    record_id: transfer.id,
    field: 'call_back',
    old_value: null,
    new_value: result,
    changed_by: by,
    changed_at: iso(when),
    reason,
  });

const euros = n => `${Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2 })} EUR`;

/** Booked no more: the money stays on the account, the line reads rejected. */
function unbook(ctx, o, tx, reason) {
  Object.assign(tx, {
    status: 'REJECTED',
    status_reason: `Transfer rejected: ${reason}`,
    booked_at: null,
    value_date: null,
    balance_after: null,
  });
  Object.assign(o, { validation_status: 'REJECTED', rejection_reason: reason });
  ctx.rejectedCustomers.add(ctx.accounts.get(tx.account_id).customer_id);
}

const ON_FILE = 'call to the number on file';
const nameOf = (ctx, tx) => ctx.parties.get(tx.counterparty_id)?.name || 'the payee';

/** The call lines of a transfer, replaced by `calls`: [[when, result, what was said]]. */
function setCalls(ctx, o, calls) {
  const rows = ctx.rows.status_changes;

  for (let i = rows.length - 1; i >= 0; i -= 1) {
    if (rows[i].record_id === o.id && rows[i].field === 'call_back') rows.splice(i, 1);
  }

  calls.forEach(([when, result, said]) =>
    callLine(ctx, o, when, o.validated_by, result, `${said} · ${ON_FILE}`),
  );
  const [lastAt, lastResult] = calls[calls.length - 1];
  Object.assign(o, { callback_at: iso(lastAt), callback_result: lastResult });
}

/**
 * The payee check found the account in another name: the payments team calls first. The customer
 * confirms the transfer but cannot confirm the IBAN (it came in an email), so it is rejected.
 */
function payeeMismatch(ctx, { o, tx }, reused = false) {
  const payee = ctx.payees.get(o.beneficiary_id);
  const name = nameOf(ctx, tx);
  const requested = toDate(tx.created_at);
  const decided = toDate(o.validated_at);
  const called = shortlyBefore(decided, between(6, 25), requested);
  Object.assign(o, { payee_check: 'NO_MATCH' });
  // A payee paid again later had its IBAN corrected: the later payments match.
  if (payee && !reused) Object.assign(payee, { payee_check: 'NO_MATCH', payee_check_name: null });
  setCalls(ctx, o, [
    [
      called,
      'CONFIRMED',
      `"Confirms asking for it, but got the IBAN of ${name} by email and cannot check it with them"`,
    ],
  ]);
  unbook(
    ctx,
    o,
    tx,
    `Payee check: the account is not in the name of ${name}, and the customer could not confirm the IBAN on the call back. ${
      reused
        ? 'They checked it with the payee and corrected it before paying them again'
        : 'Check it with the payee, on a number you already know, before sending again'
    }`,
  );
}

/**
 * The payee check found the account in another name, and the customer confirmed the IBAN on the
 * call back (the payee's company holds the account, as its invoice shows): validated.
 */
function payeeConfirmed(ctx, { o, tx }) {
  const payee = ctx.payees.get(o.beneficiary_id);
  const name = nameOf(ctx, tx);
  const firm = `${upper(name.split(' ').slice(-1)[0])} CONSEIL`;
  Object.assign(o, { payee_check: 'NO_MATCH' });
  if (payee) Object.assign(payee, { payee_check: 'NO_MATCH', payee_check_name: null });
  const called = shortlyBefore(toDate(o.validated_at), between(6, 25), toDate(tx.created_at));
  setCalls(ctx, o, [
    [
      called,
      'CONFIRMED',
      `"Confirms the IBAN: the account is in the name of ${firm}, ${name}’s company, as on the invoice"`,
    ],
  ]);
}

/** Nobody answered twice: the transfer is rejected, the customer can send it again. */
function notReached(ctx, { o, tx }) {
  const requested = toDate(tx.created_at);
  const decided = toDate(o.validated_at);
  const second = shortlyBefore(decided, between(5, 15), requested);
  const first = shortlyBefore(second, between(45, 120), requested);
  setCalls(ctx, o, [
    [first, 'NOT_REACHED', 'No answer, voicemail left'],
    [second, 'NOT_REACHED', 'No answer on the second try'],
  ]);
  unbook(
    ctx,
    o,
    tx,
    'Call back: the customer could not be reached (two calls). They can send the transfer again',
  );
}

/**
 * Rule ATO-001 saw a new phone add a payee and ask for a transfer: an alert at once, the transfer
 * sent to the payments team's call back. The customer denies it: rejected, the alert escalated by
 * the fraud team and investigated (closed 10 to 20 days later).
 */
function deniedTransfer(ctx, { o, tx }) {
  const account = ctx.accounts.get(tx.account_id);
  const customer = ctx.customers.get(account.customer_id);
  const person = ctx.people.get(tx.initiated_by_id) || ctx.holderOf(customer);
  const payee = ctx.payees.get(o.beneficiary_id);

  if (!person || !payee) {
    payeeMismatch(ctx, { o, tx });

    return;
  }

  const requested = toDate(tx.created_at);
  const decided = toDate(o.validated_at);
  const called = shortlyBefore(decided, between(4, 20), requested);
  setCalls(ctx, o, [[called, 'DENIED', `"${DENIED_NOTE}"`]]);
  // The payee and the request came from a phone the customer never had.
  const added = new Date(requested.getTime() - between(5, 30) * MINUTE);
  const firstSeen = new Date(added.getTime() - between(15, 90) * MINUTE);
  const triggered = new Date(requested.getTime() + between(20, 140) * 1000);
  const escalated = nextWork(at(decided, 0.3 + rand() * 2));
  const device = attackerDevice(ctx, person, firstSeen, escalated);
  Object.assign(tx, { device_id: device.id, initiated_by_id: person.id });
  Object.assign(payee, {
    added_from_device_id: device.id,
    added_at: iso(added),
    is_trusted: false,
  });
  unbook(ctx, o, tx, DENIED_REASON);
  ctx.taken.add(customer.id);
  const rule = ctx.rulesByCode.get(RULE_CODE.NEW_DEVICE_NEW_PAYEE);
  const reviewer = op('l1');
  const raised = `${rule.code}: new device and new payee, transfer sent to call back`;
  const alert = {
    id: uuid(),
    reference: null,
    alert_type: 'NEW_DEVICE_NEW_PAYEE',
    category: rule.category,
    rule_id: rule.id,
    source: 'RULE',
    created_by: 'system',
    customer_id: customer.id,
    login_event_id: null,
    investigation_id: null,
    severity: 'CRITICAL',
    score: round2(90 + rand() * 8),
    status: 'ESCALATED',
    triggered_at: iso(triggered),
    assigned_to: reviewer,
    reviewed_by: reviewer,
    escalated_at: iso(escalated),
    resolved_at: null,
    clearance_reason: null,
    resolution_notes: DENIED_REASON,
    device_checked_at: iso(shortlyBefore(escalated, 15, decided)),
    called_at: iso(called),
    call_outcome: 'DENIED',
  };
  ctx.rows.alerts.push(alert);
  HISTORY.alerts.add(alert.id);
  ctx.rows.alert_transactions.push({ alert_id: alert.id, transaction_id: tx.id, role: 'TRIGGER' });
  trail(ctx.rows, 'ALERTS', alert, [
    ['OPEN', triggered, 'system', raised],
    ['IN_REVIEW', shortlyBefore(escalated, between(10, 40), decided), reviewer],
    ['ESCALATED', escalated, reviewer, 'Escalated to an investigation.'],
  ]);
  const closed = nextWork(at(escalated, between(10, 20) * 24));
  historyInvestigation(ctx, {
    customer,
    type: 'ACCOUNT_TAKEOVER',
    origin: 'ALERTS',
    opened: escalated,
    decided: closed > LATEST ? prevWork(LATEST) : closed,
    decision: 'NO_SAR',
    lines: [tx],
    alert,
    summary: TAKEOVER_SUMMARY,
  });
}

/** One rejection, of a kind its transfer allows. */
function reject(ctx, item, { uses, firstUse }) {
  Object.assign(item.o, { done: true });
  const old = NOW.getTime() - toDate(item.o.validated_at).getTime() > 25 * DAY;
  const once = uses.get(item.o.beneficiary_id) === 1;
  const kind = weighted([
    ['denied', old && once ? 30 : 0],
    ['payee', firstUse.has(item.o.id) ? 45 : 0],
    ['reach', 25],
  ]);
  if (kind === 'denied') deniedTransfer(ctx, item);
  else if (kind === 'payee') payeeMismatch(ctx, item, !once);
  else notReached(ctx, item);
}

/**
 * 0 to 3 rejections a week, among the transfers called back: the customer could not confirm an
 * IBAN the payee check did not match (a new payee; one paid again later had its IBAN corrected),
 * could not be reached twice, or denied the transfer (a payee used once, rule ATO-001, then an
 * investigation that closes 10 to 20 days later, so only older ones). Now and then a payee check
 * that did not match is confirmed on the call and validated (a payee used once).
 */
function rejections(ctx, decided, { uses, firstUse }) {
  const referenced = referencedTransactions(ctx.rows);
  const eligible = decided.filter(
    ({ o, tx }) =>
      tx.status === 'BOOKED' &&
      o.callback_at &&
      !referenced.has(tx.id) &&
      !ctx.taken.has(ctx.accounts.get(tx.account_id).customer_id) &&
      !ctx.busy.has(ctx.accounts.get(tx.account_id).customer_id),
  );

  for (let k = 0; k <= WEEKS; k += 1) {
    const monday = mondayOf(k);
    const share = weekShare(monday);
    const n = Math.round(
      weighted([
        [0, 20],
        [1, 35],
        [2, 30],
        [3, 15],
      ]) * share,
    );
    const inWeek = shuffle(
      eligible.filter(
        ({ o }) => parisMonday(toDate(o.validated_at)).getTime() === monday.getTime() && !o.done,
      ),
    );
    inWeek.slice(0, n).forEach(item => reject(ctx, item, { uses, firstUse }));
    const confirmed = inWeek
      .slice(n)
      .find(({ o }) => !o.done && uses.get(o.beneficiary_id) === 1 && firstUse.has(o.id));

    if (confirmed && chance(0.3)) {
      Object.assign(confirmed.o, { done: true });
      payeeConfirmed(ctx, confirmed);
    }
  }

  decided.forEach(({ o }) => delete o.done);
}

/**
 * Decided high-value transfers: on a working day, by the payments team, booked once validated; a
 * call back where the payee is new or the payee check was not a clean match, one in eight not
 * answered at first and tried again; 0 to 3 rejected a week.
 */
function transferHistory(ctx) {
  const { rows } = ctx;
  const decided = rows.outgoing_transfers
    .filter(o => o.validation_status === 'APPROVED')
    .map(o => ({ o, tx: ctx.txById.get(o.transaction_id) }))
    // A closing payout goes with its closure (workingHoursPass).
    .filter(({ tx }) => tx && !tx.description.startsWith('VIR SEPA CLOTURE'))
    .sort((a, b) => (a.tx.created_at < b.tx.created_at ? -1 : 1));
  const uses = new Map();
  rows.outgoing_transfers.forEach(o =>
    uses.set(o.beneficiary_id, (uses.get(o.beneficiary_id) || 0) + 1),
  );
  const firstUse = new Set();
  const seenPayee = new Set();
  decided.forEach(({ o }) => {
    if (!seenPayee.has(o.beneficiary_id)) firstUse.add(o.id);
    seenPayee.add(o.beneficiary_id);
  });
  const touched = new Set();
  decided.forEach(({ o, tx }) => {
    const account = ctx.accounts.get(tx.account_id);
    if (!touched.has(account.id)) rebalance(ctx, account);
    touched.add(account.id);
    const requested = toDate(tx.created_at);
    let validated = toDate(o.validated_at);

    // A request sent after hours waits for the morning: the team clears that queue first.
    if (!isWorking(validated)) {
      validated = new Date(workMoment(validated).getTime() + rand() * 2 * HOUR);
    }

    if (validated > LATEST) validated = toDate(o.validated_at);
    const booked = new Date(validated.getTime() + between(1, 3) * MINUTE);
    Object.assign(o, { validated_at: iso(validated), validated_by: op('payments') });

    // Validated, then refused at execution for want of money: nothing to book.
    if (tx.status === 'BOOKED') {
      Object.assign(tx, { booked_at: iso(booked), value_date: isoDate(booked) });
    }

    const risky = firstUse.has(o.id) || ['CLOSE_MATCH', 'NOT_POSSIBLE'].includes(o.payee_check);
    if (!risky) return;
    const payee = nameOf(ctx, tx);
    const said = `"Confirms the ${euros(tx.amount)} to ${payee}"`;
    const called = shortlyBefore(validated, between(4, 25), requested);
    // One call in eight finds nobody at first: a voicemail, then a second call that gets through.
    const retry = chance(0.125) && called.getTime() - requested.getTime() > 90 * MINUTE;
    const calls = retry
      ? [
          [
            shortlyBefore(called, between(40, 120), requested),
            'NOT_REACHED',
            'No answer, voicemail left',
          ],
          [called, 'CONFIRMED', said],
        ]
      : [[called, 'CONFIRMED', said]];
    setCalls(ctx, o, calls);
  });
  rejections(ctx, decided, { uses, firstUse });
  touched.forEach(id => rebalance(ctx, ctx.accounts.get(id)));
}

// ---- disputes ----------------------------------------------------------------------------------------

const ROUTE_MIX = [
  ['CHARGEBACK', 45],
  ['CONTACT_MERCHANT', 25],
  ['DECLINED', 15],
  ['SEPA_DISPUTE', 15],
];
const MERCHANT_FIRST =
  'Asked the customer to contact the merchant first; they can come back after 15 days.';

/**
 * Why the disputes desk (the issuer) declines a claim: its own reasons, from its own records, not
 * the merchant's evidence (which only comes once a chargeback is filed).
 */
function declineNote(tx, reason, requested) {
  const paid = toDate(tx.created_at);
  const shortDay = d => S.day(d);

  if (reason === 'DUPLICATE_CHARGE') {
    return `Only one payment of this order on the account: the other line was a pre-authorisation, released on ${shortDay(
      at(paid, 30 + rand() * 40),
    )}.`;
  }

  if (reason === 'CANCELLED_ORDER' || reason === 'CANCELLED_RECURRING') {
    return `The customer’s own cancellation email is dated ${shortDay(
      at(paid, 24 + rand() * 72),
    )}, after the payment it should have stopped: a late cancellation is no ground for a chargeback.`;
  }

  if (reason === 'ITEM_NOT_RECEIVED') {
    return `Too early: the delivery date the merchant gave (${shortDay(
      at(requested, between(3, 12) * 24),
    )}) has not passed; the customer can come back after it.`;
  }

  if (reason === 'WRONG_AMOUNT' && Number(tx.amount) < 50) {
    return 'Below the 50 EUR the bank requires for a chargeback on a price difference: the customer was told to ask the merchant.';
  }

  if (reason === 'WRONG_AMOUNT') {
    return 'No cardholder evidence: the order confirmation with the lower price, asked for twice, never came.';
  }

  return 'The merchant was not contacted first, and the customer sent no proof of the cancelled service when asked.';
}

/** Card payments customers could dispute, of available retail customers, indexed by day. */
function disputePools(ctx) {
  const usable = tx => {
    const account = ctx.accounts.get(tx.account_id);
    const customer = ctx.customers.get(account.customer_id);

    return (
      account.status === 'ACTIVE' &&
      customer.customer_type === 'RETAIL' &&
      !ctx.busy.has(customer.id) &&
      !ctx.used.has(tx.id) &&
      !ctx.story.has(tx.id)
    );
  };

  const byDay = new Map();

  const index = (map, tx) => {
    const day = Math.floor(toDate(tx.created_at).getTime() / DAY);
    if (!map.has(day)) map.set(day, []);
    map.get(day).push(tx);
  };

  ctx.rows.transactions
    .filter(tx => tx.rail === 'CARD' && tx.status === 'BOOKED' && usable(tx))
    .filter(tx => {
      const card = ctx.cardOf.get(tx.id);

      return (
        card?.type === 'PURCHASE' &&
        ['SETTLED', 'CLEARED'].includes(card.status) &&
        Number(tx.amount) >= 25 &&
        D.ONLINE_SHOPS.includes(tx.category)
      );
    })
    .forEach(tx => index(byDay, tx));
  const debits = new Map();
  ctx.rows.transactions
    .filter(tx => tx.rail === 'DIRECT_DEBIT' && tx.status === 'BOOKED' && usable(tx))
    .filter(tx => {
      const dd = ctx.debitOf.get(tx.id);

      return dd?.status === 'COLLECTED' && dd.mandate_type === 'CORE';
    })
    .forEach(tx => index(debits, tx));
  Object.assign(ctx, { cardsByDay: byDay, debitsByDay: debits });
}

/** A payment of the pool made between `minDays` and `maxDays` before `date`, its customer free. */
function paymentBefore(ctx, byDay, date, minDays, maxDays, keep: (tx) => boolean = () => true) {
  const list = [];
  const from = Math.floor((date - maxDays * DAY) / DAY);
  const to = Math.floor((date - minDays * DAY) / DAY);

  for (let day = from; day <= to; day += 1) {
    (byDay.get(day) || []).forEach(tx => {
      const customer = ctx.accounts.get(tx.account_id).customer_id;
      if (!ctx.used.has(tx.id) && !ctx.taken.has(customer) && keep(tx)) list.push(tx);
    });
  }

  return list.length ? pick(list) : null;
}

/** When a customer asks: in the app any day 07:00-23:00, through support on working hours. */
function claimMoment(monday, channel) {
  const p = parisParts(monday);

  if (['APP', 'WEB'].includes(channel)) {
    return parisTime(p.y, p.m, p.d + between(0, 6), between(7, 22), between(0, 59), between(0, 59));
  }

  return workIn(monday);
}

// How chargebacks end, dealt from a shuffled deck so every month gets the same mix: won without
// a fight, lost once the merchant answered, taken to pre-arbitration (won or lost), withdrawn.
const CHARGEBACK_DECK = [
  ...Array(5).fill('UNCONTESTED'),
  ...Array(3).fill('CONCEDED'),
  ...Array(4).fill('ACCEPTED'),
  ...Array(3).fill('PREARB_WON'),
  ...Array(2).fill('PREARB_LOST'),
  ...Array(3).fill('WITHDRAWN'),
];
const PATH_OUTCOME = {
  UNCONTESTED: 'WON',
  CONCEDED: 'WON',
  ACCEPTED: 'LOST',
  PREARB_WON: 'WON',
  PREARB_LOST: 'LOST',
  WITHDRAWN: 'WITHDRAWN',
};

/** The rounds of a chargeback filed on `presented`, by its path. */
function roundsFor(path, presented, network) {
  const rounds: Record<string, any> = { presented };
  const window = network === 'MASTERCARD' ? 45 : 30;
  if (path === 'UNCONTESTED') rounds.decision = at(presented, (window + between(1, 5)) * 24);
  // The merchant's bank accepts the chargeback early: no answer to wait for.
  if (path === 'CONCEDED') rounds.decision = at(presented, between(6, 20) * 24);
  if (path === 'WITHDRAWN') rounds.decision = at(presented, between(10, 35) * 24);

  if (['ACCEPTED', 'PREARB_WON', 'PREARB_LOST'].includes(path)) {
    rounds.represented = nextWork(at(presented, between(12, 25) * 24 + rand() * 8));
  }

  if (path === 'ACCEPTED') rounds.decision = at(rounds.represented, between(3, 10) * 24);

  if (path.startsWith('PREARB')) {
    rounds.preArbitration = nextWork(addWorkingDays(rounds.represented, between(2, 8)));
    rounds.decision = at(presented, between(60, 90) * 24);
  }

  rounds.decision = nextWork(at(rounds.decision, rand() * 6 - 3));

  return rounds;
}

const monthKey = date => {
  const p = parisParts(date);

  return `${p.y}-${p.m}`;
};

/** Won and lost chargebacks per month of decision, those of the other waves to start with. */
function decidedByMonth(ctx) {
  if (!ctx.cbMonths) {
    ctx.cbMonths = new Map();
    ctx.rows.chargebacks
      .filter(c => c.decision_at && ['WON', 'LOST'].includes(c.status))
      .forEach(c => {
        const key = monthKey(toDate(c.decision_at));
        const m = ctx.cbMonths.get(key) || { won: 0, lost: 0 };
        m[c.status === 'WON' ? 'won' : 'lost'] += 1;
        ctx.cbMonths.set(key, m);
      });
  }

  return ctx.cbMonths;
}

/**
 * The path dealt, or the other outcome when the month it would be decided in already won more
 * than 68% or less than 60% of its chargebacks (decided in that same month when a path allows it).
 */
function steadyPath(ctx, dealt, presented, network) {
  const rounds: Record<string, any> = roundsFor(dealt, presented, network);
  const key = monthKey(rounds.decision);
  const m = decidedByMonth(ctx).get(key) || { won: 0, lost: 0 };
  const rate = m.won / Math.max(1, m.won + m.lost);
  const outcome = PATH_OUTCOME[dealt];
  const off =
    m.won + m.lost >= 2 &&
    ((outcome === 'WON' && rate > 0.68) || (outcome === 'LOST' && rate < 0.6));
  if (!off) return [dealt, rounds];
  const swap = outcome === 'WON' ? ['ACCEPTED', 'PREARB_LOST'] : ['CONCEDED', 'UNCONTESTED'];
  const options: [string, any][] = swap.map(p => [p, roundsFor(p, presented, network)]);

  return options.find(([, r]) => monthKey(r.decision) === key) || options[0];
}

/**
 * The chargeback's rounds: filed with the network 1 to 3 working days after routing, then by its
 * path: conceded early by the merchant's bank (won); uncontested, won once the merchant's window
 * closes (Visa 30 days, Mastercard 45); the merchant answers 12 to 25 days after filing and we
 * accept (lost) or go to pre-arbitration, decided 60 to 90 days after filing; withdrawn by the
 * customer within a month. A month already above 68% or below 60% won takes the other outcome, so
 * the monthly win rate holds steady. Where it stands now when the decision is still to come:
 * filed and waiting, or in pre-arbitration (never back in a work queue).
 */
function chargebackPlan(ctx, routed, network) {
  let presented = nextWork(addWorkingDays(routed, between(1, 3)));

  if (presented > LATEST) {
    presented = new Date(Math.min(at(routed, 0.1).getTime(), LATEST.getTime()));
  }

  if (!ctx.cbDeck?.length) ctx.cbDeck = shuffle([...CHARGEBACK_DECK]);
  const [path, rounds] = steadyPath(ctx, ctx.cbDeck.pop(), presented, network);
  const outcome = PATH_OUTCOME[path];

  if (rounds.decision <= LATEST) {
    if (outcome !== 'WITHDRAWN') {
      const months = decidedByMonth(ctx);
      const key = monthKey(rounds.decision);
      const counts = months.get(key) || { won: 0, lost: 0 };
      counts[outcome === 'WON' ? 'won' : 'lost'] += 1;
      months.set(key, counts);
    }

    return { status: outcome, rounds };
  }

  delete rounds.decision;

  if (rounds.preArbitration && rounds.preArbitration <= LATEST) {
    return { status: 'PRE_ARBITRATION', rounds };
  }

  return { status: 'PRESENTED', rounds: { presented } };
}

function historyChargeback(ctx, tx, dispute) {
  const account = ctx.accounts.get(tx.account_id);
  const { network } = ctx.cards.get(ctx.cardOf.get(tx.id).card_id);
  const merchant = ctx.parties.get(tx.counterparty_id)?.name?.toUpperCase() || 'MARCHAND';
  const [code, label] = D.reasonCode(network, dispute.reason);
  const routed = toDate(dispute.routed_at);
  const { status, rounds } = chargebackPlan(ctx, routed, network);
  const cb: Record<string, any> = {
    id: uuid(),
    reference: null,
    customer_id: dispute.customer_id,
    transaction_id: tx.id,
    card_transaction_id: ctx.cardOf.get(tx.id).id,
    dispute_request_id: dispute.id,
    alert_id: null,
    network,
    source: 'CUSTOMER_REQUEST',
    reason_code: code,
    reason_description: label,
    amount: tx.amount,
    currency: 'EUR',
    status,
    assigned_to: dispute.assigned_to,
    processor_dispute_id: `${network === 'VISA' ? 'VROL' : 'MCOM'}-${Array.from(
      { length: 10 },
      () => between(0, 9),
    ).join('')}`,
    created_at: iso(at(routed, 0.02)),
    filed_at: null,
    evidence_submitted_at: null,
    representment_received_at: null,
    representment_reason: null,
    pre_arbitration_filed_at: null,
    decision_at: null,
    provisional_credit_issued: false,
    provisional_credit_transaction_id: null,
    provisional_credit_reversed_at: null,
    resolution_notes: null,
  };
  D.applyRounds(ctx, cb, rounds, dispute.reason);
  cb.evidence_submitted_at = iso(
    shortlyBefore(rounds.presented, between(10, 90), at(routed, 0.02)),
  );
  // Not an unauthorised payment: credited only once won (French practice).
  if (status === 'WON') D.wonRefund(ctx, cb, account, rounds.decision, merchant);
  D.deadline(cb, tx, rounds);
  cb.updated_at = iso(
    [rounds.decision, rounds.preArbitration, rounds.represented, rounds.presented].find(Boolean),
  );
  ctx.rows.chargebacks.push(cb);
  HISTORY.chargebacks.add(cb.id);
  D.chargebackHistory(ctx, cb, rounds);
  if (D.FINAL.includes(status)) D.closeDispute(dispute, rounds.decision, cb.resolution_notes);

  return cb;
}

/** A card dispute and where the desk sent it. */
function cardDispute(ctx, monday, route) {
  const channel = weighted([
    ['APP', 60],
    ['PHONE', 25],
    ['WEB', 10],
    ['EMAIL', 5],
  ]);
  const requested = claimMoment(monday, channel);
  const routed = nextWork(at(requested, 1 + rand() * 47));
  if (routed > LATEST || requested > LATEST) return;
  const reasonsFor = tx => D.cardReasons(ctx, tx).filter(([r]) => r !== 'UNAUTHORIZED');
  const merchantReasons = ['ITEM_NOT_RECEIVED', 'CANCELLED_ORDER', 'SERVICE_NOT_RENDERED'];
  const fits = tx =>
    reasonsFor(tx).some(([r]) => route !== 'CONTACT_MERCHANT' || merchantReasons.includes(r));
  const tx = paymentBefore(ctx, ctx.cardsByDay, requested, 2, 40, fits);
  if (!tx) return;
  const options = reasonsFor(tx).filter(
    ([r]) => route !== 'CONTACT_MERCHANT' || merchantReasons.includes(r),
  );
  const [reason, text] = pick(options);
  const contacted =
    route === 'CHARGEBACK' && !['DUPLICATE_CHARGE'].includes(reason)
      ? iso(at(requested, -between(48, 400)))
      : null;
  const dispute = D.disputeRequest(ctx, tx, {
    reason,
    reason_detail: text,
    channel,
    requested_at: iso(requested),
    merchant_contacted_at: contacted,
  });
  HISTORY.dispute_requests.add(dispute.id);
  ctx.taken.add(dispute.customer_id);
  Object.assign(dispute, {
    status: route === 'CHARGEBACK' ? 'ROUTED' : 'CLOSED',
    route,
    assigned_to: op('disputes'),
    routed_at: iso(routed),
  });
  if (route === 'CONTACT_MERCHANT') D.closeDispute(dispute, routed, MERCHANT_FIRST);
  if (route === 'DECLINED') D.closeDispute(dispute, routed, declineNote(tx, reason, requested));
  if (route === 'CHARGEBACK') historyChargeback(ctx, tx, dispute);
  D.disputeHistory(ctx, dispute, null);
}

/**
 * The collections a mandate took after `tx`, when nothing but their fees points to them: what a
 * revoked mandate never collects. Null when one of them is part of another case.
 */
function laterCollections(ctx, tx, dd) {
  if (!ctx.caseTx) {
    const rows = { ...ctx.rows, fees: [], direct_debits: [] };
    ctx.caseTx = referencedTransactions(rows);
  }

  const after = ctx.rows.direct_debits.filter(
    d =>
      d.mandate_id === dd.mandate_id &&
      d.id !== dd.id &&
      ctx.txById.get(d.transaction_id)?.created_at > tx.created_at,
  );

  return after.some(d => ctx.caseTx.has(d.transaction_id) || ctx.used.has(d.transaction_id))
    ? null
    : after;
}

/** The customer revoked the mandate when they cancelled: no collection after the one refunded. */
function revokeMandate(ctx, tx, dd, after, requested) {
  const { rows } = ctx;
  const gone = new Set(after.map(d => d.transaction_id));
  rows.fees
    .filter(f => gone.has(f.triggered_by_transaction_id))
    .forEach(f => gone.add(f.transaction_id));

  const drop = (list, keep) => {
    for (let i = list.length - 1; i >= 0; i -= 1) if (!keep(list[i])) list.splice(i, 1);
  };

  drop(rows.transactions, t => !gone.has(t.id));
  drop(rows.direct_debits, d => !gone.has(d.transaction_id));
  drop(rows.fees, f => !gone.has(f.transaction_id));
  const account = ctx.accounts.get(tx.account_id);
  drop(ctx.txOf.get(account.id), t => !gone.has(t.id));
  drop(ctx.linesOf.get(account.id) || [], t => !gone.has(t.id));
  gone.forEach(id => {
    ctx.txById.delete(id);
    ctx.used.add(id);
  });
  const mandate = ctx.mandates.get(dd.mandate_id);

  if (mandate) {
    Object.assign(mandate, {
      status: 'REVOKED',
      revoked_at: iso(at(requested, -0.02)),
      last_collection_at: dd.collection_date || tx.created_at.slice(0, 10),
    });
  }

  rebalance(ctx, account);
}

/** Every "I cancelled my contract" refund, the other waves' too: the mandate revoked with it. */
function cancelledMandates(ctx) {
  ctx.rows.dispute_requests
    .filter(d => d.direct_debit_id && /^I cancelled my contract/.test(d.reason_detail || ''))
    .forEach(d => {
      const dd = ctx.rows.direct_debits.find(x => x.id === d.direct_debit_id);
      const tx = dd && ctx.txById.get(dd.transaction_id);
      if (!tx) return;
      const after = laterCollections(ctx, tx, dd);
      if (after) revokeMandate(ctx, tx, dd, after, toDate(d.requested_at));
    });
}

/**
 * A direct debit the customer wants back within 8 weeks: refunded, no questions asked. A customer
 * who cancelled the contract revokes the mandate too, so the creditor collects nothing more.
 */
function debitRefund(ctx, monday) {
  const requested = claimMoment(monday, 'APP');
  const routed = nextWork(at(requested, 1 + rand() * 30));
  const refunded = nextWork(addWorkingDays(routed, between(1, 3)));
  if (refunded > LATEST) return;
  const tx = paymentBefore(ctx, ctx.debitsByDay, requested, 3, 20);
  if (!tx) return;
  const dd = ctx.debitOf.get(tx.id);
  const account = ctx.accounts.get(tx.account_id);
  const creditor = ctx.creditors.get(ctx.mandates.get(dd.mandate_id)?.creditor_id);
  const name = ctx.parties.get(creditor?.counterparty_id)?.name || 'CREANCIER';
  const after = laterCollections(ctx, tx, dd);
  const cancelled = after && chance(0.5);
  const dispute = D.disputeRequest(ctx, tx, {
    ...(cancelled
      ? {
          reason: 'SERVICE_NOT_RENDERED',
          reason_detail: `I cancelled my contract with ${name}, this debit should not have been taken.`,
        }
      : {
          reason: 'WRONG_AMOUNT',
          reason_detail: `${name} took ${Number(tx.amount).toFixed(
            2,
          )} EUR, more than my usual monthly payment.`,
        }),
    channel: 'APP',
    requested_at: iso(requested),
  });
  if (cancelled) revokeMandate(ctx, tx, dd, after, requested);
  HISTORY.dispute_requests.add(dispute.id);
  ctx.taken.add(dispute.customer_id);
  Object.assign(dispute, {
    status: 'ROUTED',
    route: 'SEPA_DISPUTE',
    assigned_to: op('disputes'),
    routed_at: iso(routed),
  });
  const refund = post(
    ctx,
    account,
    refunded,
    'CREDIT',
    tx.amount,
    `REMBOURSEMENT PRLV SEPA ${name.toUpperCase()}`,
  );
  const row = D.sepaDispute(ctx, tx, {
    direct_debit_id: dd.id,
    dispute_request_id: dispute.id,
    scheme: 'SDD_CORE',
    type: 'REFUND',
    side: 'WE_ASKED',
    reason: 'CUSTOMER_REQUEST',
    requested_at: iso(routed),
    status: 'ACCEPTED',
    answered_at: iso(refunded),
    amount_returned: tx.amount,
    return_transaction_id: refund.id,
    other_bank_bic: null,
  });
  HISTORY.sepa_disputes.add(row.id);
  dd.status = 'REFUNDED';
  D.move(ctx, refund, 'REFUND', { sepa: row });
  D.closeDispute(
    dispute,
    refunded,
    `Refunded: within 8 weeks a SEPA Core direct debit refund is unconditional.${
      cancelled ? ' The customer revoked the mandate: nothing more will be collected.' : ''
    }`,
  );
  D.disputeHistory(ctx, dispute, null);
  D.sepaHistory(ctx, row, [
    ['OPEN', routed, row.assigned_to],
    ['ACCEPTED', refunded, 'system', 'Refund within 8 weeks (MD06)'],
  ]);
}

/** 5 to 8 disputes a week, from DISPUTE_LEAD_WEEKS before the charts' window. */
function disputeHistory(ctx) {
  disputePools(ctx);

  for (let k = -DISPUTE_LEAD_WEEKS; k <= WEEKS; k += 1) {
    const monday = mondayOf(k);
    const share = k === WEEKS ? Math.max(0, (NOW.getTime() - monday.getTime()) / (7 * DAY)) : 1;
    const n = Math.round(between(5, 8) * share);

    for (let i = 0; i < n; i += 1) {
      const route = weighted(ROUTE_MIX);
      if (route === 'SEPA_DISPUTE') debitRefund(ctx, monday);
      else cardDispute(ctx, monday, route);
    }
  }
}

// ---- recalls other banks send us ---------------------------------------------------------------------

const RECALL_REASONS = [
  ['WRONG_IBAN', 35, 'REQUEST_FOR_RECALL'],
  ['WRONG_AMOUNT', 25, 'REQUEST_FOR_RECALL'],
  ['DUPLICATE', 25, 'RECALL'],
  ['TECHNICAL', 15, 'RECALL'],
];
// Payers that are not one-off people or clients: card acquirers paying out a shop's takings.
const ACQUIRERS = ['Worldline', 'Stripe Payments Europe', 'Adyen'];

/** What the payer's bank asks, and what the customer answers, by reason and kind of customer. */
function recallWords(reason, { payer, amount, overpaid, business }) {
  const intended = euros(round2(amount - overpaid));
  const asks = {
    WRONG_IBAN: `The bank of ${payer} says the ${euros(
      amount,
    )} transfer you received was meant for someone else. Do you agree that we return it?`,
    WRONG_AMOUNT: `The bank of ${payer} says they sent ${euros(
      amount,
    )} instead of ${intended}. Do you agree that we return the ${euros(overpaid)} difference?`,
    DUPLICATE: `The bank of ${payer} says the ${euros(
      amount,
    )} transfer was sent twice by mistake. Do you agree that we return the second one?`,
    TECHNICAL: `The bank of ${payer} says the ${euros(
      amount,
    )} transfer left by a technical error on their side. Do you agree that we return it?`,
  };
  const yes = {
    WRONG_IBAN: 'Yes: I do not know this payer and did not expect this money, please return it.',
    WRONG_AMOUNT: business
      ? `Yes: our invoice was for ${intended}, return the ${euros(overpaid)} overpaid.`
      : `Yes: we had agreed on ${intended}, return the difference.`,
    DUPLICATE: business
      ? 'Yes: they paid the same invoice twice, return the second payment.'
      : 'Yes: they paid me twice for the same thing, return the second payment.',
    TECHNICAL: 'Yes: I was not expecting a payment from them, please return it.',
  };
  const no = {
    WRONG_IBAN: business
      ? `No: ${payer} is our client, this pays our invoice.`
      : `No: I know ${payer}, they owed me this money.`,
    WRONG_AMOUNT: business
      ? 'No: the amount is what our invoice says.'
      : 'No: that is the price we agreed.',
    DUPLICATE: business
      ? 'No: these are two payments for two different invoices.'
      : 'No: these are two payments for two different things I sold them.',
    TECHNICAL: 'No: this payment was due to me.',
  };

  return { ask: asks[reason], yes: yes[reason], no: no[reason] };
}

/** The customer's answer to a recall: the money sent back, or why it stays. */
function recallAnswer(
  ctx,
  row,
  { account, asked, overpaid, agreed, requested, sent, replied, answered },
) {
  const there = agreed && spendable(ctx, account, answered, false) >= asked;
  row.answered_at = iso(answered);
  row.status = there ? 'ACCEPTED' : 'REFUSED';
  if (agreed) row.customer_consent_at = iso(replied);
  let why = 'No consent from the customer: the funds stay.';

  if (there) {
    const back = post(ctx, account, answered, 'DEBIT', asked, 'RETOUR FONDS RAPPEL SEPA');
    Object.assign(row, { amount_returned: asked, return_transaction_id: back.id });
    D.move(ctx, back, 'RETURN', { sepa: row });
    why = overpaid
      ? `Customer agreed: the ${euros(overpaid)} overpaid returned.`
      : 'Customer agreed: funds returned.';
  } else if (agreed) {
    why = 'Customer agreed, but the funds were already spent: the payer’s bank was told.';
  }

  D.sepaHistory(ctx, row, [
    [
      'OPEN',
      requested,
      'other bank',
      `The payer says the payment was a mistake (${row.reason_code})`,
    ],
    ['WAITING_CUSTOMER', sent, row.assigned_to, 'Customer’s consent asked'],
    [row.status, answered, row.assigned_to, why],
  ]);
}

function recall(ctx, tx, requested) {
  const account = ctx.accounts.get(tx.account_id);
  const customer = ctx.customers.get(account.customer_id);
  const person = ctx.holderOf(customer);
  if (!person) return false;
  const [reason, , type] = weighted(RECALL_REASONS.map(r => [r, r[1]]));
  const sent = nextWork(at(requested, 0.3 + rand() * 3));
  const replied = new Date(sent.getTime() + (2 + rand() * 70) * HOUR);
  const answered = nextWork(at(replied, 0.5 + rand() * 20));
  if (answered > LATEST) return false;
  const agreed = chance(0.7);
  const incoming = ctx.inOf.get(tx.id);
  // AM09: only the part paid too much comes back.
  const overpaid =
    reason === 'WRONG_AMOUNT' ? round2((Number(tx.amount) * between(15, 55)) / 100) : 0;
  const asked = overpaid || Number(tx.amount);
  ctx.used.add(tx.id);
  ctx.taken.add(customer.id);
  const row = D.sepaDispute(ctx, tx, {
    scheme: incoming.scheme === 'SEPA_INSTANT' ? 'SCT_INST' : 'SCT',
    type,
    side: 'WE_ARE_ASKED',
    reason,
    amount: asked,
    requested_at: iso(requested),
    status: 'OPEN',
    other_bank_bic: ctx.emitters.get(incoming.emitter_id)?.bic || null,
  });
  HISTORY.sepa_disputes.add(row.id);
  const words = recallWords(reason, {
    payer: ctx.parties.get(tx.counterparty_id)?.name || 'the payer',
    amount: Number(tx.amount),
    overpaid,
    business: customer.customer_type === 'BUSINESS',
  });
  const owner = { ...row, customer_id: customer.id };
  const rfi = informationRequest(
    ctx,
    owner,
    person,
    sent,
    'ANSWERED',
    'RECALL_CONSENT',
    'SEPA_DISPUTE',
  );
  Object.assign(rfi, {
    questions: words.ask,
    answered_at: iso(replied),
    answer: agreed ? words.yes : words.no,
  });
  ctx.rows.status_changes
    .filter(c => c.record_id === rfi.id && c.new_value === 'ANSWERED')
    .forEach(c => Object.assign(c, { changed_at: iso(replied) }));
  recallAnswer(ctx, row, { account, asked, overpaid, agreed, requested, sent, replied, answered });

  return true;
}

/** One-off payments received by transfer, by day: what a payer's bank may recall. */
function recallPool(ctx) {
  const pool = new Map();
  const payments = new Map();
  ctx.rows.transactions
    .filter(tx => tx.direction === 'CREDIT' && tx.counterparty_id)
    .forEach(tx => {
      const key = `${tx.account_id}|${tx.counterparty_id}`;
      payments.set(key, (payments.get(key) || 0) + 1);
    });
  ctx.rows.transactions
    .filter(tx => tx.rail === 'TRANSFER' && tx.direction === 'CREDIT' && tx.status === 'BOOKED')
    .filter(tx => {
      const inc = ctx.inOf.get(tx.id);
      const account = ctx.accounts.get(tx.account_id);
      const payer = ctx.parties.get(tx.counterparty_id)?.name || '';

      return (
        inc &&
        !inc.purpose_code &&
        tx.category !== 'SALARY' &&
        !ACQUIRERS.includes(payer) &&
        payments.get(`${tx.account_id}|${tx.counterparty_id}`) === 1 &&
        Number(tx.amount) < 5000 &&
        account.status === 'ACTIVE' &&
        !ctx.busy.has(account.customer_id) &&
        !ctx.used.has(tx.id) &&
        !ctx.story.has(tx.id)
      );
    })
    .forEach(tx => {
      const day = Math.floor(toDate(tx.created_at).getTime() / DAY);
      if (!pool.has(day)) pool.set(day, []);
      pool.get(day).push(tx);
    });

  return pool;
}

/**
 * 1 or 2 a week: money sent to our customer by mistake, returned once the customer agrees. Only on
 * a one-off payment: never a salary, an acquirer's payout or a payer who pays the customer often.
 */
function recallHistory(ctx) {
  const pool = recallPool(ctx);

  for (let k = 0; k <= WEEKS; k += 1) {
    const monday = mondayOf(k);
    const n = Math.max(k < WEEKS ? 1 : 0, Math.round(between(1, 2) * weekShare(monday)));

    // A recall that finds no payment to fit, or would be answered after now, tries another moment.
    for (let done = 0, tries = 0; done < n && tries < 8 * n; tries += 1) {
      const [requested] = momentsOf(monday, 1);
      const tx = requested && paymentBefore(ctx, pool, requested, 1, 10);
      if (tx && recall(ctx, tx, requested)) done += 1;
    }
  }
}

// ---- twins: a payment made twice ------------------------------------------------------------------

/** The same payment booked again a little earlier (a double charge, a transfer sent twice). */
function twinLine(ctx, tx, hours) {
  const account = ctx.accounts.get(tx.account_id);
  // The account's very first payment has its twin just after it instead.
  const before = at(toDate(tx.created_at), -hours);
  const when = before > toDate(account.opened_at) ? before : at(toDate(tx.created_at), hours);
  const twin = {
    ...tx,
    id: uuid(),
    created_at: iso(when),
    booked_at: iso(when),
    value_date: isoDate(when),
  };
  ctx.rows.transactions.push(twin);
  ctx.txOf.get(account.id).push(twin);
  ctx.txById.set(twin.id, twin);
  ctx.used.add(twin.id);
  const card = ctx.cardOf.get(tx.id);

  if (card) {
    const copy = {
      ...card,
      id: uuid(),
      transaction_id: twin.id,
      authorization_code: uuid().slice(0, 6).toUpperCase(),
      authorized_at: iso(when),
    };
    ['cleared_at', 'settled_at'].forEach(f => {
      if (card[f]) copy[f] = iso(at(toDate(card[f]), -hours));
    });

    if (card.acquirer_reference_number) {
      copy.acquirer_reference_number = `${card.acquirer_reference_number.slice(0, -4)}${between(
        1000,
        9999,
      )}`;
    }

    ctx.rows.card_transactions.push(copy);
    ctx.cardOf.set(twin.id, copy);
  }

  const incoming = ctx.inOf.get(tx.id);

  if (incoming) {
    const copy = {
      ...incoming,
      id: uuid(),
      transaction_id: twin.id,
      end_to_end_id: `E2E${uuid().replace(/-/g, '').slice(0, 13).toUpperCase()}`,
    };
    ctx.rows.incoming_transfers.push(copy);
    ctx.inOf.set(twin.id, copy);
  }

  rebalance(ctx, account);

  return twin;
}

/** Whether the account shows the same payment again, within three days of `tx`. */
const hasTwin = (ctx, tx) =>
  (ctx.txOf.get(tx.account_id) || []).some(
    t =>
      t.id !== tx.id &&
      t.status === 'BOOKED' &&
      t.direction === tx.direction &&
      t.counterparty_id === tx.counterparty_id &&
      Number(t.amount) === Number(tx.amount) &&
      Math.abs(toDate(tx.created_at).getTime() - toDate(t.created_at).getTime()) < 3 * DAY,
  );

const DUPLICATE_ANSWER = 'Two separate orders, invoices attached';
const AMOUNT_ANSWER = 'Amount matches the price the cardholder accepted at checkout';

/** A double charge the account could not have paid becomes a price higher than shown. */
function wrongAmountInstead(ctx, cb, tx) {
  const dispute = ctx.rows.dispute_requests.find(d => d.id === cb.dispute_request_id);
  const merchant = ctx.parties.get(tx.counterparty_id)?.name || 'The merchant';
  const [code, label] = D.reasonCode(cb.network, 'WRONG_AMOUNT');
  const swap = text =>
    text &&
    text
      .replace(DUPLICATE_ANSWER, AMOUNT_ANSWER)
      .replace(DUPLICATE_ANSWER.toLowerCase(), AMOUNT_ANSWER.toLowerCase());
  Object.assign(cb, {
    reason_code: code,
    reason_description: label,
    representment_reason: swap(cb.representment_reason),
    resolution_notes: swap(cb.resolution_notes),
  });

  if (dispute) {
    Object.assign(dispute, {
      reason: 'WRONG_AMOUNT',
      reason_detail: `${merchant} charged more than the price shown at checkout.`,
      resolution_notes: swap(dispute.resolution_notes),
    });
  }

  ctx.rows.status_changes
    .filter(c => c.record_id === cb.id || c.record_id === dispute?.id)
    .forEach(c => {
      c.reason = c.reason === 'DUPLICATE_CHARGE' ? 'WRONG_AMOUNT' : swap(c.reason);
    });
}

/**
 * A chargeback for a double charge, and a recall of a transfer sent twice, show both lines: the
 * twin goes in just before the one disputed (minutes for a card, hours for a transfer).
 */
function duplicateTwins(ctx) {
  const { rows } = ctx;
  const reasons = new Map(rows.dispute_requests.map(d => [d.id, d.reason]));
  rows.chargebacks
    .filter(c => reasons.get(c.dispute_request_id) === 'DUPLICATE_CHARGE')
    .forEach(c => {
      const tx = ctx.txById.get(c.transaction_id);
      if (!tx || hasTwin(ctx, tx)) return;
      const hours = (2 + rand() * 40) / 60;
      const account = ctx.accounts.get(tx.account_id);

      if (spendable(ctx, account, at(toDate(tx.created_at), -hours)) >= Number(tx.amount)) {
        twinLine(ctx, tx, hours);
      }
      // An account that could not have paid twice was not charged twice: a wrong amount instead.
      else {
        wrongAmountInstead(ctx, c, tx);
      }
    });
  rows.sepa_disputes
    .filter(s => s.reason === 'DUPLICATE' && s.side === 'WE_ARE_ASKED')
    .forEach(s => {
      const tx = ctx.txById.get(s.transaction_id);
      if (tx && !hasTwin(ctx, tx)) twinLine(ctx, tx, 1 + rand() * 30);
    });
}

// ---- after a SAR: risk, review, the freeze on record ------------------------------------------

/** A line of the customer's history about something other than its status. */
const customerLine = (ctx, customer, field, [from, to], when, by, reason) =>
  ctx.rows.status_changes.push({
    id: uuid(),
    record_type: 'CUSTOMERS',
    record_id: customer.id,
    field,
    old_value: from,
    new_value: to,
    changed_by: by,
    changed_at: iso(when),
    reason,
  });

const dateOnly = date => isoDate(date);
const earlierDay = (a, b) => (!a || b < a ? b : a);

/** The event-driven review a SAR opens (L2, 30 days), and the next review brought forward. */
function eventReview(ctx, sar, customer, { opened, before }) {
  const by = op('l2');
  const due = at(opened, 30 * 24);
  const resolved = nextWork(at(opened, between(8, 22) * 24));
  const done = resolved <= LATEST;
  const kyc = kycCase(ctx, customer, {
    type: 'EVENT_REVIEW',
    trigger: 'AML_INVESTIGATION',
    channel: customer.onboarding_channel,
    status: done ? 'APPROVED' : 'IN_REVIEW',
    opened_at: iso(opened),
    due_at: iso(due),
    assigned_to: by,
    decided_by: done ? by : null,
    resolved_at: done ? iso(resolved) : null,
    risk_before: before,
    risk_after: done ? 'HIGH' : null,
    investigation_id: sar.investigation_id,
    notes: done
      ? 'Relationship kept at high risk: yearly reviews, transfers abroad watched.'
      : 'Event review after an AML investigation: source of funds and activity to update.',
  });
  HISTORY.kyc_cases.add(kyc.id);
  const started = nextWork(at(opened, 0.5 + rand() * 20));
  const steps = [
    ['OPEN', opened, 'system', 'Event review after an AML investigation'],
    ['IN_REVIEW', started > LATEST ? at(opened, 0.2) : started, by],
  ];
  if (done) steps.push(['APPROVED', resolved, by, 'Kept at high risk']);
  trail(ctx.rows, 'KYC_CASES', kyc, steps);
  const next = done ? at(resolved, 365 * 24) : due;
  customer.next_review_at = dateOnly(
    earlierDay(customer.next_review_at && new Date(`${customer.next_review_at}T12:00:00Z`), next),
  );
}

/**
 * A SAR filed makes the customer high risk and opens an event-driven KYC review (L2, 30 days),
 * which brings the next review forward: to its due date while it runs, a year after its decision
 * once approved. A customer with a KYC case already open keeps that one.
 */
function sarReview(ctx, sar, customer) {
  const filed = toDate(sar.filed_at);
  const before = customer.risk_rating;

  if (before !== 'HIGH') {
    customer.risk_rating = 'HIGH';
    customerLine(
      ctx,
      customer,
      'risk_rating',
      [before, 'HIGH'],
      at(filed, 0.05 + rand() * 0.3),
      sar.filed_by || op('mlro'),
      'Raised after an AML investigation',
    );
  }

  if (customer.status !== 'ACTIVE') return;
  const busy = ctx.rows.kyc_cases.some(
    k =>
      k.customer_id === customer.id &&
      (!['APPROVED', 'REJECTED'].includes(k.status) ||
        (k.trigger === 'AML_INVESTIGATION' && k.opened_at >= sar.filed_at)),
  );
  const opened = nextWork(at(filed, 2 + rand() * 30));
  if (!busy && opened <= LATEST) eventReview(ctx, sar, customer, { opened, before });
}

/** What a frozen account's declined payments say: the account is frozen. */
const FROZEN_DECLINE = {
  'Card payment declined': 'Card payment declined: account frozen',
  'Cash withdrawal declined': 'Cash withdrawal declined: account frozen',
  'Transfer rejected': 'Transfer rejected: account frozen',
  'Direct debit rejected': 'Direct debit rejected: account frozen',
};

/** A card in use when the freeze came: issued, not expired, not blocked for another reason. */
const inUse = (card, filed, released) =>
  toDate(card.issued_at) < filed &&
  (!card.expires_at || card.expires_at.slice(0, 10) > iso(filed).slice(0, 10)) &&
  (card.status === 'ACTIVE' ||
    card.blocked_reason === 'AML_FREEZE' ||
    (card.blocked_at && toDate(card.blocked_at) > (released || NOW)));

/** Payments declined while the accounts were frozen say so. */
function frozenDeclines(ctx, ids, from, until) {
  ctx.rows.transactions
    .filter(
      t =>
        ids.has(t.account_id) &&
        t.status === 'REJECTED' &&
        t.created_at > from &&
        toDate(t.created_at) < until,
    )
    .forEach(t => {
      const head = Object.keys(FROZEN_DECLINE).find(h => (t.status_reason || '').startsWith(h));
      if (!head) return;
      t.status_reason = FROZEN_DECLINE[head];
      const card = ctx.cardOf.get(t.id);
      if (card) card.decline_reason = 'CARD_BLOCKED';
    });
}

/**
 * The freeze and its release in the customer's history (each account, each card), the neutral
 * words support sees, and the payments declined in between saying why.
 */
function freezeTraces(ctx, sar) {
  const filed = toDate(sar.filed_at);
  const released =
    sar.tracfin_answer === 'RELEASE_ACCOUNTS' && sar.tracfin_answered_at
      ? toDate(sar.tracfin_answered_at)
      : null;
  const customer = ctx.customers.get(sar.customer_id);
  const by = sar.filed_by || op('mlro');
  const accounts = ctx.rows.accounts.filter(
    a =>
      a.customer_id === sar.customer_id &&
      toDate(a.opened_at) < filed &&
      (!a.closed_at || toDate(a.closed_at) > filed),
  );
  const ids = new Set(accounts.map(a => a.id));
  const cards = ctx.rows.cards.filter(c => ids.has(c.account_id) && inUse(c, filed, released));
  const freezeAt = at(filed, 0.01 + rand() * 0.05);
  accounts.forEach(a => {
    customerLine(
      ctx,
      customer,
      'account_status',
      ['ACTIVE', 'FROZEN'],
      freezeAt,
      by,
      `Compliance hold on ${a.iban}`,
    );
    if (a.freeze_reason === 'SAR_FILED') a.freeze_note = COMPLIANCE_HOLD;
  });
  cards.forEach(c =>
    customerLine(
      ctx,
      customer,
      'card_status',
      ['ACTIVE', 'BLOCKED'],
      at(freezeAt, 0.002),
      by,
      `Card ending ${c.last_four_digits} blocked with the compliance hold`,
    ),
  );
  frozenDeclines(ctx, ids, sar.filed_at, released || NOW);
  if (!released) return;
  const lift = at(released, 0.02 + rand() * 0.2);
  accounts.forEach(a =>
    customerLine(
      ctx,
      customer,
      'account_status',
      ['FROZEN', 'ACTIVE'],
      lift,
      by,
      `Compliance hold lifted on ${a.iban}`,
    ),
  );
  cards.forEach(c =>
    customerLine(
      ctx,
      customer,
      'card_status',
      ['BLOCKED', 'ACTIVE'],
      at(lift, 0.002),
      by,
      `Card ending ${c.last_four_digits} unblocked`,
    ),
  );
}

/** Every SAR filed, the history's and the stories': its customer's risk, review and freeze. */
function afterSars(ctx) {
  ctx.rows.sar_reports
    .filter(s => s.filed_at)
    .sort((a, b) => (a.filed_at < b.filed_at ? -1 : 1))
    .forEach(sar => {
      const customer = ctx.customers.get(sar.customer_id);
      if (!customer) return;
      sarReview(ctx, sar, customer);
      freezeTraces(ctx, sar);
    });
  // Any SAR freeze, whoever wrote it, reads the same to support.
  ctx.rows.accounts
    .filter(a => a.freeze_reason === 'SAR_FILED')
    .forEach(a => Object.assign(a, { freeze_note: COMPLIANCE_HOLD }));
}

/** Adverse media about a customer makes them medium risk at least. */
function pressRisk(ctx) {
  ctx.rows.investigations
    .filter(i => i.origin === 'ADVERSE_MEDIA')
    .forEach(i => {
      const customer = ctx.customers.get(i.customer_id);
      if (!customer || customer.risk_rating !== 'LOW') return;
      customer.risk_rating = 'MEDIUM';
      customerLine(
        ctx,
        customer,
        'risk_rating',
        ['LOW', 'MEDIUM'],
        at(toDate(i.opened_at), 0.1 + rand()),
        i.assigned_to || op('l2'),
        'Raised after adverse media',
      );
    });
}

/**
 * Cases waiting for the MLRO: sent a few working days ago, due five working days after that
 * (filing without delay), so one or two are a few days late, none two months.
 */
function mlroQueue(ctx) {
  const { rows } = ctx;
  rows.investigations
    .filter(i => i.status === 'PENDING_MLRO')
    .forEach((inv, k) => {
      const sent = toDate(inv.sent_to_mlro_at);
      const ago = k % 2 === 0 ? between(6, 9) : between(1, 3);
      let moved = workingDaysBefore(LATEST, ago);
      if (moved < sent) moved = sent;
      const lines = rows.status_changes.filter(c => c.record_id === inv.id);
      const before = lines
        .filter(c => c.new_value !== 'PENDING_MLRO')
        .reduce((m, c) => (c.changed_at > m ? c.changed_at : m), inv.opened_at);
      if (iso(moved) <= before) moved = nextWork(at(toDate(before), 2));
      inv.sent_to_mlro_at = iso(moved);
      inv.due_at = iso(addWorkingDays(moved, 5));
      lines
        .filter(c => c.new_value === 'PENDING_MLRO')
        .forEach(c => Object.assign(c, { changed_at: iso(moved) }));
      rows.sar_reports
        .filter(s => s.investigation_id === inv.id && s.status === 'DRAFT')
        .forEach(sar => {
          const drafted = shortlyBefore(moved, between(60, 240), toDate(before));
          sar.created_at = iso(drafted);
          sar.updated_at = iso(drafted);
          rows.status_changes
            .filter(c => c.record_id === sar.id && c.new_value === 'DRAFT')
            .forEach(c => Object.assign(c, { changed_at: iso(drafted) }));
        });
    });
}

// ---- last pass: every person's step on a Paris working day ----------------------------------------

const STAFF = '@forest-lab-bank.fr';
// The cases whose steps people take, the history's and the other waves' (stories included).
const PASS_TYPES = [
  'DISPUTE_REQUESTS',
  'CHARGEBACKS',
  'SEPA_DISPUTES',
  'ALERTS',
  'INVESTIGATIONS',
  'SAR_REPORTS',
  'CLOSURES',
];
// Where a step's moment is written again, and moves with it: the dates of the steps themselves
// (never when a case came in), the money a step booked, an account closed or frozen by it.
const PASS_FIELDS = {
  dispute_requests: ['routed_at', 'closed_at'],
  chargebacks: [
    'created_at',
    'filed_at',
    'evidence_submitted_at',
    'pre_arbitration_filed_at',
    'updated_at',
  ],
  sepa_disputes: ['answered_at'],
  alerts: ['escalated_at', 'resolved_at', 'device_checked_at'],
  investigations: ['opened_at', 'decided_at', 'sent_to_mlro_at'],
  sar_reports: ['filed_at', 'updated_at'],
  closures: ['notice_sent_at', 'closed_at'],
  holds: ['placed_at', 'released_at'],
  accounts: ['closed_at', 'frozen_at', 'last_activity_at'],
  outgoing_transfers: ['validated_at', 'callback_at'],
  transactions: ['created_at', 'booked_at'],
};
// The statement lines a person's step books: refunds, money sent back, a closing payout.
const movable = (table, row) =>
  table !== 'transactions' ||
  row.rail === 'INTERNAL' ||
  (row.description || '').startsWith('VIR SEPA CLOTURE');

/** Every place a moment is written, by its text, so a step moves with all its copies. */
function momentIndex(rows) {
  const index = new Map();

  const add = (key, entry) => {
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(entry);
  };

  Object.entries(PASS_FIELDS).forEach(([table, fields]) =>
    (rows[table] || [])
      .filter(row => movable(table, row))
      .forEach(row =>
        fields.forEach(field => {
          if (row[field]) add(row[field], { table, row, field });
        }),
      ),
  );
  rows.status_changes.forEach(row =>
    add(row.changed_at, { table: 'status_changes', row, field: 'changed_at' }),
  );

  return index;
}

/** Moves a moment everywhere it is written; the statements it touched add up again. */
function moveMoment(ctx, index, from, to) {
  const entries = index.get(from) || [];
  const text = iso(to);
  const accounts = new Set();
  entries.forEach(({ table, row, field }) => {
    row[field] = text;

    if (table === 'transactions') {
      if (field === 'booked_at') row.value_date = isoDate(to);
      accounts.add(row.account_id);
    }
  });
  index.delete(from);
  index.set(text, [...(index.get(text) || []), ...entries]);
  accounts.forEach(id => rebalance(ctx, ctx.accounts.get(id)));
}

/**
 * What else a case row ties a moment to: when it came in, the payment it is about, the dispute
 * it follows, the authority's request, the last day a closure notice can leave (two months before
 * its end).
 */
function rowMoments(ctx, row, when) {
  const list = ['requested_at', 'triggered_at', 'received_at']
    .map(f => row[f])
    .filter(v => v && v < when);
  if (row.transaction_id) list.push(ctx.txById.get(row.transaction_id)?.created_at);

  if (row.dispute_request_id) {
    list.push(ctx.rows.dispute_requests.find(d => d.id === row.dispute_request_id)?.routed_at);
  }

  if (row.origin_authority_request_id) {
    list.push(
      ctx.rows.authority_requests.find(r => r.id === row.origin_authority_request_id)?.received_at,
    );
  }

  if (row.notice_end_date && row.notice_sent_at === when) {
    const last = new Date(`${row.notice_end_date}T00:00:00Z`);
    last.setUTCMonth(last.getUTCMonth() - 2);
    list.push(iso(new Date(last.getTime() + DAY - 1000)));
  }

  return list;
}

/**
 * The room a moment has: after every step before it and before every step after it, in each
 * record it is written on (an escalation is also the investigation's opening), and before the
 * cases that follow from a dispute (its chargeback).
 */
function stepBounds(ctx, { linesOf, index }, line, when) {
  const records = new Map([[line.record_id, line.row || null]]);
  (index.get(when) || []).forEach(({ table, row }) => {
    if (table === 'status_changes') records.set(row.record_id, records.get(row.record_id) || null);
    else if (table !== 'transactions') records.set(row.id, row);
  });
  const moments = [];
  (index.get(when) || [])
    .filter(e => e.table === 'transactions')
    .forEach(({ row }) => moments.push(ctx.accounts.get(row.account_id)?.opened_at));
  records.forEach((row, id) => {
    (linesOf.get(id) || []).forEach(c => moments.push(c.changed_at));
    (ctx.qaOf.get(id) || []).forEach(q => moments.push(q.sampled_at, q.reviewed_at));
    [...ctx.rows.chargebacks, ...ctx.rows.sepa_disputes]
      .filter(r => r.dispute_request_id === id && r.created_at > when)
      .forEach(r => moments.push(r.created_at));
    if (row) moments.push(...rowMoments(ctx, row, when));
  });
  const known = moments.filter(m => m && m !== when);
  const before = known.filter(m => m < when).map(m => toDate(m).getTime());
  const after = known.filter(m => m > when).map(m => toDate(m).getTime());

  return {
    low: before.length ? Math.max(...before) : -Infinity,
    high: Math.min(LATEST.getTime(), ...after),
  };
}

/**
 * Where an off-hours step can go: the next working moment, the last one before, or else early in
 * the next working morning when the next step follows soon after.
 */
function workingSlot(when, { low, high }) {
  const fits = d => d.getTime() > low && d.getTime() < high;
  const found = [nextWork(when), prevWork(when)].find(fits);
  if (found) return found;
  const p = parisParts(workMoment(when));
  const opens = parisTime(p.y, p.m, p.d, 8).getTime();
  const end = Math.min(high, opens + 11 * HOUR) - 1000;
  const start = Math.max(opens, low + 1000);
  if (end <= start) return null;

  return new Date(start + (end - start) * (0.1 + 0.6 * rand()));
}

// The human steps written on the rows, for the cases whose history leaves some of them out.
const HUMAN_FIELDS: [string, string, string, (r) => any][] = [
  ['dispute_requests', 'DISPUTE_REQUESTS', 'routed_at', r => (r.assigned_to || '').endsWith(STAFF)],
  ['chargebacks', 'CHARGEBACKS', 'filed_at', () => true],
  ['chargebacks', 'CHARGEBACKS', 'pre_arbitration_filed_at', () => true],
  ['sepa_disputes', 'SEPA_DISPUTES', 'answered_at', r => r.side === 'WE_ARE_ASKED'],
  ['alerts', 'ALERTS', 'escalated_at', r => (r.reviewed_by || '').endsWith(STAFF)],
  ['investigations', 'INVESTIGATIONS', 'decided_at', () => true],
];

/** What the pass reads: where each moment is written, each record's steps, its QA reviews. */
function passContext(ctx) {
  const { rows } = ctx;
  ctx.qaOf = new Map();
  rows.qa_reviews.forEach(q =>
    ['kyc_case_id', 'alert_id', 'investigation_id', 'chargeback_id', 'complaint_id']
      .filter(f => q[f])
      .forEach(f => ctx.qaOf.set(q[f], [...(ctx.qaOf.get(q[f]) || []), q])),
  );
  const linesOf = new Map();
  rows.status_changes.forEach(c => {
    if (!linesOf.has(c.record_id)) linesOf.set(c.record_id, []);
    linesOf.get(c.record_id).push(c);
  });

  return { index: momentIndex(rows), linesOf };
}

/** Moves one off-hours moment of a record to a working slot it has room for. */
function toWorkingHours(ctx, pass, line, when) {
  if (isWorking(toDate(when))) return;
  const target = workingSlot(toDate(when), stepBounds(ctx, pass, line, when));
  if (target) moveMoment(ctx, pass.index, when, target);
}

/**
 * Every step a person took off hours (night, weekend) on disputes, chargebacks, recalls, alerts,
 * investigations, SARs and closures moves to the next working moment, or the one before when the
 * next step comes first: with its copies on the row and the money it booked. A large closing payout
 * is a large transfer: validated by the payments team, on a working day too.
 */
function workingHoursPass(ctx) {
  const { rows } = ctx;
  const pass = passContext(ctx);
  rows.outgoing_transfers
    .filter(o => o.validation_status === 'APPROVED')
    .forEach(o => {
      const tx = ctx.txById.get(o.transaction_id);
      if (!tx || !tx.description.startsWith('VIR SEPA CLOTURE')) return;
      o.validated_by = op('payments');
      if (o.validated_at) toWorkingHours(ctx, pass, { record_id: o.id, row: o }, o.validated_at);
    });
  rows.status_changes
    .filter(
      c =>
        PASS_TYPES.includes(c.record_type) &&
        (c.changed_by || '').endsWith(STAFF) &&
        !isWorking(toDate(c.changed_at)),
    )
    // Latest first: a step moved forward makes room for the one before it.
    .sort((a, b) => (a.changed_at < b.changed_at ? 1 : -1))
    .forEach(line => toWorkingHours(ctx, pass, line, line.changed_at));
  HUMAN_FIELDS.forEach(([table, type, field, human]) =>
    rows[table]
      .filter(r => r[field] && human(r) && !isWorking(toDate(r[field])))
      .forEach(r =>
        toWorkingHours(ctx, pass, { record_id: r.id, record_type: type, row: r }, r[field]),
      ),
  );
  // The file sent to the network goes shortly before the filing, on the same working day.
  rows.chargebacks
    .filter(c => c.filed_at && c.evidence_submitted_at)
    .forEach(c => {
      const filed = toDate(c.filed_at);
      const sent = toDate(c.evidence_submitted_at);
      if (isWorking(sent) && sent <= filed) return;
      c.evidence_submitted_at = iso(shortlyBefore(filed, between(10, 90), toDate(c.created_at)));
    });
}

// ---- what the new cases booked, and the references -------------------------------------------------

/** The new cases' rows in dispute_transactions: the payment disputed, then what each booked. */
function listMoves(ctx) {
  const { rows } = ctx;
  const byKey = new Map();

  const add = (transactionId, role, links) => {
    const key = `${transactionId}|${role}`;

    if (!byKey.has(key)) {
      byKey.set(key, {
        id: uuid(),
        transaction_id: transactionId,
        role,
        dispute_request_id: null,
        chargeback_id: null,
        sepa_dispute_id: null,
      });
    }

    Object.entries(links).forEach(([k, v]) => {
      if (v) byKey.get(key)[k] = v;
    });
  };

  rows.dispute_requests
    .filter(d => HISTORY.dispute_requests.has(d.id))
    .forEach(d => add(d.transaction_id, 'DISPUTED', { dispute_request_id: d.id }));
  rows.chargebacks
    .filter(c => HISTORY.chargebacks.has(c.id))
    .forEach(c =>
      add(c.transaction_id, 'DISPUTED', {
        chargeback_id: c.id,
        dispute_request_id: c.dispute_request_id,
      }),
    );
  rows.sepa_disputes
    .filter(s => HISTORY.sepa_disputes.has(s.id))
    .forEach(s =>
      add(s.transaction_id, 'DISPUTED', {
        sepa_dispute_id: s.id,
        dispute_request_id: s.dispute_request_id,
      }),
    );
  ctx.moves.forEach(({ tx, role, dispute, chargeback: cb, sepa }) =>
    add(tx.id, role, {
      dispute_request_id: dispute || cb?.dispute_request_id || sepa?.dispute_request_id,
      chargeback_id: cb?.id,
      sepa_dispute_id: sepa?.id,
    }),
  );
  rows.dispute_transactions.push(...byKey.values());
}

/** PREFIX-YEAR-NUMBER again in date order; the history lines and freeze notes quoting one follow. */
function renumber(rows, list, prefix, dateField) {
  const counters = {};
  const moved = new Map();
  list
    .slice()
    .sort((a, b) => (a[dateField] < b[dateField] ? -1 : 1))
    .forEach(row => {
      const year = row[dateField].slice(0, 4);
      counters[year] = (counters[year] || between(120, 480)) + between(1, 2);
      const reference = `${prefix}-${year}-${String(counters[year]).padStart(6, '0')}`;
      moved.set(row.reference || row.id, reference);
      Object.assign(row, { reference });
    });
  const quoted = new RegExp(`\\b${prefix}-\\d{4}-\\d{6}\\b`, 'g');
  const follow = text => text.replace(quoted, r => moved.get(r) || r);
  rows.status_changes.forEach(c => {
    if (c.reason && c.reason.includes(`${prefix}-`)) Object.assign(c, { reason: follow(c.reason) });
  });
  rows.accounts.forEach(a => {
    if (!a.freeze_note) return;
    let note = follow(a.freeze_note);
    // A freeze written here quotes its SAR by id until the SAR has its number.
    moved.forEach((reference, key) => {
      if (note.includes(key)) note = note.replace(key, reference);
    });
    a.freeze_note = note;
  });
}

/**
 * The ledger's starting point for every account, before anything moves: the balance before the
 * first line, and the payments still waiting (not the holds, which it subtracts on its own).
 */
function primeLedger(ctx) {
  const waiting = new Map();
  ctx.rows.transactions
    .filter(t => t.direction === 'DEBIT' && ['PENDING', 'HELD'].includes(t.status))
    .forEach(t =>
      waiting.set(t.account_id, round2((waiting.get(t.account_id) || 0) + Number(t.amount))),
    );
  ctx.rows.accounts.forEach(account => {
    const first = (ctx.linesOf.get(account.id) || [])
      .slice()
      .sort((a, b) => (a.booked_at < b.booked_at ? -1 : 1))[0];
    const signed = first ? (first.direction === 'CREDIT' ? 1 : -1) * Number(first.amount) : 0;
    ctx.opening.set(account.id, first ? round2(Number(first.balance_after) - signed) : 0);
    ctx.waiting.set(account.id, waiting.get(account.id) || 0);
  });
}

function deskHistory(rows, stories) {
  Object.values(HISTORY).forEach(set => set.clear());
  const ctx: Record<string, any> = context(rows, stories);
  ledger(ctx);
  D.indexes(ctx);
  [rows.dispute_requests, rows.chargebacks, rows.sepa_disputes].forEach(list =>
    list.forEach(r => ctx.used.add(r.transaction_id)),
  );
  Object.assign(ctx, {
    rulesByCode: new Map(rows.rules.map(r => [r.code, r])),
    busy: busyCustomers(ctx),
    taken: new Set(),
    alertTimes: new Map(),
    rejectedCustomers: new Set(),
    openKyc: new Set(
      rows.kyc_cases
        .filter(k => !['APPROVED', 'REJECTED'].includes(k.status))
        .map(k => k.customer_id),
    ),
    declinesOf: new Map(),
  });
  rows.transactions
    .filter(t => t.status === 'REJECTED' && t.direction === 'DEBIT')
    .forEach(t => {
      const customer = ctx.accounts.get(t.account_id).customer_id;
      if (!ctx.declinesOf.has(customer)) ctx.declinesOf.set(customer, []);
      ctx.declinesOf.get(customer).push(toDate(t.created_at).getTime());
    });
  statements(ctx);
  primeLedger(ctx);
  ctx.statementStart = toDate(
    rows.transactions
      .filter(t => t.rail === 'CARD')
      .reduce((a, t) => (t.created_at < a ? t.created_at : a), '9'),
  );
  triggers(ctx);
  investigationHistory(ctx);
  alertHistory(ctx);
  transferHistory(ctx);
  disputeHistory(ctx);
  cancelledMandates(ctx);
  recallHistory(ctx);
  clearOnWorkingDays(ctx);
  workingHoursPass(ctx);
  duplicateTwins(ctx);
  afterSars(ctx);
  pressRisk(ctx);
  mlroQueue(ctx);
  dueDates(rows);
  listMoves(ctx);
  renumber(rows, rows.alerts, 'ALR', 'triggered_at');
  renumber(rows, rows.investigations, 'INV', 'opened_at');
  renumber(rows, rows.sar_reports, 'SAR', 'created_at');
  renumber(rows, rows.dispute_requests, 'DSP', 'requested_at');
  renumber(rows, rows.chargebacks, 'CBK', 'created_at');
  renumber(rows, rows.sepa_disputes, 'SEP', 'requested_at');
  renumber(rows, rows.information_requests, 'RFI', 'created_at');
  renumber(rows, rows.kyc_cases, 'KYC', 'opened_at');

  return ctx;
}

export {
  CARD_FRAUD,
  CARD_FRAUD_HOURS,
  COMPLIANCE_HOLD,
  DUE_HOURS,
  HISTORY,
  PASS_TYPES,
  deskHistory,
};

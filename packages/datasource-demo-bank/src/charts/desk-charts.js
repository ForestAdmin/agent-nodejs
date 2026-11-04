/**
 * Weekly charts for the classic desks, computed by the agent (API charts) and shown by Forest's
 * native line chart (a workspace chart with an `apiRoute`). Native charts cannot divide one count
 * by another, average a duration or count what was open on a past date, hence the agent.
 *
 * Onboarding desk. Both count onboarding cases by the week they were decided (`resolved_at`), so
 * every week is complete: a case still open counts nowhere until its decision, and recent weeks are
 * not pulled down by cases nobody has decided yet.
 * - Lead time: for the onboarding cases approved in a week, the median number of days from the
 *   case being opened (`opened_at`) to its approval (`resolved_at`), one decimal. A median, so the
 *   minutes of the system's approvals and a few long cases leave the weekly line steady.
 * - Approval rate: of the onboarding cases approved or declined in a week, the share approved, in
 *   %. A case closed because the applicant stopped answering (rejection_code NO_RESPONSE) is no
 *   decision on the applicant: left out.
 *
 * Payments desk, over the last HISTORY_WEEKS complete weeks: high-value transfers (validation_status
 * other than NOT_REQUIRED), by the week they were decided (`validated_at`, set on approval and on
 * rejection):
 * - how many were validated, and how many rejected (two lines);
 * - the median working minutes (Monday to Friday, 08:00-19:00) from the customer's request (the
 *   transaction's `created_at`) to the decision: a request sent on Saturday waits for Monday;
 * - recalls other banks sent us: received (`requested_at`) and returned (answered ACCEPTED or
 *   PARTIAL, by `answered_at`).
 *
 * Alerts, Investigations, MLRO and Disputes desks, from the half year desk-history.js writes, over
 * the last HISTORY_WEEKS complete weeks (the statements start 26 weeks ago: the first weeks hold
 * too little to judge a team by) or the last MONTHS complete months and this one once it has a value:
 * - alerts decided (cleared or escalated), the share cleared as false positives, and the median
 *   hours from trigger to clearance, by the week of the decision;
 * - investigations opened and closed (two lines), and the median days the closed ones were open;
 * - SARs filed with TRACFIN, and the median days from draft to filing, by month;
 * - disputes received by route (one line per route, by the week of the claim), chargebacks won of
 *   those won or lost by month (withdrawn ones are no decision), and the median days from the
 *   claim to closing it, chargebacks apart from the other routes (merchant first, declined, SEPA
 *   refunds and recalls, bank refunds: two lines), by the month it closed. By month, since a week
 *   can close no chargeback and Forest would draw that week as 0.
 *
 * Every weekly chart of the Alerts, Investigations, Payments and Disputes desks starts on the same
 * week (HISTORY_WEEKS complete weeks back); the monthly ones on the same month (MONTHS back).
 *
 * Ops overview, the work of every desk: KYC cases, alerts, screening hits, investigations, dispute
 * requests, chargebacks, SEPA recalls other banks send us and high-value transfers to validate
 * (WORK below says when each one arrives and when its desk is done with it):
 * - received: items that arrived in the week;
 * - finished: items their desk finished in the week;
 * - open: items arrived and not finished at the end of the week (Sunday midnight).
 *
 * Weeks are ISO weeks (Monday to Sunday) in the agent's time zone, as the result builder labels
 * them. The onboarding charts show the current week once it has a decision; the others show the
 * last WEEKS complete weeks only (a week half gone would look like a drop). Forest draws a missing
 * value as 0, so every week needs a value. The `*Weeks` functions take plain rows.
 */
const DAY = 24 * 3600 * 1000;
const WEEKS = 26;
const HISTORY_WEEKS = 23;
// Complete months; this month shows too once it has a value.
const MONTHS = 4;
// Decided: an onboarding case approved or declined; a high-value transfer approved or rejected.
const DECIDED = ['APPROVED', 'REJECTED'];

const CHARTS = {
  lead: {
    name: 'kyc_lead_time',
    title: 'Onboarding: median days to approve, by week',
  },
  conversion: {
    name: 'kyc_conversion',
    title: 'Onboarding approval rate, by week (approved vs declined)',
  },
  validatedRejected: {
    name: 'payments_validated_rejected',
    title: 'High-value transfers validated and rejected, by week',
    lines: true,
    history: true,
  },
  validationMinutes: {
    name: 'payments_validation_minutes',
    title: 'High-value transfers: median working minutes from request to decision',
    history: true,
  },
  recalls: {
    name: 'payments_recalls',
    title: 'Recalls from other banks: received and returned, by week',
    lines: true,
    history: true,
  },
  alertsDecided: {
    name: 'alerts_decided',
    title: 'Alerts decided (cleared or escalated), by week',
    history: true,
  },
  falsePositive: {
    name: 'alerts_false_positive',
    title: 'Alerts: % of the week’s decisions cleared as false positives',
    history: true,
  },
  hoursToClear: {
    name: 'alerts_hours_to_clear',
    title: 'Alerts: median hours from trigger to clearance, by week',
    history: true,
  },
  openedClosed: {
    name: 'investigations_opened_closed',
    title: 'Investigations opened and closed, by week',
    history: true,
    lines: true,
  },
  daysOpen: {
    name: 'investigations_days_open',
    title: 'Investigations closed: median days open, by week',
    history: true,
  },
  sarsFiled: {
    name: 'mlro_sars_filed',
    title: 'SARs filed with TRACFIN, by month',
    monthly: true,
  },
  draftToFiling: {
    name: 'mlro_draft_to_filing',
    title: 'SARs: median days from draft to filing, by month',
    monthly: true,
  },
  byRoute: {
    name: 'disputes_by_route',
    title: 'Disputes received, by week and route',
    history: true,
    lines: true,
  },
  winRate: {
    name: 'disputes_win_rate',
    title: 'Chargebacks won, % of those won or lost each month',
    monthly: true,
  },
  daysToResolve: {
    name: 'disputes_days_to_resolve',
    title: 'Disputes: median days from claim to close, by month closed',
    monthly: true,
    lines: true,
  },
  received: { name: 'ops_received', title: 'All desks: work received, by week' },
  finished: { name: 'ops_finished', title: 'All desks: work finished, by week' },
  open: { name: 'ops_open', title: 'All desks: still open at the end of each week' },
};

// The work of each desk for the Ops overview: when an item arrives, when its desk is done with it
// (the first date set), and which rows count. Chargebacks are done when the network decides.
const WORK = [
  { table: 'kyc_cases', arrived: 'opened_at', done: ['resolved_at'] },
  { table: 'alerts', arrived: 'triggered_at', done: ['resolved_at', 'escalated_at'] },
  { table: 'screening_hits', arrived: 'created_at', done: ['reviewed_at'] },
  { table: 'investigations', arrived: 'opened_at', done: ['decided_at'] },
  { table: 'dispute_requests', arrived: 'created_at', done: ['routed_at', 'closed_at'] },
  { table: 'chargebacks', arrived: 'created_at', done: ['decision_at'] },
  {
    table: 'sepa_disputes',
    arrived: 'requested_at',
    done: ['answered_at'],
    where: { field: 'side', operator: 'Equal', value: 'WE_ARE_ASKED' },
  },
  {
    table: 'outgoing_transfers',
    arrived: 'transaction:created_at',
    done: ['validated_at'],
    where: {
      field: 'validation_status',
      operator: 'In',
      value: ['PENDING', 'APPROVED', 'REJECTED'],
    },
  },
];

/** Monday 00:00 of the date's week, local time (luxon's ISO week start). */
function weekStart(value) {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));

  return d;
}

const round1 = x => Math.round(x * 10) / 10;

const median = values => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/** One entry per week of the last WEEKS weeks and this one, oldest first. */
function onboardingWeeks(rows, now = new Date()) {
  const first = weekStart(now);
  first.setDate(first.getDate() - 7 * WEEKS);
  const weeks = [];

  for (let d = new Date(first); d <= now; d.setDate(d.getDate() + 7)) {
    weeks.push({ date: new Date(d), decided: 0, approved: 0, days: [] });
  }

  const at = value => {
    const time = weekStart(value).getTime();

    return weeks.find(w => w.date.getTime() === time);
  };

  rows.forEach(r => {
    const week = DECIDED.includes(r.status) && r.resolved_at && at(r.resolved_at);
    if (!week || r.rejection_code === 'NO_RESPONSE') return;
    week.decided += 1;

    if (r.status === 'APPROVED' && r.opened_at) {
      week.approved += 1;
      week.days.push((new Date(r.resolved_at) - new Date(r.opened_at)) / DAY);
    }
  });

  return weeks.map(w => ({
    date: w.date,
    decided: w.decided,
    approved: w.approved,
    leadDays: w.approved ? round1(median(w.days)) : null,
    conversion: w.decided ? round1((100 * w.approved) / w.decided) : null,
  }));
}

/**
 * Minutes of working time (Monday to Friday, 08:00-19:00, the agent's time zone) between two
 * moments: a request sent on Saturday and validated on Monday at 08:20 waited 20 minutes of the
 * desk's time, not two days.
 */
function workingMinutes(from, to) {
  const start = new Date(from);
  const end = new Date(to);
  let total = 0;

  for (let day = new Date(start.getFullYear(), start.getMonth(), start.getDate()); day < end; ) {
    if (day.getDay() !== 0 && day.getDay() !== 6) {
      const open = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 8);
      const close = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 19);
      const a = Math.max(open, start);
      const b = Math.min(close, end);
      if (b > a) total += (b - a) / 60000;
    }

    day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
  }

  return total;
}

/** Monday 00:00 of each of the last WEEKS complete weeks, oldest first (this week left out). */
function completeWeeks(now = new Date(), count = WEEKS) {
  const first = weekStart(now);
  first.setDate(first.getDate() - 7 * count);

  return Array.from({ length: count }, (_, i) => {
    const d = new Date(first);
    d.setDate(d.getDate() + 7 * i);

    return d;
  });
}

/** The index of a date's week in `weeks` (Monday dates), or -1 outside them. */
const weekIndex = (weeks, value) => {
  if (!value) return -1;
  const time = weekStart(value).getTime();

  return weeks.findIndex(w => w.getTime() === time);
};

/** Payments desk: per complete week, transfers validated and rejected, and the median minutes to
 * the decision. Rows: `{ validated_at, requested_at, status }` of decided high-value transfers. */
function paymentsWeeks(rows, now = new Date()) {
  const dates = completeWeeks(now, HISTORY_WEEKS);
  const weeks = dates.map(date => ({ date, minutes: [], rejected: 0 }));
  rows.forEach(r => {
    const i = weekIndex(dates, r.validated_at);
    if (i < 0 || !r.requested_at) return;
    weeks[i].minutes.push(workingMinutes(r.requested_at, r.validated_at));
    if (r.status === 'REJECTED') weeks[i].rejected += 1;
  });

  return weeks.map(w => ({
    date: w.date,
    decided: w.minutes.length,
    validated: w.minutes.length - w.rejected,
    rejected: w.rejected,
    minutes: w.minutes.length ? round1(median(w.minutes)) : null,
  }));
}

/** Recalls other banks sent us, per complete week: received, and returned (all or part).
 * Rows: `{ requested_at, answered_at, status }`. */
function recallWeeks(rows, now = new Date()) {
  const dates = completeWeeks(now, HISTORY_WEEKS);
  const weeks = dates.map(date => ({ date, received: 0, returned: 0 }));
  rows.forEach(r => {
    const i = weekIndex(dates, r.requested_at);
    if (i >= 0) weeks[i].received += 1;
    const j = weekIndex(dates, r.answered_at);
    if (j >= 0 && ['ACCEPTED', 'PARTIAL'].includes(r.status)) weeks[j].returned += 1;
  });

  return weeks;
}

/** Alerts per complete week of decision: decided, % false positive, median hours to clear.
 * Rows: `{ status, triggered_at, resolved_at, escalated_at, clearance_reason }`. */
function alertWeeks(rows, now = new Date()) {
  const dates = completeWeeks(now, HISTORY_WEEKS);
  const weeks = dates.map(date => ({ date, decided: 0, falsePositives: 0, hours: [] }));
  rows.forEach(r => {
    const cleared = r.status === 'CLEARED';
    if (!cleared && r.status !== 'ESCALATED') return;
    const i = weekIndex(dates, cleared ? r.resolved_at : r.escalated_at);
    if (i < 0) return;
    weeks[i].decided += 1;
    if (!cleared) return;
    if (r.clearance_reason === 'FALSE_POSITIVE') weeks[i].falsePositives += 1;
    weeks[i].hours.push((new Date(r.resolved_at) - new Date(r.triggered_at)) / 3600000);
  });

  return weeks.map(w => ({
    date: w.date,
    decided: w.decided,
    falsePositive: w.decided ? round1((100 * w.falsePositives) / w.decided) : null,
    hoursToClear: w.hours.length ? round1(median(w.hours)) : null,
  }));
}

/** Investigations per complete week: opened, closed, median days the closed ones were open.
 * Rows: `{ opened_at, decided_at }`. */
function investigationWeeks(rows, now = new Date()) {
  const dates = completeWeeks(now, HISTORY_WEEKS);
  const weeks = dates.map(date => ({ date, opened: 0, days: [] }));
  rows.forEach(r => {
    const i = weekIndex(dates, r.opened_at);
    if (i >= 0) weeks[i].opened += 1;
    const j = weekIndex(dates, r.decided_at);
    if (j >= 0) weeks[j].days.push((new Date(r.decided_at) - new Date(r.opened_at)) / DAY);
  });

  return weeks.map(w => ({
    date: w.date,
    opened: w.opened,
    closed: w.days.length,
    daysOpen: w.days.length ? round1(median(w.days)) : null,
  }));
}

/** The 1st of each of the last MONTHS complete months and of this one, local time. */
function lastMonths(now = new Date()) {
  return Array.from(
    { length: MONTHS + 1 },
    (_, i) => new Date(now.getFullYear(), now.getMonth() - MONTHS + i, 1),
  );
}

const monthIndex = (months, value) => {
  if (!value) return -1;
  const d = new Date(value);

  return months.findIndex(
    m => m.getFullYear() === d.getFullYear() && m.getMonth() === d.getMonth(),
  );
};

/** SARs per month of filing: how many, and the median days from draft to filing.
 * Rows: `{ created_at, filed_at }`. */
function sarMonths(rows, now = new Date()) {
  const months = lastMonths(now);
  const list = months.map(date => ({ date, days: [] }));
  rows.forEach(r => {
    const i = monthIndex(months, r.filed_at);
    if (i >= 0) list[i].days.push((new Date(r.filed_at) - new Date(r.created_at)) / DAY);
  });

  return list.map(m => ({
    date: m.date,
    filed: m.days.length,
    draftToFiling: m.days.length ? round1(median(m.days)) : null,
  }));
}

/** Chargebacks per month of the network's decision: % won of those won or lost.
 * Rows: `{ status, decision_at }`. */
function winRateMonths(rows, now = new Date()) {
  const months = lastMonths(now);
  const list = months.map(date => ({ date, won: 0, lost: 0 }));
  rows.forEach(r => {
    const i = monthIndex(months, r.decision_at);
    if (i < 0) return;
    if (r.status === 'WON') list[i].won += 1;
    if (r.status === 'LOST') list[i].lost += 1;
  });

  return list.map(m => ({
    date: m.date,
    decided: m.won + m.lost,
    winRate: m.won + m.lost ? round1((100 * m.won) / (m.won + m.lost)) : null,
  }));
}

// Dispute routes as the chart names them; a claim not routed yet has its own line.
const ROUTE_LABELS = {
  CHARGEBACK: 'Chargeback',
  CONTACT_MERCHANT: 'Merchant first',
  DECLINED: 'Declined',
  SEPA_DISPUTE: 'SEPA refund or recall',
  BANK_REFUND: 'Bank refund',
  NONE: 'Not routed yet',
};

/** Disputes per complete week: received by route (week of the claim).
 * Rows: `{ requested_at, route }`. */
function disputeWeeks(rows, now = new Date()) {
  const dates = completeWeeks(now, HISTORY_WEEKS);
  const weeks = dates.map(date => ({ date, routes: {} }));
  rows.forEach(r => {
    const i = weekIndex(dates, r.requested_at);
    if (i < 0) return;
    const key = r.route || 'NONE';
    weeks[i].routes[key] = (weeks[i].routes[key] || 0) + 1;
  });

  return weeks.map(w => ({
    date: w.date,
    received: Object.values(w.routes).reduce((a, b) => a + b, 0),
    routes: w.routes,
  }));
}

/** Disputes closed per month (the last MONTHS complete months, and this one once both lines have
 * a value): the median days from the claim to closing it, chargebacks apart from the other routes.
 * Rows: `{ requested_at, route, closed_at }`. */
function closeMonths(rows, now = new Date()) {
  const months = lastMonths(now);
  const list = months.map(date => ({ date, chargeback: [], other: [] }));
  rows.forEach(r => {
    const i = monthIndex(months, r.closed_at);
    if (i < 0 || !r.requested_at) return;
    const days = (new Date(r.closed_at) - new Date(r.requested_at)) / DAY;
    list[i][r.route === 'CHARGEBACK' ? 'chargeback' : 'other'].push(days);
  });

  return list
    .map(m => ({
      date: m.date,
      chargebackDays: m.chargeback.length ? round1(median(m.chargeback)) : null,
      otherDays: m.other.length ? round1(median(m.other)) : null,
    }))
    .filter((m, i, all) => i < all.length - 1 || (m.chargebackDays && m.otherDays));
}

/** The lines of a multi-line chart: [label, key] pairs read from each week. */
const linesOf = (weeks, pairs) =>
  pairs.map(([label, key]) => ({ label, values: weeks.map(w => w[key] ?? null) }));

/** One line per route seen in the window, in ROUTE_LABELS order. */
const routeLines = weeks =>
  Object.keys(ROUTE_LABELS)
    .filter(key => weeks.some(w => w.routes[key]))
    .map(key => ({ label: ROUTE_LABELS[key], values: weeks.map(w => w.routes[key] || 0) }));

/** Ops overview: per complete week, items received, finished, and open at the week's end.
 * Items: `{ arrived, done }` (done null while open), from every desk (WORK). */
function overviewWeeks(items, now = new Date()) {
  const dates = completeWeeks(now);

  return dates.map(date => {
    const end = new Date(date);
    end.setDate(end.getDate() + 7);
    const inWeek = v => v && new Date(v) >= date && new Date(v) < end;

    return {
      date,
      received: items.filter(it => inWeek(it.arrived)).length,
      finished: items.filter(it => inWeek(it.done)).length,
      open: items.filter(
        it => it.arrived && new Date(it.arrived) < end && (!it.done || new Date(it.done) >= end),
      ).length,
    };
  });
}

/** One value of a row by path (`transaction:created_at` reads a link's field). */
const valueAt = (row, field) => field.split(':').reduce((value, key) => value?.[key], row);

/** Every desk's items as `{ arrived, done }`, read through Forest's collections. */
async function workItems(dataSource) {
  const lists = await Promise.all(
    WORK.map(async w => {
      const rows = await dataSource
        .getCollection(w.table)
        .list(w.where ? { conditionTree: w.where } : {}, [w.arrived, ...w.done]);

      return rows.map(r => ({
        arrived: valueAt(r, w.arrived) || null,
        done: w.done.map(f => valueAt(r, f)).find(Boolean) || null,
      }));
    }),
  );

  return lists.flat();
}

/** The decided high-value transfers as `{ validated_at, requested_at, status }`. */
async function decidedTransfers(dataSource) {
  const rows = await dataSource
    .getCollection('outgoing_transfers')
    .list({ conditionTree: { field: 'validation_status', operator: 'In', value: DECIDED } }, [
      'validated_at',
      'validation_status',
      'transaction:created_at',
    ]);

  return rows.map(r => ({
    validated_at: r.validated_at,
    requested_at: r.transaction?.created_at,
    status: r.validation_status,
  }));
}

/** Every row of `table` (optionally filtered) with `fields`. */
const rowsOf = (dataSource, table, fields, where) =>
  dataSource.getCollection(table).list(where ? { conditionTree: where } : {}, fields);

/** The points of one series: every past week, and this week once it has a value. */
const seriesOf = (weeks, key) =>
  weeks
    .filter((w, i) => i < weeks.length - 1 || w[key] !== null)
    .map(w => ({ date: w.date, value: w[key] }));

/** The API charts, each served as `/forest/_charts/<name>` (CHARTS). */
function addDeskCharts(customizer) {
  const load = async context => {
    const since = weekStart(new Date(Date.now() - (WEEKS + 1) * 7 * DAY)).toISOString();
    const rows = await context.dataSource.getCollection('kyc_cases').list(
      {
        conditionTree: {
          aggregator: 'And',
          conditions: [
            { field: 'type', operator: 'Equal', value: 'ONBOARDING' },
            { field: 'status', operator: 'In', value: DECIDED },
            { field: 'resolved_at', operator: 'GreaterThan', value: since },
          ],
        },
      },
      ['id', 'opened_at', 'resolved_at', 'status', 'rejection_code'],
    );

    return onboardingWeeks(rows);
  };

  const series = key => async (context, resultBuilder) =>
    resultBuilder.timeBased('Week', seriesOf(await load(context), key));
  customizer.addChart(CHARTS.lead.name, series('leadDays'));
  customizer.addChart(CHARTS.conversion.name, series('conversion'));
  // Complete weeks only: one point per week, every week.
  const weekly = (build, key) => async (context, resultBuilder) =>
    resultBuilder.timeBased(
      'Week',
      (await build(context.dataSource)).map(w => ({ date: w.date, value: w[key] })),
    );

  // Several lines, one point per week (or month) each.
  const multi = (build, range, lines) => async (context, resultBuilder) => {
    const weeks = await build(context.dataSource);

    return resultBuilder.multipleTimeBased(
      range,
      weeks.map(w => w.date),
      typeof lines === 'function' ? lines(weeks) : linesOf(weeks, lines),
    );
  };

  // Complete months, and this one once it has a value (seriesOf).
  const monthly = (build, key) => async (context, resultBuilder) =>
    resultBuilder.timeBased('Month', seriesOf(await build(context.dataSource), key));
  const payments = async dataSource => paymentsWeeks(await decidedTransfers(dataSource));
  const recalls = async dataSource =>
    recallWeeks(
      await rowsOf(dataSource, 'sepa_disputes', ['requested_at', 'answered_at', 'status'], {
        field: 'side',
        operator: 'Equal',
        value: 'WE_ARE_ASKED',
      }),
    );
  const alerts = async dataSource =>
    alertWeeks(
      await rowsOf(dataSource, 'alerts', [
        'status',
        'triggered_at',
        'resolved_at',
        'escalated_at',
        'clearance_reason',
      ]),
    );
  const cases = async dataSource =>
    investigationWeeks(await rowsOf(dataSource, 'investigations', ['opened_at', 'decided_at']));
  const sars = async dataSource =>
    sarMonths(await rowsOf(dataSource, 'sar_reports', ['created_at', 'filed_at']));
  const disputes = async dataSource =>
    disputeWeeks(
      await rowsOf(dataSource, 'dispute_requests', ['requested_at', 'route', 'closed_at']),
    );
  const closing = async dataSource =>
    closeMonths(
      await rowsOf(dataSource, 'dispute_requests', ['requested_at', 'route', 'closed_at']),
    );
  const network = async dataSource =>
    winRateMonths(await rowsOf(dataSource, 'chargebacks', ['status', 'decision_at']));
  const overview = async dataSource => overviewWeeks(await workItems(dataSource));
  customizer.addChart(
    CHARTS.validatedRejected.name,
    multi(payments, 'Week', [
      ['Validated', 'validated'],
      ['Rejected', 'rejected'],
    ]),
  );
  customizer.addChart(CHARTS.validationMinutes.name, weekly(payments, 'minutes'));
  customizer.addChart(
    CHARTS.recalls.name,
    multi(recalls, 'Week', [
      ['Received', 'received'],
      ['Returned', 'returned'],
    ]),
  );
  customizer.addChart(CHARTS.alertsDecided.name, weekly(alerts, 'decided'));
  customizer.addChart(CHARTS.falsePositive.name, weekly(alerts, 'falsePositive'));
  customizer.addChart(CHARTS.hoursToClear.name, weekly(alerts, 'hoursToClear'));
  customizer.addChart(
    CHARTS.openedClosed.name,
    multi(cases, 'Week', [
      ['Opened', 'opened'],
      ['Closed', 'closed'],
    ]),
  );
  customizer.addChart(CHARTS.daysOpen.name, weekly(cases, 'daysOpen'));
  customizer.addChart(CHARTS.sarsFiled.name, monthly(sars, 'filed'));
  customizer.addChart(CHARTS.draftToFiling.name, monthly(sars, 'draftToFiling'));
  customizer.addChart(CHARTS.byRoute.name, multi(disputes, 'Week', routeLines));
  customizer.addChart(CHARTS.winRate.name, monthly(network, 'winRate'));
  customizer.addChart(
    CHARTS.daysToResolve.name,
    multi(closing, 'Month', [
      ['Chargebacks', 'chargebackDays'],
      ['Merchant first, declined, refunds', 'otherDays'],
    ]),
  );
  customizer.addChart(CHARTS.received.name, weekly(overview, 'received'));
  customizer.addChart(CHARTS.finished.name, weekly(overview, 'finished'));
  customizer.addChart(CHARTS.open.name, weekly(overview, 'open'));
}

module.exports = {
  CHARTS,
  HISTORY_WEEKS,
  MONTHS,
  ROUTE_LABELS,
  WEEKS,
  alertWeeks,
  closeMonths,
  disputeWeeks,
  investigationWeeks,
  recallWeeks,
  routeLines,
  sarMonths,
  winRateMonths,
  workingMinutes,
  WORK,
  addDeskCharts,
  decidedTransfers,
  onboardingWeeks,
  overviewWeeks,
  paymentsWeeks,
  seriesOf,
  weekStart,
  workItems,
};

import type { Schema } from '../typings';
import type { DataSourceCustomizer } from '@forestadmin/agent';

import { DAY_IN_MS } from '../case-helpers';

const HOUR_IN_MS = 60 * 60 * 1000;
const DAYS_IN_A_WEEK = 7;
const PERCENT = 100;
const WEEKS = 26;
const HISTORY_WEEKS = 23;
const MONTHS = 4;
const DECIDED = ['APPROVED', 'REJECTED'];

const CHARTS = {
  lead: 'kyc_lead_time',
  conversion: 'kyc_conversion',
  alertsDecided: 'alerts_decided',
  falsePositive: 'alerts_false_positive',
  hoursToClear: 'alerts_hours_to_clear',
  openedClosed: 'investigations_opened_closed',
  daysOpen: 'investigations_days_open',
  sarsFiled: 'mlro_sars_filed',
  draftToFiling: 'mlro_draft_to_filing',
  byRoute: 'disputes_by_route',
  winRate: 'disputes_win_rate',
  daysToResolve: 'disputes_days_to_resolve',
  received: 'ops_received',
  finished: 'ops_finished',
  open: 'ops_open',
};

const WORK = [
  { table: 'kyc_cases', arrived: 'opened_at', done: ['resolved_at'] },
  { table: 'alerts', arrived: 'triggered_at', done: ['resolved_at', 'escalated_at'] },
  { table: 'investigations', arrived: 'opened_at', done: ['decided_at'] },
  { table: 'dispute_requests', arrived: 'created_at', done: ['routed_at', 'closed_at'] },
  { table: 'chargebacks', arrived: 'created_at', done: ['decision_at'] },
];

const ROUTE_LABELS = {
  CHARGEBACK: 'Chargeback',
  CONTACT_MERCHANT: 'Merchant first',
  DECLINED: 'Declined',
  SEPA_DISPUTE: 'SEPA refund or recall',
  BANK_REFUND: 'Bank refund',
  NONE: 'Not routed yet',
};

function weekStart(value) {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % DAYS_IN_A_WEEK));

  return d;
}

const round1 = (x: number) => Math.round(x * 10) / 10;

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const daysBetween = (from, to) => (new Date(to).getTime() - new Date(from).getTime()) / DAY_IN_MS;

function onboardingWeeks(rows, now = new Date()) {
  const first = weekStart(now);
  first.setDate(first.getDate() - DAYS_IN_A_WEEK * WEEKS);
  const weeks = [];

  for (let d = new Date(first); d <= now; d.setDate(d.getDate() + DAYS_IN_A_WEEK)) {
    weeks.push({ date: new Date(d), decided: 0, approved: 0, days: [] });
  }

  const at = value => weeks.find(w => w.date.getTime() === weekStart(value).getTime());

  rows.forEach(r => {
    const week = DECIDED.includes(r.status) && r.resolved_at && at(r.resolved_at);
    if (!week || r.rejection_code === 'NO_RESPONSE') return;
    week.decided += 1;

    if (r.status === 'APPROVED' && r.opened_at) {
      week.approved += 1;
      week.days.push(daysBetween(r.opened_at, r.resolved_at));
    }
  });

  return weeks.map(w => ({
    date: w.date,
    leadDays: w.approved ? round1(median(w.days)) : null,
    conversion: w.decided ? round1((PERCENT * w.approved) / w.decided) : null,
  }));
}

function completeWeeks(now = new Date(), count = WEEKS) {
  const first = weekStart(now);
  first.setDate(first.getDate() - DAYS_IN_A_WEEK * count);

  return Array.from({ length: count }, (_, i) => {
    const d = new Date(first);
    d.setDate(d.getDate() + DAYS_IN_A_WEEK * i);

    return d;
  });
}

const weekIndex = (weeks: Date[], value) => {
  if (!value) return -1;
  const time = weekStart(value).getTime();

  return weeks.findIndex(w => w.getTime() === time);
};

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
    weeks[i].hours.push(
      (new Date(r.resolved_at).getTime() - new Date(r.triggered_at).getTime()) / HOUR_IN_MS,
    );
  });

  return weeks.map(w => ({
    date: w.date,
    decided: w.decided,
    falsePositive: w.decided ? round1((PERCENT * w.falsePositives) / w.decided) : null,
    hoursToClear: w.hours.length ? round1(median(w.hours)) : null,
  }));
}

function investigationWeeks(rows, now = new Date()) {
  const dates = completeWeeks(now, HISTORY_WEEKS);
  const weeks = dates.map(date => ({ date, opened: 0, days: [] }));
  rows.forEach(r => {
    const i = weekIndex(dates, r.opened_at);
    if (i >= 0) weeks[i].opened += 1;
    const j = weekIndex(dates, r.decided_at);
    if (j >= 0) weeks[j].days.push(daysBetween(r.opened_at, r.decided_at));
  });

  return weeks.map(w => ({
    date: w.date,
    opened: w.opened,
    closed: w.days.length,
    daysOpen: w.days.length ? round1(median(w.days)) : null,
  }));
}

function lastMonths(now = new Date()) {
  return Array.from(
    { length: MONTHS + 1 },
    (_, i) => new Date(now.getFullYear(), now.getMonth() - MONTHS + i, 1),
  );
}

const monthIndex = (months: Date[], value) => {
  if (!value) return -1;
  const d = new Date(value);

  return months.findIndex(
    m => m.getFullYear() === d.getFullYear() && m.getMonth() === d.getMonth(),
  );
};

function sarMonths(rows, now = new Date()) {
  const months = lastMonths(now);
  const list = months.map(date => ({ date, days: [] }));
  rows.forEach(r => {
    const i = monthIndex(months, r.filed_at);
    if (i >= 0) list[i].days.push(daysBetween(r.created_at, r.filed_at));
  });

  return list.map(m => ({
    date: m.date,
    filed: m.days.length,
    draftToFiling: m.days.length ? round1(median(m.days)) : null,
  }));
}

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
    winRate: m.won + m.lost ? round1((PERCENT * m.won) / (m.won + m.lost)) : null,
  }));
}

function disputeWeeks(rows, now = new Date()) {
  const dates = completeWeeks(now, HISTORY_WEEKS);
  const weeks = dates.map(date => ({ date, routes: {} as Record<string, number> }));
  rows.forEach(r => {
    const i = weekIndex(dates, r.requested_at);
    if (i < 0) return;
    const key = r.route || 'NONE';
    weeks[i].routes[key] = (weeks[i].routes[key] || 0) + 1;
  });

  return weeks;
}

function closeMonths(rows, now = new Date()) {
  const months = lastMonths(now);
  const list = months.map(date => ({ date, chargeback: [], other: [] }));
  rows.forEach(r => {
    const i = monthIndex(months, r.closed_at);
    if (i < 0 || !r.requested_at) return;
    list[i][r.route === 'CHARGEBACK' ? 'chargeback' : 'other'].push(
      daysBetween(r.requested_at, r.closed_at),
    );
  });

  return list
    .map(m => ({
      date: m.date,
      chargebackDays: m.chargeback.length ? round1(median(m.chargeback)) : null,
      otherDays: m.other.length ? round1(median(m.other)) : null,
    }))
    .filter((m, i, all) => i < all.length - 1 || (m.chargebackDays && m.otherDays));
}

const linesOf = (weeks, pairs: [string, string][]) =>
  pairs.map(([label, key]) => ({ label, values: weeks.map(w => w[key] ?? null) }));

const routeLines = weeks =>
  Object.keys(ROUTE_LABELS)
    .filter(key => weeks.some(w => w.routes[key]))
    .map(key => ({ label: ROUTE_LABELS[key], values: weeks.map(w => w.routes[key] || 0) }));

function overviewWeeks(items, now = new Date()) {
  return completeWeeks(now).map(date => {
    const end = new Date(date);
    end.setDate(end.getDate() + DAYS_IN_A_WEEK);
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

const rowsOf = (dataSource, table: string, fields: string[], conditionTree?) =>
  dataSource.getCollection(table).list(conditionTree ? { conditionTree } : {}, fields);

async function workItems(dataSource) {
  const lists = await Promise.all(
    WORK.map(async w => {
      const rows = await rowsOf(dataSource, w.table, [w.arrived, ...w.done]);

      return rows.map(r => ({
        arrived: r[w.arrived] || null,
        done: w.done.map(f => r[f]).find(Boolean) || null,
      }));
    }),
  );

  return lists.flat();
}

const seriesOf = (weeks, key: string) =>
  weeks
    .filter((w, i) => i < weeks.length - 1 || w[key] !== null)
    .map(w => ({ date: w.date, value: w[key] }));

const onboarding = async dataSource => {
  const since = weekStart(new Date(Date.now() - (WEEKS + 1) * DAYS_IN_A_WEEK * DAY_IN_MS));

  return onboardingWeeks(
    await rowsOf(
      dataSource,
      'kyc_cases',
      ['_id', 'opened_at', 'resolved_at', 'status', 'rejection_code'],
      {
        aggregator: 'And',
        conditions: [
          { field: 'type', operator: 'Equal', value: 'ONBOARDING' },
          { field: 'status', operator: 'In', value: DECIDED },
          { field: 'resolved_at', operator: 'GreaterThan', value: since.toISOString() },
        ],
      },
    ),
  );
};

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
  disputeWeeks(await rowsOf(dataSource, 'dispute_requests', ['requested_at', 'route']));
const closing = async dataSource =>
  closeMonths(await rowsOf(dataSource, 'dispute_requests', ['requested_at', 'route', 'closed_at']));
const network = async dataSource =>
  winRateMonths(await rowsOf(dataSource, 'chargebacks', ['status', 'decision_at']));
const overview = async dataSource => overviewWeeks(await workItems(dataSource));

export default function addDeskCharts(customizer: DataSourceCustomizer<Schema>) {
  const series = (build, key: string) => async (context, resultBuilder) =>
    resultBuilder.timeBased('Week', seriesOf(await build(context.dataSource), key));
  const weekly = (build, key: string) => async (context, resultBuilder) =>
    resultBuilder.timeBased(
      'Week',
      (await build(context.dataSource)).map(w => ({ date: w.date, value: w[key] })),
    );
  const monthly = (build, key: string) => async (context, resultBuilder) =>
    resultBuilder.timeBased('Month', seriesOf(await build(context.dataSource), key));

  const multi = (build, range: 'Week' | 'Month', lines) => async (context, resultBuilder) => {
    const periods = await build(context.dataSource);

    return resultBuilder.multipleTimeBased(
      range,
      periods.map(p => p.date),
      typeof lines === 'function' ? lines(periods) : linesOf(periods, lines),
    );
  };

  customizer
    .addChart(CHARTS.lead, series(onboarding, 'leadDays'))
    .addChart(CHARTS.conversion, series(onboarding, 'conversion'))
    .addChart(CHARTS.alertsDecided, weekly(alerts, 'decided'))
    .addChart(CHARTS.falsePositive, weekly(alerts, 'falsePositive'))
    .addChart(CHARTS.hoursToClear, weekly(alerts, 'hoursToClear'))
    .addChart(
      CHARTS.openedClosed,
      multi(cases, 'Week', [
        ['Opened', 'opened'],
        ['Closed', 'closed'],
      ]),
    )
    .addChart(CHARTS.daysOpen, weekly(cases, 'daysOpen'))
    .addChart(CHARTS.sarsFiled, monthly(sars, 'filed'))
    .addChart(CHARTS.draftToFiling, monthly(sars, 'draftToFiling'))
    .addChart(CHARTS.byRoute, multi(disputes, 'Week', routeLines))
    .addChart(CHARTS.winRate, monthly(network, 'winRate'))
    .addChart(
      CHARTS.daysToResolve,
      multi(closing, 'Month', [
        ['Chargebacks', 'chargebackDays'],
        ['Merchant first, declined, refunds', 'otherDays'],
      ]),
    )
    .addChart(CHARTS.received, weekly(overview, 'received'))
    .addChart(CHARTS.finished, weekly(overview, 'finished'))
    .addChart(CHARTS.open, weekly(overview, 'open'));
}

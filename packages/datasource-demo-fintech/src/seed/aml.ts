import type { Customer, Row } from './types';
import type { Knex } from 'knex';

import { dayOnlyAgo, daysAgo } from './dates';
import { AML_SEVERITIES, AML_STATUSES, ATYPES, SAR_STATUSES } from './pools';
import { chance, choices, insertAll, pick, randint, round2, uniform } from './utils';

interface Alert extends Row {
  id: number;
  customer_id: number;
  alert_type: string;
  status: string;
  resolved_at: string | null;
  resolution_notes: string | null;
  linkedSarRef: string | null;
}

function amlSeverity(risk: string, sanctioned: boolean, atype: string): string {
  if (sanctioned || atype === 'SANCTIONS_MATCH') return choices(['HIGH', 'CRITICAL'], [40, 60]);

  return choices(
    AML_SEVERITIES,
    { HIGH: [0, 1, 5, 4], MEDIUM: [1, 5, 3, 1], LOW: [6, 3, 1, 0] }[
      risk as 'HIGH' | 'MEDIUM' | 'LOW'
    ],
  );
}

function alertNotes(status: string): string | null {
  if (status === 'CLEARED') {
    return pick(['False positive — name overlap.', 'Cleared after review.']);
  }

  if (status === 'ESCALATED') return pick(['Escalated to MLRO.', 'Under enhanced due diligence.']);

  return null;
}

/**
 * Raises 70 AML alerts, weighting customers by risk/PEP/sanctions, then files SARs
 * for the escalated ones. A filed SAR pushes its source alert to SAR_FILED so the
 * two collections always tell the same story.
 */
export default async function seedAml(knex: Knex, customers: Customer[]): Promise<void> {
  await knex.schema.createTable('aml_alerts', table => {
    table.increments('id').primary();
    table.integer('customer_id');
    table.string('alert_type');
    table.string('severity');
    table.string('status');
    table.datetime('triggered_at');
    table.string('resolution_notes');
    table.string('sar_reference');
    table.datetime('resolved_at');
  });

  await knex.schema.createTable('sar_reports', table => {
    table.increments('id').primary();
    table.integer('alert_id');
    table.integer('customer_id');
    table.string('reference');
    table.string('status');
    table.string('activity_type');
    table.date('activity_start_date');
    table.date('activity_end_date');
    table.float('total_amount');
    table.integer('transaction_count');
    table.string('narrative');
    table.datetime('filed_at');
    table.datetime('created_at');
  });

  const weights = customers.map(c => {
    let w = { HIGH: 6, MEDIUM: 2, LOW: 1 }[c.risk_rating as 'HIGH' | 'MEDIUM' | 'LOW'];
    if (c.is_pep) w += 4;
    if (c.is_sanctioned) w += 8;

    return w;
  });

  const alerts: Alert[] = [];
  let sarSeq = 0;

  for (let aid = 1; aid <= 70; aid += 1) {
    const c = choices(customers, weights);
    let atype: string;

    if (c.is_sanctioned) {
      atype = chance(0.7) ? 'SANCTIONS_MATCH' : pick(ATYPES);
    } else {
      atype = chance(0.08) ? 'SANCTIONS_MATCH' : pick(ATYPES.filter(t => t !== 'SANCTIONS_MATCH'));
    }

    const st = choices(AML_STATUSES, [30, 28, 22, 20]);
    const trig = randint(1, 130);
    let sarRef: string | null = null;

    if (st === 'ESCALATED' && (c.risk_rating === 'HIGH' || c.is_sanctioned || chance(0.5))) {
      sarSeq += 1;
      sarRef = `SAR-2026-${String(sarSeq).padStart(5, '0')}`;
    }

    const resolved = ['CLEARED', 'ESCALATED'].includes(st);
    alerts.push({
      id: aid,
      customer_id: c.id,
      alert_type: atype,
      severity: amlSeverity(c.risk_rating, c.is_sanctioned, atype),
      status: st,
      triggered_at: daysAgo(trig),
      resolution_notes: alertNotes(st),
      sar_reference: sarRef,
      resolved_at: resolved ? daysAgo(randint(1, Math.max(2, trig - 1))) : null,
      linkedSarRef: sarRef,
    });
  }

  const sars: Row[] = [];
  let sid = 0;

  for (const a of alerts.filter(x => x.linkedSarRef)) {
    sid += 1;
    const start = randint(40, 120);
    const end = randint(5, 35);
    const status = choices(SAR_STATUSES, [25, 25, 50]);
    const filedAt = chance(0.6) ? daysAgo(randint(1, end)) : null;
    const createdAt = daysAgo(end + randint(1, 5));
    sars.push({
      id: sid,
      alert_id: a.id,
      customer_id: a.customer_id,
      reference: a.linkedSarRef,
      status,
      activity_type: a.alert_type,
      activity_start_date: dayOnlyAgo(start),
      activity_end_date: dayOnlyAgo(end),
      total_amount: round2(uniform(8000, 240000)),
      transaction_count: randint(3, 80),
      narrative: `Suspicious activity consistent with ${a.alert_type
        .replace(/_/g, ' ')
        .toLowerCase()} detected over ${
        start - end
      } days; cumulative value exceeds internal thresholds. Funds movement reviewed by compliance and escalated to the financial intelligence unit.`,
      filed_at: filedAt,
      created_at: createdAt,
    });

    // Coherence: an alert with a linked SAR reflects that SAR's state.
    if (['FILED', 'SUBMITTED'].includes(status)) {
      a.status = 'SAR_FILED';
      a.resolved_at = a.resolved_at || filedAt || createdAt;
      a.resolution_notes = `SAR ${a.linkedSarRef} filed with the FIU.`;
    } else {
      a.status = 'ESCALATED';
    }
  }

  await insertAll(
    knex,
    'aml_alerts',
    alerts.map(({ linkedSarRef, ...row }) => row),
  );
  await insertAll(knex, 'sar_reports', sars);
}

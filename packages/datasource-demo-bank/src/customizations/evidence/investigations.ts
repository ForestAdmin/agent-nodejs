/**
 * The case file an investigator and the MLRO read, as fields of the investigation (same pattern
 * as case-file.js): the case, the alerts and hits behind it, its transactions, the customer's
 * profile against their activity, KYC, the questions asked, and the SAR once drafted and filed.
 */
import type { RecordData } from '@forestadmin/datasource-toolkit';

import { ConditionTreeLeaf } from '@forestadmin/datasource-toolkit';

import { reader } from '../shared/case-file';
import { PROVIDERS, freezeReport } from '../shared/providers';

const OK = '✓';
const LOOK = '⚠';
const BAD = '✗';
const DAY = 24 * 3600 * 1000;

const eq = (field, value) =>
  new ConditionTreeLeaf(field, Array.isArray(value) ? 'In' : 'Equal', value);
const frDate = iso => (iso ? new Date(iso).toLocaleDateString('fr-FR', { timeZone: 'UTC' }) : '');
const stamp = iso =>
  new Date(iso).toLocaleString('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Europe/Paris',
  });
const euros = n =>
  `${Number(n).toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} EUR`;
const round = n => `${Math.round(Number(n)).toLocaleString('fr-FR')} EUR`;
const label = code => (code ? code.replace(/_/g, ' ').toLowerCase() : '');
const sentence = text => text.charAt(0).toUpperCase() + text.slice(1);
const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;
const ids = rows => rows.map(r => r.id);

const ORIGINS = {
  ALERTS: 'opened from alerts',
  KYC_ESCALATION: 'escalated by the onboarding team',
  SCREENING_HIT: 'opened from a screening hit',
  AUTHORITY_REQUEST: 'opened on an authority request',
  INTERNAL_REFERRAL: 'internal referral (relationship manager)',
  ADVERSE_MEDIA: 'opened on adverse media',
  CUSTOMER_REPORT: 'reported by the customer',
  DISPUTE: 'opened from a disputed payment',
};
const DECISIONS = {
  SAR_FILED: 'SAR filed',
  NO_SAR: 'no SAR',
  EXIT_RELATIONSHIP: 'relationship exited',
  FIRST_PARTY_FRAUD: 'first-party fraud',
  GENUINE_FRAUD: 'genuine fraud, customer refunded',
};
const STATUS = {
  OPEN: 'New, not taken yet',
  IN_PROGRESS: 'In progress',
  WAITING_INFORMATION: 'Waiting for information, out of the analyst queue',
  PENDING_MLRO: 'With the MLRO for sign-off, out of the analyst queue',
  CLOSED: 'Closed',
};

/** The last status line that moved the case into `to` (from `from`, when given). */
async function lastMove(list, inv, to, from?) {
  const leaves = [eq('record_id', inv.id), eq('new_value', to)];
  if (from) leaves.push(eq('old_value', from));
  const rows = await list('status_changes', leaves, ['changed_at', 'changed_by', 'reason'], {
    field: 'changed_at',
    ascending: false,
  });

  return rows[0] || null;
}

// ---- the case --------------------------------------------------------------------------------

async function statusLine(list, inv) {
  if (inv.status === 'CLOSED') {
    return `Closed: ${DECISIONS[inv.decision] || label(inv.decision)}, by ${
      inv.decided_by
    } on ${stamp(inv.decided_at)}`;
  }

  const who = inv.assigned_to ? `, assigned to ${inv.assigned_to}` : ', nobody assigned';

  if (inv.status === 'IN_PROGRESS') {
    const back = await lastMove(list, inv, 'IN_PROGRESS', 'PENDING_MLRO');

    if (back) {
      return `${LOOK} In progress${who}: sent back by the MLRO on ${stamp(back.changed_at)}: ${
        back.reason || 'no reason given'
      }`;
    }
  }

  if (inv.status === 'WAITING_INFORMATION') {
    const why = await lastMove(list, inv, 'WAITING_INFORMATION');

    return `${STATUS.WAITING_INFORMATION}${why?.reason ? `: ${why.reason}` : ''}${who}`;
  }

  if (inv.status === 'PENDING_MLRO') {
    return `${STATUS.PENDING_MLRO}, since ${stamp(inv.sent_to_mlro_at || inv.opened_at)}`;
  }

  return `${STATUS[inv.status]}${who}`;
}

function dueLine(inv) {
  if (inv.status === 'CLOSED') return `○ Decided on ${frDate(inv.decided_at)}`;
  const days = Math.ceil((new Date(inv.due_at).getTime() - Date.now()) / DAY);
  if (days < 0) return `${BAD} Overdue by ${plural(-days, 'day')} (due ${frDate(inv.due_at)})`;
  if (days === 0) return `${LOOK} Due today (${frDate(inv.due_at)})`;

  return `${days <= 7 ? LOOK : OK} Due ${frDate(inv.due_at)}, in ${plural(days, 'day')}`;
}

async function caseFields(list, inv) {
  return {
    case_type: `${label(inv.type).toUpperCase()} · ${
      ORIGINS[inv.origin] || label(inv.origin)
    } · priority ${label(inv.priority)} · opened ${frDate(inv.opened_at)}`,
    case_summary: inv.summary || 'No summary written yet',
    case_due: dueLine(inv),
    case_status: await statusLine(list, inv),
  };
}

// ---- alerts and hits -------------------------------------------------------------------------

async function signalFields(list, inv) {
  const alerts = await list(
    'alerts',
    [eq('investigation_id', inv.id)],
    ['reference', 'alert_type', 'score', 'triggered_at'],
    { field: 'triggered_at', ascending: true },
  );
  const hits = await list(
    'screening_hits',
    [eq('investigation_id', inv.id)],
    ['reference', 'screened_name', 'hit_type', 'status', 'watchlist_entry_id'],
  );
  // Relations are not there yet at this layer of the agent: each table is read on its own.
  const entries = hits.length
    ? await list(
        'watchlist_entries',
        [
          eq(
            'id',
            hits.map(h => h.watchlist_entry_id),
          ),
        ],
        ['id', 'list'],
      )
    : [];
  const listOf = new Map(entries.map(e => [e.id, e.list]));

  return {
    signals_alerts: alerts.length
      ? alerts
          .map(
            a =>
              `${BAD} ${a.reference}: ${label(a.alert_type)}, score ${Math.round(
                a.score,
              )}, ${frDate(a.triggered_at)}`,
          )
          .join(' · ')
      : `○ No alert: ${ORIGINS[inv.origin] || label(inv.origin)}`,
    signals_hits: hits.length
      ? hits
          .map(
            h =>
              `${BAD} ${h.reference}: ${h.screened_name}, ${
                listOf.get(h.watchlist_entry_id) || ''
              } ${label(h.hit_type)} hit, ${label(h.status)}`,
          )
          .join(' · ')
      : '○ No screening hit',
  };
}

// ---- transactions ----------------------------------------------------------------------------

/** Per counterparty and direction: how many payments, how much, and where its account is. */
async function moves(list, txs) {
  const parties = txs.some(t => t.counterparty_id)
    ? await list(
        'counterparties',
        [eq('id', txs.map(t => t.counterparty_id).filter(Boolean))],
        ['id', 'name', 'country'],
      )
    : [];
  const outs = await list(
    'outgoing_transfers',
    [eq('transaction_id', ids(txs))],
    ['transaction_id', 'beneficiary_id'],
  );
  const ins = await list(
    'incoming_transfers',
    [eq('transaction_id', ids(txs))],
    ['transaction_id', 'emitter_id'],
  );
  const accountsOf = async (table, rows, key) =>
    rows.length
      ? list(
          table,
          [
            eq(
              'id',
              rows.map(r => r[key]),
            ),
          ],
          ['id', 'iban'],
        )
      : [];
  const ibans = new Map<string, string>(
    [
      ...(await accountsOf('sct_beneficiaries', outs, 'beneficiary_id')),
      ...(await accountsOf('sct_emitters', ins, 'emitter_id')),
    ].map(r => [r.id, r.iban]),
  );
  const ibanOf = new Map<string, string>([
    ...outs.map(o => [o.transaction_id, ibans.get(o.beneficiary_id)]),
    ...ins.map(i => [i.transaction_id, ibans.get(i.emitter_id)]),
  ]);
  const partyOf = new Map<string, RecordData>(parties.map(p => [p.id, p]));
  const groups = new Map();
  txs.forEach(tx => {
    const party = partyOf.get(tx.counterparty_id);
    const name = party?.name || tx.description;
    const key = `${tx.direction}:${name}`;
    const country = ibanOf.get(tx.id)?.slice(0, 2) || party?.country || 'FR';
    const group = groups.get(key) || { name, direction: tx.direction, country, n: 0, total: 0 };
    group.n += 1;
    group.total += Number(tx.amount);
    groups.set(key, group);
  });

  return [...groups.values()].sort((a, b) => b.total - a.total);
}

function sideLine(groups, direction, word) {
  const side = groups.filter(g => g.direction === direction);
  if (!side.length) return null;
  const shown = side
    .slice(0, 4)
    .map(g => `${g.name} (${g.n > 1 ? `${g.n} payments, ` : ''}${round(g.total)})`);
  const more = side.length > 4 ? ` and ${side.length - 4} more` : '';

  return `${word}: ${shown.join(', ')}${more}`;
}

async function transactionFields(list, inv) {
  const links = await list(
    'investigation_transactions',
    [eq('investigation_id', inv.id)],
    ['transaction_id', 'included_in_sar'],
  );

  if (!links.length) {
    const none = '○ No transaction attached to the case';

    return { tx_totals: none, tx_counterparties: none, tx_countries: none };
  }

  const txs = await list(
    'transactions',
    [
      eq(
        'id',
        links.map(l => l.transaction_id),
      ),
    ],
    ['id', 'amount', 'direction', 'created_at', 'counterparty_id', 'description'],
  );
  const sum = dir => txs.filter(t => t.direction === dir).reduce((s, t) => s + Number(t.amount), 0);
  const dates = txs.map(t => String(t.created_at)).sort();
  const ticked = links.filter(l => l.included_in_sar).length;
  const groups = await moves(list, txs);
  const abroad = groups.filter(g => g.country !== 'FR');

  return {
    tx_totals: `${plural(txs.length, 'transaction')} from ${frDate(dates[0])} to ${frDate(
      dates[dates.length - 1],
    )}: ${euros(sum('CREDIT'))} in, ${euros(sum('DEBIT'))} out${
      ticked ? ` · ${ticked} ticked for a SAR` : ''
    }`,
    tx_counterparties: [sideLine(groups, 'CREDIT', 'In from'), sideLine(groups, 'DEBIT', 'Out to')]
      .filter(Boolean)
      .join(' · '),
    tx_countries: abroad.length
      ? `${LOOK} ${abroad
          .map(g => `${g.direction === 'DEBIT' ? 'out to' : 'in from'} ${g.country} (${g.name})`)
          .join(', ')
          .replace(/^./, c => c.toUpperCase())}`
      : `${OK} Every counterparty banks in France`,
  };
}

// ---- customer, KYC, requests -----------------------------------------------------------------

async function profileLine(list, customer) {
  const declared = `declares ${round(customer.expected_monthly_in || 0)} in and ${round(
    customer.expected_monthly_out || 0,
  )} out a month`;

  if (customer.business_id) {
    const [b] = await list(
      'businesses',
      [eq('id', customer.business_id)],
      ['legal_form', 'industry', 'nace_code', 'source_of_funds'],
    );

    return `Company (${b?.legal_form || '?'}) · ${b?.industry || 'activity not stated'} (NACE ${
      b?.nace_code || '?'
    }) · funds from ${label(b?.source_of_funds) || '?'} · ${declared}`;
  }

  const [member] = await list(
    'customer_members',
    [eq('customer_id', customer.id), eq('role', 'HOLDER')],
    ['individual_id'],
  );
  const [p = {}] = member
    ? await list(
        'individuals',
        [eq('id', member.individual_id)],
        ['occupation', 'employer', 'income_band'],
      )
    : [];

  return `Person · ${p.occupation || 'occupation not stated'}${
    p.employer ? ` at ${p.employer}` : ''
  } · income ${label(p.income_band) || '?'} · ${declared}`;
}

/** Money in over the last 90 days, a month on average, against what the customer declared. */
async function activityLine(list, customer, accounts) {
  if (!accounts.length) return '○ No account: no activity to compare';
  const since = new Date(Date.now() - 90 * DAY).toISOString().replace('T', ' ');
  const credits = await list(
    'transactions',
    [eq('account_id', ids(accounts)), eq('direction', 'CREDIT'), eq('status', 'BOOKED')],
    ['amount', 'created_at', 'rail'],
  );
  const monthly =
    credits
      .filter(t => String(t.created_at) >= since && t.rail !== 'INTERNAL')
      .reduce((s, t) => s + Number(t.amount), 0) / 3;
  const declared = Number(customer.expected_monthly_in) || 0;
  const ratio = declared ? monthly / declared : 0;
  const facts = `${round(monthly)} in a month over the last 90 days, ${round(declared)} declared`;
  if (ratio > 3) return `${BAD} ${ratio.toFixed(1).replace('.', ',')} times the profile: ${facts}`;

  if (ratio > 1.5) {
    return `${LOOK} ${ratio.toFixed(1).replace('.', ',')} times the profile: ${facts}`;
  }

  return `${OK} Within the profile: ${facts}`;
}

async function accountsLine(list, inv, accounts) {
  const closures = await list(
    'closures',
    [eq('customer_id', inv.customer_id)],
    ['reference', 'status', 'reason', 'balance_to_return', 'requested_at'],
    { field: 'requested_at', ascending: false },
  );
  const open = accounts.filter(a => a.status !== 'CLOSED');
  const lines = open.map(
    a =>
      `${a.iban} ${
        a.status === 'FROZEN' ? `${BAD} frozen (${label(a.freeze_reason)})` : label(a.status)
      }, ${euros(a.balance)}`,
  );
  const closure = closures.find(c => c.status !== 'CANCELLED');

  if (closure) {
    lines.push(
      `${LOOK} closure ${closure.reference} ${label(closure.status)} (${label(closure.reason)}), ${
        Number(closure.balance_to_return) < 0
          ? `the customer owes ${euros(-closure.balance_to_return)}`
          : `${euros(closure.balance_to_return || 0)} to return`
      }`,
    );
  }

  return lines.length ? lines.join(' · ') : '○ No account open';
}

async function customerFields(list, inv) {
  const [customer] = await list(
    'customers',
    [eq('id', inv.customer_id)],
    [
      'id',
      'customer_type',
      'business_id',
      'expected_monthly_in',
      'expected_monthly_out',
      'status',
      'risk_rating',
      'next_review_at',
      'onboarded_at',
    ],
  );
  if (!customer) return {};
  const accounts = await list(
    'accounts',
    [eq('customer_id', customer.id)],
    ['id', 'iban', 'status', 'freeze_reason', 'balance'],
  );

  return {
    customer,
    fields: {
      customer_profile: await profileLine(list, customer),
      customer_activity: await activityLine(list, customer, accounts),
      customer_accounts: await accountsLine(list, inv, accounts),
    },
  };
}

async function kycFields(list, inv, customer) {
  const cases = await list(
    'kyc_cases',
    [eq('customer_id', inv.customer_id)],
    ['reference', 'type', 'status', 'opened_at', 'resolved_at', 'investigation_id'],
    { field: 'opened_at', ascending: false },
  );
  const open = cases.find(k => !['APPROVED', 'REJECTED'].includes(k.status));
  const decided = cases.find(k => ['APPROVED', 'REJECTED'].includes(k.status));
  const who = `Customer ${label(customer.status)} · risk ${customer.risk_rating || '?'}`;
  let status = `${who} · no KYC case on file`;

  if (open) {
    status = `${LOOK} ${open.reference} ${label(open.type)} ${label(open.status)} since ${frDate(
      open.opened_at,
    )}${open.investigation_id === inv.id ? ', asked by this investigation' : ''} · ${who}`;
  } else if (decided) {
    status = `${decided.status === 'APPROVED' ? OK : BAD} Last KYC ${decided.reference} (${label(
      decided.type,
    )}) ${label(decided.status)} on ${frDate(decided.resolved_at || decided.opened_at)} · ${who}`;
  }

  let review = '○ No periodic review planned';

  if (customer.next_review_at) {
    const late = new Date(customer.next_review_at).getTime() < Date.now();
    review = `${late ? BAD : OK} Next periodic review ${late ? 'was due' : 'due'} ${frDate(
      customer.next_review_at,
    )}`;
  }

  return { kyc_status: status, kyc_review: review };
}

async function requestFields(list, inv) {
  const requests = await list(
    'information_requests',
    [eq('investigation_id', inv.id)],
    ['reference', 'status', 'sent_at', 'due_at', 'channel', 'questions', 'answer', 'answered_at'],
    { field: 'created_at', ascending: false },
  );
  const open = requests.filter(r => ['SENT', 'OVERDUE'].includes(r.status));
  const answered = requests.filter(r => r.status === 'ANSWERED');

  return {
    req_open: open.length
      ? open
          .map(
            r =>
              `${LOOK} ${r.reference} sent ${frDate(r.sent_at)} by ${label(
                r.channel,
              )}, due ${frDate(r.due_at)}${r.status === 'OVERDUE' ? ' (overdue)' : ''}: "${
                r.questions
              }"`,
          )
          .join(' · ')
      : '○ No request open',
    req_answers: answered.length
      ? answered
          .map(r => `${r.reference} answered on ${frDate(r.answered_at)}: "${r.answer}"`)
          .join(' · ')
      : '○ No answer on file',
  };
}

// ---- the SAR ---------------------------------------------------------------------------------

/**
 * A sanctions match is not a suspicion to report to TRACFIN: the freeze is reported to the DG
 * Trésor, which the analyst did when confirming the hit.
 */
async function freezeReportFields(list, inv) {
  const [hit] = await list(
    'screening_hits',
    [eq('investigation_id', inv.id), eq('status', 'TRUE_MATCH')],
    ['id', 'reference', 'reviewed_at', 'reviewed_by'],
  );
  const filing = hit
    ? `${OK} Freeze reported to ${PROVIDERS.dgTresor} (simulated) on ${stamp(hit.reviewed_at)} by ${
        hit.reviewed_by
      } · report ${freezeReport(hit.id, new Date(hit.reviewed_at).getUTCFullYear())} (${
        hit.reference
      })`
    : `${LOOK} Not reported yet: an asset freeze is reported to ${PROVIDERS.dgTresor}`;

  return {
    sar_draft: `○ No SAR: a sanctions match is reported to the DG Trésor (asset freeze), not to TRACFIN`,
    sar_narrative: '○ Not needed for a sanctions match',
    sar_filing: filing,
  };
}

async function sarFields(list, inv) {
  if (inv.type === 'SANCTIONS') return freezeReportFields(list, inv);
  const [sar] = await list(
    'sar_reports',
    [eq('investigation_id', inv.id)],
    [
      'reference',
      'status',
      'activity_type',
      'activity_start_date',
      'activity_end_date',
      'total_amount',
      'transaction_count',
      'narrative',
      'filed_at',
      'filed_by',
      'fiu_reference',
      'acknowledged_at',
      'tracfin_answer',
      'tracfin_answered_at',
    ],
    { field: 'created_at', ascending: false },
  );

  if (!sar) {
    return {
      sar_draft: 'Not drafted yet: the workflow runs "Draft SAR"',
      sar_narrative: 'Not drafted yet',
      sar_filing: 'Not filed: no draft yet',
    };
  }

  const draft = `${sar.reference} ${label(sar.status)}: ${label(sar.activity_type)}, ${plural(
    sar.transaction_count,
    'transaction',
  )} from ${frDate(sar.activity_start_date)} to ${frDate(sar.activity_end_date)}, ${euros(
    sar.total_amount,
  )}`;
  let filing = `Not filed yet: the MLRO runs "File SAR" (${PROVIDERS.tracfin})`;

  if (sar.status === 'SUBMITTED') {
    filing = `${OK} Filed with ${PROVIDERS.tracfin} (simulated) on ${stamp(sar.filed_at)} by ${
      sar.filed_by
    } · declaration ${
      sar.fiu_reference || 'number pending'
    } · accounts frozen until TRACFIN answers`;
  }

  if (sar.status === 'ACKNOWLEDGED') {
    filing = `${OK} Acknowledged by TRACFIN on ${frDate(sar.acknowledged_at)}, reference ${
      sar.fiu_reference
    } (filed ${frDate(sar.filed_at)} by ${sar.filed_by}) · accounts frozen until TRACFIN answers`;
  }

  if (sar.status === 'ANSWERED') {
    filing = `${OK} TRACFIN answered on ${frDate(sar.tracfin_answered_at)}: ${label(
      sar.tracfin_answer,
    )} (declaration ${sar.fiu_reference}, filed ${frDate(sar.filed_at)})`;
  }

  return { sar_draft: draft, sar_narrative: sentence(sar.narrative || ''), sar_filing: filing };
}

const INVESTIGATION_FIELDS = [
  'id',
  'customer_id',
  'type',
  'origin',
  'status',
  'priority',
  'summary',
  'opened_at',
  'due_at',
  'assigned_to',
  'sent_to_mlro_at',
  'decision',
  'decided_by',
  'decided_at',
];

async function investigationFile(list, inv) {
  const { customer, fields } = await customerFields(list, inv);
  const [caseLines, signals, txs, requests, sar] = await Promise.all([
    caseFields(list, inv),
    signalFields(list, inv),
    transactionFields(list, inv),
    requestFields(list, inv),
    sarFields(list, inv),
  ]);

  return {
    ...caseLines,
    ...signals,
    ...txs,
    ...fields,
    ...(customer ? await kycFields(list, inv, customer) : {}),
    ...requests,
    ...sar,
  };
}

// field: label. The prefix groups them, so a workflow step can read one group by its name.
const LABELS = {
  case_type: 'Case · Type and origin',
  case_summary: 'Case · Summary',
  case_due: 'Case · Due date',
  case_status: 'Case · Status',
  signals_alerts: 'Alerts and hits · Alerts',
  signals_hits: 'Alerts and hits · Screening hits',
  tx_totals: 'Transactions · Totals',
  tx_counterparties: 'Transactions · Counterparties',
  tx_countries: 'Transactions · Countries',
  customer_profile: 'Customer · Profile',
  customer_activity: 'Customer · Activity vs profile',
  customer_accounts: 'Customer · Accounts',
  kyc_status: 'KYC · Status',
  kyc_review: 'KYC · Next review',
  req_open: 'Requests · Open',
  req_answers: 'Requests · Answers',
  sar_draft: 'SAR · Draft',
  sar_narrative: 'SAR · Narrative',
  sar_filing: 'SAR · Filing',
};
const FIELDS = Object.keys(LABELS);

function addInvestigationEvidence(collection) {
  // One computation per investigation and request, whichever fields are asked for.
  const cache = new WeakMap();

  const fileOf = (record, context) => {
    if (!cache.has(record)) {
      const list = reader(context.dataSource);
      cache.set(
        record,
        list('investigations', [eq('id', record.id)], INVESTIGATION_FIELDS).then(([inv]) =>
          inv ? investigationFile(list, inv) : {},
        ),
      );
    }

    return cache.get(record);
  };

  FIELDS.forEach(name =>
    collection.addField(name, {
      columnType: 'String',
      dependencies: ['id'],
      getValues: (records, context) =>
        Promise.all(records.map(async r => (await fileOf(r, context))?.[name] ?? null)),
    }),
  );
}

export { FIELDS, LABELS, addInvestigationEvidence };

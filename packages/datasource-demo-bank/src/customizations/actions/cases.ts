/**
 * Smart Actions on cases: investigations, high-value transfers, dispute requests, chargebacks and
 * SEPA disputes.
 * Each one checks the state first, writes the status history, and books money moves like the
 * generators do (a transactions row, the balances, balance_after).
 */
import { randomUUID } from 'crypto';

import { OTHER_BANKS } from '../../seed/reference';
import { tables } from '../../seed/schema';
import {
  FRAUD_CODES,
  REASON_CODES,
  SEPA_CODES,
  SEPA_REASONS,
  UNAUTHORISED,
  ruledNote,
} from '../evidence/disputes';
import { NO_CONSENT, money, networkRef, reader as sepaReader } from '../evidence/sepa';
import {
  TRANSFER_FIELDS,
  ibanValid,
  lastLine,
  phoneToCall,
  scriptedAnswer,
  facts as transferFacts,
  reader as transferReader,
} from '../evidence/transfers';
import { reader } from '../shared/case-file';
import { PROVIDERS, resultsFrom } from '../shared/providers';
import {
  codeText,
  euros,
  frDate,
  frStamp,
  pdf,
  card as resultCard,
  sarFile,
} from '../shared/render';

// ---- helpers -------------------------------------------------------------------------------------

const DAY = 24 * 3600 * 1000;
// ISO 8601 for Forest's validation; SQLite stores it as the data does (YYYY-MM-DD HH:MM:SS.SSS +00:00).
const iso = d => d.toISOString();
const isoDate = d => d.toISOString().slice(0, 10);
const now = () => iso(new Date());
const daysFromNow = n => new Date(Date.now() + n * DAY);
const round2 = n => Math.round(Number(n) * 100) / 100;
const readable = code =>
  String(code || '')
    .replace(/_/g, ' ')
    .toLowerCase();
const enumOf = (table, field) => tables[table].fields.find(f => f.name === field).enum;
/** Same digits on every run for the same record: a simulated provider answers from the data. */
const digitsOf = (id, n) => String(parseInt(id.replace(/-/g, '').slice(0, 12), 16)).slice(-n);

const coll = (context, table) => context.dataSource.getCollection(table);
const byId = id => ({ conditionTree: { field: 'id', operator: 'Equal', value: id } });
const where = (field, value) => ({
  conditionTree: { field, operator: Array.isArray(value) ? 'In' : 'Equal', value },
});

async function one(context, table, id, fields) {
  if (!id) return null;
  const [row] = await coll(context, table).list(byId(id), fields);

  return row || null;
}

async function insert(context, table, row) {
  const [created] = await coll(context, table).create([row]);

  return created || row;
}

const patch = (context, table, id, values) => coll(context, table).update(byId(id), values);

/** PREFIX-YEAR-NUMBER, the next number of the series this year. */
async function nextReference(context, table, prefix) {
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

  return `${start}${String(next).padStart(6, '0')}`;
}

/** One line of status history (status_changes), by the operator who ran the action. */
function history(context, recordType, id, [from, to], reason?, field = 'status') {
  return insert(context, 'status_changes', {
    id: randomUUID(),
    record_type: recordType,
    record_id: id,
    field,
    old_value: from || null,
    new_value: to,
    changed_by: context.caller.email,
    changed_at: now(),
    reason: reason || null,
  });
}

/** A new case row with its reference and its first status line. */
async function openCase(context, table, prefix, row) {
  const created = {
    id: randomUUID(),
    reference: await nextReference(context, table, prefix),
    ...row,
  };
  await insert(context, table, created);
  await history(context, table.toUpperCase(), created.id, [null, created.status]);

  return created;
}

/** An internal booking (refund, return): the transaction, then both balances move. */
async function book(context, accountId, direction, amount, description) {
  const account = await one(context, 'accounts', accountId, ['balance', 'available_balance']);
  const sign = direction === 'CREDIT' ? 1 : -1;
  const balance = round2(Number(account.balance) + sign * amount);
  const date = new Date();
  const tx = {
    id: randomUUID(),
    account_id: accountId,
    rail: 'INTERNAL',
    direction,
    amount: round2(amount),
    currency: 'EUR',
    status: 'BOOKED',
    booked_at: iso(date),
    created_at: iso(date),
    value_date: isoDate(date),
    balance_after: balance,
    description,
    category: 'REFUNDS',
  };
  await insert(context, 'transactions', tx);
  await patch(context, 'accounts', accountId, {
    balance,
    available_balance: round2(Number(account.available_balance) + sign * amount),
    last_activity_at: iso(date),
  });

  return tx;
}

/** A movement listed on its case (dispute_transactions), with its role. */
const listMove = (context, transactionId, role, links) =>
  insert(context, 'dispute_transactions', {
    id: randomUUID(),
    transaction_id: transactionId,
    role,
    dispute_request_id: null,
    chargeback_id: null,
    sepa_dispute_id: null,
    ...links,
  });

/** The person a letter goes to: the holder, or the signatory of a company. */
async function holderOf(context, customerId) {
  const [member] = await coll(context, 'customer_members').list(
    {
      conditionTree: {
        aggregator: 'And',
        conditions: [
          { field: 'customer_id', operator: 'Equal', value: customerId },
          { field: 'role', operator: 'In', value: ['HOLDER', 'SIGNATORY'] },
        ],
      },
    },
    ['individual_id'],
  );

  return member?.individual_id || null;
}

// "Due in (days)": empty for the 7 days by default, else whole days up to a year.
const DUE_IN_ERROR = 'Due in (days) must be a whole number of days, from 1 to 365.';
const badDueIn = value =>
  ![null, undefined, ''].includes(value) &&
  !(Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 365);

/** A request for information sent to the customer (a row, nothing leaves the demo). */
async function sendRequest(
  context,
  {
    customerId,
    serves,
    links,
    questions,
    channel,
    dueIn,
  }: { customerId; serves; links; questions; channel?; dueIn? },
) {
  return openCase(context, 'information_requests', 'RFI', {
    customer_id: customerId,
    addressed_to_id: await holderOf(context, customerId),
    context: serves,
    channel: channel || 'APP',
    questions,
    requested_by: context.caller.email,
    created_at: now(),
    sent_at: now(),
    due_at: iso(daysFromNow(dueIn || 7)),
    reminders_sent: 0,
    status: 'SENT',
    ...links,
  });
}

/** Requests still out on a case that moves on: cancelled, so nobody waits for them. */
async function cancelOpenRequests(context, field, id, reason) {
  const open = await coll(context, 'information_requests').list(
    {
      conditionTree: {
        aggregator: 'And',
        conditions: [
          { field, operator: 'Equal', value: id },
          { field: 'status', operator: 'In', value: ['SENT', 'OVERDUE'] },
        ],
      },
    },
    ['id', 'status'],
  );
  await Promise.all(
    open.map(async r => {
      await patch(context, 'information_requests', r.id, {
        status: 'CANCELLED',
        cancel_reason: reason,
      });
      await history(context, 'INFORMATION_REQUESTS', r.id, [r.status, 'CANCELLED'], reason);
    }),
  );
}

/** Change the status of the record the action runs on, with its history line. */
async function moveTo(context, recordType, record, status, values, reason?) {
  await context.collection.update(context.filter, { status, ...values });
  await history(context, recordType, record.id, [record.status, status], reason);
}

const merchantOf = async (context, transactionId) => {
  const tx = await one(context, 'transactions', transactionId, ['counterparty:name']);

  return tx?.counterparty?.name?.toUpperCase() || 'MARCHAND';
};

// The label of every network reason code, for a chargeback stored without one.
const CODE_LABELS = Object.fromEntries(
  Object.values(REASON_CODES).flatMap(([visa, visaLabel, mc, mcLabel]) => [
    [visa, visaLabel],
    [mc, mcLabel],
  ]),
);
/** "Visa 13.1 · Merchandise/Services Not Received": the network, the code and what it means. */
const codeLine = cb =>
  `${codeText(cb.network)} ${cb.reason_code} · ${
    cb.reason_description || CODE_LABELS[cb.reason_code] || 'no label'
  }`;

const nameOf = async (context, customerId) =>
  (await one(context, 'customers', customerId, ['display_name']))?.display_name || null;

/** The customer's accounts as they stand now, for a result card: IBAN, status, why frozen. */
async function accountsNow(context, customerId) {
  const accounts = await coll(context, 'accounts').list(where('customer_id', customerId), [
    'iban',
    'status',
    'freeze_reason',
  ]);

  return (
    accounts
      .map(
        a =>
          `${a.iban} ${readable(a.status)}${
            a.freeze_reason ? ` (${readable(a.freeze_reason)})` : ''
          }`,
      )
      .join(' · ') || 'No account'
  );
}

// ---- investigations ------------------------------------------------------------------------------

const ROUTINE_CHECK =
  'As part of our regular account checks, please explain where the money received on your ' +
  'account in the last weeks comes from, with a supporting document (contract, invoice, deed of sale).';
const INVESTIGATION = [
  'id',
  'reference',
  'status',
  'customer_id',
  'summary',
  'decision',
  'assigned_to',
];

/** An investigation that is closed cannot change any more. */
async function openInvestigation(context) {
  const inv = await context.getRecord(INVESTIGATION);

  return inv.status === 'CLOSED' ? [inv, `Investigation ${inv.reference} is closed.`] : [inv, null];
}

/** A draft nobody will file (case closed without a SAR, or sent back): removed, with its line. */
async function discardDraftSar(context, inv, reason) {
  const drafts = await coll(context, 'sar_reports').list(
    {
      conditionTree: {
        aggregator: 'And',
        conditions: [
          { field: 'investigation_id', operator: 'Equal', value: inv.id },
          { field: 'status', operator: 'Equal', value: 'DRAFT' },
        ],
      },
    },
    ['id', 'reference'],
  );
  await Promise.all(
    drafts.map(async sar => {
      await coll(context, 'sar_reports').delete(byId(sar.id));
      await history(context, 'SAR_REPORTS', sar.id, ['DRAFT', 'DISCARDED'], reason);
    }),
  );

  return drafts.map(sar => sar.reference);
}

/**
 * Accounts frozen to protect them while the case was open (mules) open again once it is closed,
 * their cards with them, and a customer suspended for it is active.
 */
async function liftAmlFreeze(context, inv, why, reason = 'AML_INVESTIGATION') {
  const frozen = await coll(context, 'accounts').list(
    {
      conditionTree: {
        aggregator: 'And',
        conditions: [
          { field: 'customer_id', operator: 'Equal', value: inv.customer_id },
          { field: 'status', operator: 'Equal', value: 'FROZEN' },
          { field: 'freeze_reason', operator: 'Equal', value: reason },
        ],
      },
    },
    ['id', 'iban'],
  );
  await Promise.all(
    frozen.map(a =>
      patch(context, 'accounts', a.id, {
        status: 'ACTIVE',
        frozen_at: null,
        freeze_reason: null,
        freeze_note: null,
      }),
    ),
  );

  if (frozen.length) {
    const cards = coll(context, 'cards');
    const blocked = await cards.list(
      {
        conditionTree: {
          aggregator: 'And',
          conditions: [
            { field: 'account_id', operator: 'In', value: frozen.map(a => a.id) },
            { field: 'status', operator: 'Equal', value: 'BLOCKED' },
            { field: 'blocked_reason', operator: 'Equal', value: 'AML_FREEZE' },
            { field: 'expires_at', operator: 'After', value: now().slice(0, 10) },
          ],
        },
      },
      ['id'],
    );
    await Promise.all(
      blocked.map(c =>
        patch(context, 'cards', c.id, { status: 'ACTIVE', blocked_reason: null, blocked_at: null }),
      ),
    );
  }

  const customer = await one(context, 'customers', inv.customer_id, ['id', 'status']);
  const stillFrozen = await coll(context, 'accounts').list(
    {
      conditionTree: {
        aggregator: 'And',
        conditions: [
          { field: 'customer_id', operator: 'Equal', value: inv.customer_id },
          { field: 'status', operator: 'Equal', value: 'FROZEN' },
        ],
      },
    },
    ['id'],
  );

  if (customer?.status === 'SUSPENDED' && !stillFrozen.length) {
    await patch(context, 'customers', customer.id, { status: 'ACTIVE', updated_at: now() });
    await history(
      context,
      'CUSTOMERS',
      customer.id,
      ['SUSPENDED', 'ACTIVE'],
      `${inv.reference}: ${why}`,
    );
  }

  return frozen.map(a => a.iban);
}

async function closeInvestigation(context, inv, decision, reason) {
  await cancelOpenRequests(
    context,
    'investigation_id',
    inv.id,
    `Investigation closed: ${decision}`,
  );
  const dropped =
    decision === 'SAR_FILED'
      ? []
      : await discardDraftSar(context, inv, `Investigation closed: ${readable(decision)}`);
  await moveTo(
    context,
    'INVESTIGATIONS',
    inv,
    'CLOSED',
    { decision, decided_by: context.caller.email, decided_at: now() },
    reason || decision,
  );

  return dropped;
}

/** The transactions behind the case ticked for the SAR; none ticked: all of them, ticked now. */
async function sarLines(context, investigationId) {
  const attached = coll(context, 'investigation_transactions');
  const links = await attached.list(where('investigation_id', investigationId), [
    'transaction_id',
    'included_in_sar',
  ]);
  const ticked = links.filter(l => l.included_in_sar);

  if (!ticked.length && links.length) {
    await attached.update(where('investigation_id', investigationId), { included_in_sar: true });
  }

  const ids = (ticked.length ? ticked : links).map(l => l.transaction_id);
  if (!ids.length) return [];

  return coll(context, 'transactions').list(where('id', ids), [
    'amount',
    'created_at',
    'description',
  ]);
}

const findSar = async (context, investigationId, status) =>
  (
    await coll(context, 'sar_reports').list(
      {
        conditionTree: {
          aggregator: 'And',
          conditions: [
            { field: 'investigation_id', operator: 'Equal', value: investigationId },
            { field: 'status', operator: 'In', value: status },
          ],
        },
      },
      ['id', 'reference', 'status'],
    )
  )[0];

function assign(collection) {
  collection.addAction('Assign', {
    scope: 'Single',
    form: [
      {
        label: 'Operator email',
        type: 'String',
        isRequired: true,
        defaultValue: context => context.caller.email,
      },
    ],
    execute: async (context, resultBuilder) => {
      const [inv, closed] = await openInvestigation(context);
      if (closed) return resultBuilder.error(closed);
      const operator = context.formValues['Operator email'];

      if (inv.status === 'OPEN') {
        await moveTo(context, 'INVESTIGATIONS', inv, 'IN_PROGRESS', { assigned_to: operator });
      } else {
        await context.collection.update(context.filter, { assigned_to: operator });
      }

      return resultBuilder.success(`Investigation ${inv.reference} assigned to ${operator}.`);
    },
  });
}

function requestInformation(collection) {
  collection.addAction('Request information', {
    scope: 'Single',
    form: [
      // Neutral wording: telling the customer about the investigation is "tipping off", an offence.
      {
        label: 'Questions',
        type: 'String',
        widget: 'TextArea',
        isRequired: true,
        defaultValue: ROUTINE_CHECK,
      },
      { label: 'Channel', type: 'Enum', enumValues: ['APP', 'EMAIL'], defaultValue: 'APP' },
      { label: 'Due in (days)', type: 'Number', defaultValue: 7 },
    ],
    execute: async (context, resultBuilder) => {
      if (badDueIn(context.formValues['Due in (days)'])) return resultBuilder.error(DUE_IN_ERROR);
      const [inv, closed] = await openInvestigation(context);
      if (closed) return resultBuilder.error(closed);

      if (inv.status === 'PENDING_MLRO') {
        return resultBuilder.error(`Investigation ${inv.reference} is with the MLRO.`);
      }

      const { Questions: questions, Channel: channel } = context.formValues;
      const rfi = await sendRequest(context, {
        customerId: inv.customer_id,
        serves: 'INVESTIGATION',
        links: { investigation_id: inv.id },
        questions,
        channel,
        dueIn: context.formValues['Due in (days)'],
      });

      if (inv.status !== 'WAITING_INFORMATION') {
        await moveTo(context, 'INVESTIGATIONS', inv, 'WAITING_INFORMATION', {}, rfi.reference);
      }

      return resultBuilder.success(
        `${rfi.reference} sent to the customer (routine check wording).`,
        {
          html: resultCard({
            eyebrow: `Investigation ${inv.reference} · request for information`,
            title: `${rfi.reference} sent to ${await nameOf(context, inv.customer_id)}`,
            status: ['Waiting for the customer', 'amber'],
            rows: [
              ['Channel', channel === 'EMAIL' ? 'Email' : 'In the app'],
              ['Sent', frDate(rfi.sent_at)],
              ['Answer due', frDate(rfi.due_at)],
              ['Questions', questions],
              ['Case', `${readable(inv.status)} → waiting for information`],
            ],
            note:
              'Routine check wording: the customer is never told about the investigation. The case ' +
              'leaves "Open investigations" while it waits for the answer.',
          }),
        },
      );
    },
  });
}

function requestDueDiligence(collection) {
  collection.addAction('Request enhanced due diligence', {
    scope: 'Single',
    form: [{ label: 'Reason', type: 'String', widget: 'TextArea' }],
    execute: async (context, resultBuilder) => {
      const [inv, closed] = await openInvestigation(context);
      if (closed) return resultBuilder.error(closed);

      if (inv.status === 'PENDING_MLRO') {
        return resultBuilder.error(`Investigation ${inv.reference} is with the MLRO.`);
      }

      const [asked] = await coll(context, 'kyc_cases').list(
        {
          conditionTree: {
            aggregator: 'And',
            conditions: [
              { field: 'investigation_id', operator: 'Equal', value: inv.id },
              { field: 'status', operator: 'NotIn', value: ['APPROVED', 'REJECTED'] },
            ],
          },
        },
        ['reference', 'type', 'status', 'due_at', 'notes'],
      );
      // A review this case opened already (remediation) is the one to wait for: no second one.
      const customer = await one(context, 'customers', inv.customer_id, ['risk_rating']);
      const kyc =
        asked ||
        (await openCase(context, 'kyc_cases', 'KYC', {
          customer_id: inv.customer_id,
          type: 'EVENT_REVIEW',
          trigger: 'AML_INVESTIGATION',
          status: 'OPEN',
          investigation_id: inv.id,
          risk_before: customer?.risk_rating || null,
          notes: context.formValues.Reason || `Enhanced due diligence asked by ${inv.reference}`,
          opened_at: now(),
          due_at: iso(daysFromNow(30)),
          updated_at: now(),
        }));

      // The case waits for the review, out of the analyst queue.
      await moveTo(
        context,
        'INVESTIGATIONS',
        inv,
        'WAITING_INFORMATION',
        {},
        `Waiting for the KYC review ${kyc.reference}`,
      );

      return resultBuilder.success(
        `${kyc.reference} ${asked ? 'was open already' : 'opened'} for the onboarding desk; ${
          inv.reference
        } waits for it, out of the analyst queue.`,
        {
          html: resultCard({
            eyebrow: `Investigation ${inv.reference} · enhanced due diligence`,
            title: `KYC review ${kyc.reference} ${asked ? 'already open' : 'opened'}`,
            status: ['Waiting for the KYC review', 'amber'],
            rows: [
              ['Customer', await nameOf(context, inv.customer_id)],
              ['Review', `${readable(kyc.type)} · ${readable(kyc.status)}`],
              ['Due', frDate(kyc.due_at)],
              ['Reason', kyc.notes],
              ['Case', `${readable(inv.status)} → waiting for the KYC review`],
            ],
            note:
              'The onboarding desk finds the review in "Other KYC reviews". The case leaves "Open ' +
              'investigations" until the review is decided.',
          }),
        },
      );
    },
  });
}

const ACTIVITY_FR = {
  STRUCTURING: 'Fractionnement des dépôts (structuring)',
  RAPID_MOVEMENT: 'Transit rapide des fonds',
  UNUSUAL_VOLUME: 'Volume inhabituel au regard du profil',
  HIGH_RISK_COUNTRY: 'Flux avec un pays à haut risque',
  SANCTIONS_MATCH: 'Lien avec une personne sous sanctions',
  SUSPICIOUS_PATTERN: 'Schéma d’opérations suspect',
};

/** The SAR draft as a PDF the MLRO can read before filing it. */
async function sarPdf(context, sar, inv, lines) {
  const customer = await one(context, 'customers', inv.customer_id, [
    'display_name',
    'reference',
    'customer_type',
  ]);
  const transactions = [...lines].sort((a, b) =>
    String(a.created_at).localeCompare(String(b.created_at)),
  );

  return pdf(
    sarFile({
      sar,
      customer: customer || {},
      investigation: inv,
      transactions,
      activity: ACTIVITY_FR[sar.activity_type] || sar.activity_type,
    }),
  );
}

function draftSar(collection) {
  collection.addAction('Draft SAR', {
    scope: 'Single',
    // The result is the draft as a PDF: the case moves to the MLRO before the file is returned.
    generateFile: true,
    form: [
      {
        label: 'Activity type',
        type: 'Enum',
        enumValues: enumOf('sar_reports', 'activity_type'),
        defaultValue: 'SUSPICIOUS_PATTERN',
      },
    ],
    execute: async (context, resultBuilder) => {
      const [inv, closed] = await openInvestigation(context);
      if (closed) return resultBuilder.error(closed);
      const existing = await findSar(context, inv.id, ['DRAFT', 'SUBMITTED', 'ACKNOWLEDGED']);
      if (existing) return resultBuilder.error(`${existing.reference} exists already.`);
      const lines = await sarLines(context, inv.id);
      if (!lines.length) return resultBuilder.error('No transaction is attached to the case.');
      const dates = lines.map(tx => String(tx.created_at).slice(0, 10)).sort();
      const [from, to] = [dates[0], dates[dates.length - 1]];
      const total = round2(lines.reduce((sum, tx) => sum + Number(tx.amount), 0));
      const sar = await openCase(context, 'sar_reports', 'SAR', {
        customer_id: inv.customer_id,
        investigation_id: inv.id,
        activity_type: context.formValues['Activity type'] || 'SUSPICIOUS_PATTERN',
        activity_start_date: from,
        activity_end_date: to,
        total_amount: total,
        transaction_count: lines.length,
        currency: 'EUR',
        narrative: `${inv.summary || ''} ${
          lines.length
        } transactions between ${from} and ${to}, ${euros(total)} in total.`.trim(),
        status: 'DRAFT',
        created_at: now(),
        updated_at: now(),
      });
      await cancelOpenRequests(context, 'investigation_id', inv.id, 'Case sent to the MLRO');
      await moveTo(context, 'INVESTIGATIONS', inv, 'PENDING_MLRO', { sent_to_mlro_at: now() });

      return resultBuilder.file(
        await sarPdf(context, sar, inv, lines),
        `${sar.reference}-draft.pdf`,
        'application/pdf',
      );
    },
  });
}

/** What TRACFIN's ERMES portal hands back on filing: a declaration number, fixed per report. */
const ermesNumber = sar => `ERMES-${new Date().getUTCFullYear()}-${digitsOf(sar.id, 7)}`;

const SAR_FREEZE_NOTE = sar => `SAR filed: waiting for TRACFIN (${sar.reference})`;

/**
 * The rule: once a SAR is filed, every open account of the customer stays frozen until TRACFIN
 * answers, their cards blocked with them. A sanctions or authority freeze keeps its own reason.
 */
async function sarFreeze(context, inv, sar) {
  const accounts = await coll(context, 'accounts').list(where('customer_id', inv.customer_id), [
    'id',
    'iban',
    'status',
    'freeze_reason',
  ]);
  const ours = accounts.filter(
    a =>
      ['ACTIVE', 'DORMANT'].includes(a.status) ||
      (a.status === 'FROZEN' && ['AML_INVESTIGATION', 'FRAUD_SUSPICION'].includes(a.freeze_reason)),
  );
  await Promise.all(
    ours.map(a =>
      patch(context, 'accounts', a.id, {
        status: 'FROZEN',
        frozen_at: now(),
        freeze_reason: 'SAR_FILED',
        freeze_note: SAR_FREEZE_NOTE(sar),
      }),
    ),
  );

  if (ours.length) {
    await coll(context, 'cards').update(
      {
        conditionTree: {
          aggregator: 'And',
          conditions: [
            { field: 'account_id', operator: 'In', value: ours.map(a => a.id) },
            { field: 'status', operator: 'In', value: ['ACTIVE', 'PENDING'] },
          ],
        },
      },
      { status: 'BLOCKED', blocked_reason: 'AML_FREEZE', blocked_at: now() },
    );
  }

  const other = accounts.filter(a => a.status === 'FROZEN' && !ours.includes(a));

  return { frozen: ours.map(a => a.iban), other };
}

function fileSar(collection) {
  collection.addAction('File SAR', {
    scope: 'Single',
    execute: async (context, resultBuilder) => {
      const [inv, closed] = await openInvestigation(context);
      if (closed) return resultBuilder.error(closed);
      const sar = await findSar(context, inv.id, ['DRAFT']);
      if (!sar) return resultBuilder.error('No draft SAR on this case: run "Draft SAR" first.');
      const declaration = ermesNumber(sar);
      await patch(context, 'sar_reports', sar.id, {
        status: 'SUBMITTED',
        filed_at: now(),
        filed_by: context.caller.email,
        fiu_reference: declaration,
        updated_at: now(),
      });
      await history(
        context,
        'SAR_REPORTS',
        sar.id,
        ['DRAFT', 'SUBMITTED'],
        `Filed with TRACFIN: ${declaration}`,
      );
      await closeInvestigation(context, inv, 'SAR_FILED', `${sar.reference} filed`);
      const { frozen, other } = await sarFreeze(context, inv, sar);
      const freeze = frozen.length
        ? ` Frozen until TRACFIN answers: ${frozen.join(', ')}.`
        : ' No open account to freeze.';
      const filed = await one(context, 'sar_reports', sar.id, [
        'reference',
        'total_amount',
        'transaction_count',
        'activity_start_date',
        'activity_end_date',
      ]);

      return resultBuilder.success(
        `${sar.reference} filed with ${PROVIDERS.tracfin} (simulated): declaration ${declaration}.${freeze}`,
        {
          html: resultCard({
            eyebrow: resultsFrom(PROVIDERS.tracfin, 'suspicious activity report'),
            title: `${sar.reference} filed`,
            status: ['Submitted', 'green'],
            rows: [
              ['Declaration number', declaration],
              ['Customer', await nameOf(context, inv.customer_id)],
              [
                'Period',
                `${frDate(filed.activity_start_date)} to ${frDate(filed.activity_end_date)}`,
              ],
              ['Transactions', String(filed.transaction_count)],
              ['Total', euros(filed.total_amount)],
              ['Case', `${inv.reference} closed: SAR filed`],
              [
                'Frozen until TRACFIN answers',
                frozen.length ? frozen.join(', ') : 'No open account',
              ],
              [
                'Frozen for another reason',
                other.length
                  ? other.map(a => `${a.iban} (${readable(a.freeze_reason)})`).join(', ')
                  : null,
              ],
              ['Filed by', context.caller.email],
            ],
            note:
              `Every account of the customer stays frozen, its cards blocked, until TRACFIN answers. ` +
              `Record its answer with "Record TRACFIN answer" on ${sar.reference}; until then the SAR ` +
              'waits in "Waiting for TRACFIN".',
          }),
        },
      );
    },
  });
}

function sendBack(collection) {
  collection.addAction('Send back to the analyst', {
    scope: 'Single',
    form: [
      {
        label: 'Reason',
        type: 'String',
        widget: 'TextArea',
        isRequired: true,
        description: 'What the analyst must add or check before the SAR comes back',
      },
    ],
    execute: async (context, resultBuilder) => {
      const [inv, closed] = await openInvestigation(context);
      if (closed) return resultBuilder.error(closed);

      if (inv.status !== 'PENDING_MLRO') {
        return resultBuilder.error(`Investigation ${inv.reference} is not with the MLRO.`);
      }

      const reason = context.formValues.Reason;
      const dropped = await discardDraftSar(context, inv, `Sent back by the MLRO: ${reason}`);
      await moveTo(
        context,
        'INVESTIGATIONS',
        inv,
        'IN_PROGRESS',
        { sent_to_mlro_at: null },
        reason,
      );
      const draft = dropped.length ? ` Draft ${dropped.join(', ')} discarded.` : '';

      return resultBuilder.success(`${inv.reference} is back in the analysts' queue.${draft}`, {
        html: resultCard({
          eyebrow: 'Decision of the MLRO',
          title: `${inv.reference} sent back to the analyst`,
          status: ['Back with the analyst', 'amber'],
          rows: [
            ['MLRO', context.caller.email],
            ['Customer', await nameOf(context, inv.customer_id)],
            ['What to add', reason],
            ['Draft SAR', dropped.length ? `${dropped.join(', ')} discarded` : 'None on file'],
            ['Case', 'waiting for the MLRO → in progress'],
            ['Analyst', inv.assigned_to || 'nobody assigned: the next one who takes it'],
          ],
          note:
            'The case is back in "Open investigations"; the analyst reads your reason in "Case · ' +
            'Status" and drafts the SAR again.',
        }),
      });
    },
  });
}

function closeWithoutSar(collection) {
  collection.addAction('Close without SAR', {
    scope: 'Single',
    form: [
      {
        label: 'Reason',
        type: 'String',
        widget: 'TextArea',
        isRequired: true,
        description: 'Why no SAR: what explains the activity',
        defaultValue:
          "No suspicion confirmed after review: the activity is explained by the customer's profile.",
      },
    ],
    execute: async (context, resultBuilder) => {
      const [inv, closed] = await openInvestigation(context);
      if (closed) return resultBuilder.error(closed);
      const dropped = await closeInvestigation(context, inv, 'NO_SAR', context.formValues.Reason);
      const lifted = await liftAmlFreeze(context, inv, 'no SAR');
      const freeze = lifted.length ? ` Accounts unfrozen: ${lifted.join(', ')}.` : '';

      return resultBuilder.success(`Investigation ${inv.reference} closed without SAR.${freeze}`, {
        html: resultCard({
          eyebrow: `Investigation decision · ${context.caller.email}`,
          title: `${inv.reference} closed without SAR`,
          status: ['Closed, no SAR', 'green'],
          rows: [
            ['Customer', await nameOf(context, inv.customer_id)],
            ['Opened for', inv.summary],
            ['Reason', context.formValues.Reason],
            ['Sign-off', 'Needs the MLRO’s approval (role setting) before it runs'],
            ['Accounts unfrozen', lifted.length ? lifted.join(', ') : 'None frozen for this case'],
            ['Accounts now', await accountsNow(context, inv.customer_id)],
            ['Draft SAR', dropped.length ? `${dropped.join(', ')} discarded` : null],
          ],
          note: 'The case is closed and leaves every queue: nothing goes to TRACFIN.',
        }),
      });
    },
  });
}

/** Not a customer yet: the relationship ends by refusing the onboarding, nothing to close. */
async function refuseOnboarding(context, inv, reason) {
  const [kyc] = await coll(context, 'kyc_cases').list(
    {
      conditionTree: {
        aggregator: 'And',
        conditions: [
          { field: 'customer_id', operator: 'Equal', value: inv.customer_id },
          { field: 'type', operator: 'Equal', value: 'ONBOARDING' },
          { field: 'status', operator: 'NotIn', value: ['APPROVED', 'REJECTED'] },
        ],
      },
    },
    ['id', 'reference', 'status'],
  );
  const why = `Refused after investigation ${inv.reference}${reason ? `: ${reason}` : ''}`;

  if (kyc) {
    await patch(context, 'kyc_cases', kyc.id, {
      status: 'REJECTED',
      rejection_reason: why,
      rejection_code: inv.type === 'IDENTITY_FRAUD' ? 'SYNTHETIC_IDENTITY' : 'RISK_APPETITE',
      decided_by: context.caller.email,
      resolved_at: now(),
      updated_at: now(),
    });
    await history(context, 'KYC_CASES', kyc.id, [kyc.status, 'REJECTED'], why);
  }

  // Refused, never a customer: DECLINED (refusals.ts).
  await patch(context, 'customers', inv.customer_id, { status: 'DECLINED', updated_at: now() });
  await history(context, 'CUSTOMERS', inv.customer_id, ['ONBOARDING', 'DECLINED'], why);

  return kyc?.reference;
}

const customerAccounts = (context, customerId) =>
  coll(context, 'accounts').list(where('customer_id', customerId), [
    'id',
    'iban',
    'balance',
    'status',
    'freeze_reason',
  ]);

/** Closing pays the balance out: never while an asset freeze or a SAR freeze holds it. */
function exitRefusal(accounts) {
  const held = reason =>
    accounts
      .filter(a => a.freeze_reason === reason)
      .map(a => a.iban)
      .join(', ');

  if (held('SANCTIONS')) {
    return `${held(
      'SANCTIONS',
    )} frozen under a sanctions asset freeze: closing would pay out frozen funds. The accounts stay frozen until the DG Trésor says otherwise.`;
  }

  if (held('SAR_FILED')) {
    return `${held(
      'SAR_FILED',
    )} frozen since a SAR was filed: closing would pay out the funds before TRACFIN answers. Record TRACFIN's answer on the SAR (it can be an exit).`;
  }

  return null;
}

/** The closure the closure team takes from here, the bank's decision (a risk exit). */
function openRiskExit(context, inv, accounts) {
  // The notice (two months for a person, by law) starts when the approved letter goes out:
  // notice_sent_at and notice_end_date are filled together at that step, not here.
  return openCase(context, 'closures', 'CLO', {
    customer_id: inv.customer_id,
    initiated_by: 'BANK',
    reason: 'RISK_EXIT',
    investigation_id: inv.id,
    requested_at: now(),
    balance_to_return: round2(
      accounts.filter(a => a.status !== 'CLOSED').reduce((sum, a) => sum + Number(a.balance), 0),
    ),
    status: 'REQUESTED',
  });
}

function exitRelationship(collection) {
  collection.addAction('Exit relationship', {
    scope: 'Single',
    form: [{ label: 'Reason', type: 'String', widget: 'TextArea' }],
    execute: async (context, resultBuilder) => {
      const [inv, closed] = await openInvestigation(context);
      if (closed) return resultBuilder.error(closed);
      const { Reason: reason } = context.formValues;
      const customer = await one(context, 'customers', inv.customer_id, [
        'status',
        'customer_type',
      ]);

      if (['PROSPECT', 'ONBOARDING'].includes(customer?.status)) {
        const kyc = await refuseOnboarding(context, inv, reason);
        await closeInvestigation(context, inv, 'EXIT_RELATIONSHIP', reason);

        return resultBuilder.success(
          `Investigation closed; not a customer yet: onboarding ${kyc || ''} refused.`,
          {
            html: resultCard({
              eyebrow: `Investigation decision · ${context.caller.email}`,
              title: `${inv.reference} closed: onboarding refused`,
              status: ['Relationship ended', 'red'],
              rows: [
                ['Customer', await nameOf(context, inv.customer_id)],
                ['Onboarding', kyc ? `${kyc} rejected` : 'no onboarding case open'],
                ['Customer status', `${readable(customer.status)} → offboarded`],
                ['Reason', reason],
              ],
              note: 'Not a customer yet: no account to close, nothing to pay out.',
            }),
          },
        );
      }

      const accounts = await customerAccounts(context, inv.customer_id);
      const refusal = exitRefusal(accounts);

      if (refusal) {
        return resultBuilder.error(refusal, {
          html: resultCard({
            eyebrow: `Investigation decision · ${context.caller.email}`,
            title: `${inv.reference}: exit refused`,
            status: ['Refused', 'red'],
            rows: [
              ['Customer', await nameOf(context, inv.customer_id)],
              ['Accounts now', await accountsNow(context, inv.customer_id)],
            ],
            note: refusal,
          }),
        });
      }

      const closure = await openRiskExit(context, inv, accounts);
      await closeInvestigation(context, inv, 'EXIT_RELATIONSHIP', reason);
      const person = customer?.customer_type !== 'BUSINESS';
      const owes = closure.balance_to_return < 0;

      return resultBuilder.success(
        `Investigation closed, ${closure.reference} opened: the closure team sends the notice.`,
        {
          html: resultCard({
            eyebrow: `Investigation decision · ${context.caller.email}`,
            title: `${inv.reference} closed: ${closure.reference} opened`,
            status: ['Relationship ended', 'red'],
            rows: [
              ['Customer', await nameOf(context, inv.customer_id)],
              ['Closure', `${closure.reference} · risk exit · requested`],
              [
                'Notice',
                person
                  ? '2 months, by law for a personal account'
                  : 'The notice in the account agreement',
              ],
              [
                'Balance',
                owes
                  ? `The customer owes ${euros(-closure.balance_to_return)}`
                  : `${euros(closure.balance_to_return)} paid out to the customer at closure`,
              ],
              ['Debt', owes ? 'Recovered by the collections team once the accounts close' : null],
              ['Accounts now', await accountsNow(context, inv.customer_id)],
              ['Reason', reason],
            ],
            note: `The closure team sends the notice letter, then closes the accounts${
              owes ? '; collections recovers what is owed.' : ' and pays the balance out.'
            }`,
          }),
        },
      );
    },
  });
}

// ---- SARs: TRACFIN's answer ----------------------------------------------------------------------

const TRACFIN_ANSWERS = {
  'Release the accounts': 'RELEASE_ACCOUNTS',
  'Keep them blocked (judicial seizure, prosecutor)': 'KEEP_BLOCKED',
  'Exit the relationship': 'EXIT_RELATIONSHIP',
};
const ANSWER_TITLES = {
  RELEASE_ACCOUNTS: ['Accounts released', 'green'],
  KEEP_BLOCKED: ['Accounts kept blocked', 'red'],
  EXIT_RELATIONSHIP: ['Relationship ended', 'red'],
};

/** Accounts kept blocked on TRACFIN's answer: frozen for the authority now, no longer for the SAR. */
async function keepBlocked(context, customerId, sar, note) {
  const frozen = await coll(context, 'accounts').list(
    {
      conditionTree: {
        aggregator: 'And',
        conditions: [
          { field: 'customer_id', operator: 'Equal', value: customerId },
          { field: 'freeze_reason', operator: 'Equal', value: 'SAR_FILED' },
        ],
      },
    },
    ['id', 'iban'],
  );
  await Promise.all(
    frozen.map(a =>
      patch(context, 'accounts', a.id, {
        freeze_reason: 'AUTHORITY_REQUEST',
        freeze_note: `Kept blocked on TRACFIN's answer to ${sar.reference}${
          note ? `: ${note}` : ''
        }`,
      }),
    ),
  );

  return frozen.map(a => a.iban);
}

function recordTracfinAnswer(collection) {
  collection.addAction('Record TRACFIN answer', {
    scope: 'Single',
    form: [
      {
        label: 'Answer',
        type: 'Enum',
        enumValues: Object.keys(TRACFIN_ANSWERS),
        isRequired: true,
      },
      { label: 'Note', type: 'String', widget: 'TextArea', description: 'What TRACFIN said' },
    ],
    execute: async (context, resultBuilder) => {
      const sar = await context.getRecord([
        'id',
        'reference',
        'status',
        'customer_id',
        'investigation_id',
        'fiu_reference',
      ]);

      if (!['SUBMITTED', 'ACKNOWLEDGED'].includes(sar.status)) {
        return resultBuilder.error(
          `${sar.reference} is ${readable(
            sar.status,
          )}: only a SAR filed with TRACFIN gets an answer.`,
        );
      }

      const answer = TRACFIN_ANSWERS[context.formValues.Answer];
      const note = context.formValues.Note || null;
      const inv = (await one(context, 'investigations', sar.investigation_id, [
        'id',
        'reference',
        'customer_id',
      ])) || { customer_id: sar.customer_id };
      const accounts = await customerAccounts(context, sar.customer_id);
      let released = [];
      let kept = [];
      let closure = null;

      if (answer === 'KEEP_BLOCKED') {
        kept = await keepBlocked(context, sar.customer_id, sar, note);
      } else {
        // An exit pays the balance out at closure: never through a sanctions freeze.
        const sanctioned = exitRefusal(accounts.filter(a => a.freeze_reason === 'SANCTIONS'));
        if (answer === 'EXIT_RELATIONSHIP' && sanctioned) return resultBuilder.error(sanctioned);
        released = await liftAmlFreeze(
          context,
          inv,
          `TRACFIN answered ${sar.reference}`,
          'SAR_FILED',
        );
        if (answer === 'EXIT_RELATIONSHIP') closure = await openRiskExit(context, inv, accounts);
      }

      await patch(context, 'sar_reports', sar.id, {
        status: 'ANSWERED',
        tracfin_answer: answer,
        tracfin_answered_at: now(),
        tracfin_note: note,
        updated_at: now(),
      });
      await history(
        context,
        'SAR_REPORTS',
        sar.id,
        [sar.status, 'ANSWERED'],
        `TRACFIN: ${readable(answer)}${note ? ` (${note})` : ''}`,
      );
      const [title, tone] = ANSWER_TITLES[answer];
      const next = {
        RELEASE_ACCOUNTS: 'The accounts and their cards work again. Nothing else to do.',
        KEEP_BLOCKED:
          'The accounts stay frozen for the authority; the legal team follows the seizure.',
        EXIT_RELATIONSHIP: `The closure team takes ${closure?.reference} from here: notice, then closing.`,
      }[answer];

      return resultBuilder.success(
        `${sar.reference}: TRACFIN's answer recorded (${title.toLowerCase()}).`,
        {
          html: resultCard({
            eyebrow: `TRACFIN's answer · recorded by ${context.caller.email}`,
            title: `${sar.reference}: ${title.toLowerCase()}`,
            status: [title, tone],
            rows: [
              ['Customer', await nameOf(context, sar.customer_id)],
              ['Declaration', sar.fiu_reference],
              ['Investigation', inv.reference],
              ['Answer', context.formValues.Answer],
              ['TRACFIN said', note],
              ['Accounts released', released.length ? released.join(', ') : null],
              ['Kept blocked', kept.length ? kept.join(', ') : null],
              ['Closure', closure ? `${closure.reference} · risk exit · requested` : null],
              ['Accounts now', await accountsNow(context, sar.customer_id)],
            ],
            note: next,
          }),
        },
      );
    },
  });
}

function customizeInvestigations(collection) {
  assign(collection);
  requestInformation(collection);
  requestDueDiligence(collection);
  draftSar(collection);
  fileSar(collection);
  sendBack(collection);
  closeWithoutSar(collection);
  exitRelationship(collection);
}

// ---- outgoing transfers --------------------------------------------------------------------------

const CALL_OUTCOMES = ['Confirmed by customer', 'Not reached', 'Customer denies'];
const CALL_CODES = {
  'Confirmed by customer': 'CONFIRMED',
  'Not reached': 'NOT_REACHED',
  'Customer denies': 'DENIED',
};
// What the note says when the operator picks another outcome than the scripted answer.
const CALL_NOTES = {
  CONFIRMED: 'The customer confirms the transfer.',
  DENIED: 'The customer says they did not make this transfer.',
  NOT_REACHED: null,
};
const VOP_RESULTS = {
  MATCH: ['Name matches the account', 'green'],
  CLOSE_MATCH: ['Close match', 'amber'],
  NO_MATCH: ['No match', 'red'],
  NOT_POSSIBLE: ['Check not possible', 'amber'],
};
const payeeName = f => f.payee?.counterparty?.name || 'the payee';
const payeeLine = f =>
  f.payee ? `${payeeName(f)} · ${f.payee.iban} · ${f.payee.bank_name}` : null;

/** The transfer waiting for validation, with what is known about it (evidence/transfers.ts). */
async function pendingTransfer(context) {
  const transfer = await context.getRecord(TRANSFER_FIELDS);
  const list = transferReader(context.dataSource);
  const f = await transferFacts(list, transfer);
  const waiting =
    transfer.validation_status === 'PENDING' && ['PENDING', 'HELD'].includes(f?.tx.status);
  const error = waiting
    ? null
    : `This transfer is not waiting for validation (${transfer.validation_status}).`;

  return { transfer, f, list, error };
}

/** Verification of Payee: the payee's bank says whether the name given matches the account. */
async function checkPayee(context, resultBuilder) {
  const { transfer, f, error } = await pendingTransfer(context);
  if (error) return resultBuilder.error(error);
  const { payee } = f;
  // The other bank answers from its own file: what the payee check found when the payee was added.
  const result = payee.payee_check || 'NOT_POSSIBLE';
  const ref = `VOP-${digitsOf(transfer.id, 8)}`;
  await history(
    context,
    'OUTGOING_TRANSFERS',
    transfer.id,
    [transfer.payee_check, result],
    `${ref} · name sent: ${payeeName(f)} · ${payee.bank_name}`,
    'payee_check',
  );
  const holder = {
    MATCH: payeeName(f),
    CLOSE_MATCH: payee.payee_check_name,
    NO_MATCH: 'not given: the name does not match',
  }[result];
  const html = resultCard({
    eyebrow: resultsFrom(PROVIDERS.payeeCheck, 'name and IBAN check'),
    title: `${VOP_RESULTS[result][0]}: ${payeeName(f)}`,
    status: [codeText(result), VOP_RESULTS[result][1]],
    rows: [
      ['Name given by the customer', payeeName(f)],
      ['Name on the account', holder],
      ['IBAN', `${payee.iban} · ${ibanValid(payee.iban) ? 'valid' : 'invalid check digits'}`],
      ['Bank', `${payee.bank_name} (${payee.bic})`],
      ['Check', ref],
    ],
    note:
      result === 'NO_MATCH'
        ? 'Money sent to an account in another name rarely comes back: this is how invoice and ' +
          'impersonation scams work.'
        : null,
  });

  return resultBuilder.success(
    `Payee check: ${VOP_RESULTS[result][0].toLowerCase()} (${ref}). (${
      PROVIDERS.payeeCheck
    }, simulated)`,
    { html },
  );
}

/** The call back, through the phone system: the number on file, and what the customer said. */
async function callBack(context, resultBuilder) {
  const { transfer, f, list, error } = await pendingTransfer(context);
  if (error) return resultBuilder.error(error);
  const phone = await phoneToCall(list, f.account.customer_id, f.tx.created_at);
  const { Outcome: outcome } = context.formValues;
  const code = CALL_CODES[outcome];
  // The note offered matches the scripted answer: with another outcome, it is not what was said.
  const [scripted, scriptedNote] = scriptedAnswer(f);
  let note = context.formValues.Note || null;
  if (outcome !== scripted && note === scriptedNote) note = CALL_NOTES[code];
  const seconds = 60 + (Number(digitsOf(transfer.id, 3)) % 180);
  const length =
    code === 'NOT_REACHED'
      ? 'no answer, voicemail left'
      : `${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, '0')} s`;
  const callId = `AC-${digitsOf(transfer.transaction_id, 7)}`;
  await history(
    context,
    'OUTGOING_TRANSFERS',
    transfer.id,
    [null, code],
    `${note ? `"${note}" · ` : ''}${PROVIDERS.phone} call ${callId} to ${phone.number}, ${length}`,
    'call_back',
  );
  const html = resultCard({
    eyebrow: resultsFrom(PROVIDERS.phone, 'call back'),
    title: `${outcome}: ${f.customer.display_name}`,
    status: [codeText(code), { CONFIRMED: 'green', DENIED: 'red', NOT_REACHED: 'amber' }[code]],
    rows: [
      ['Number called', `${phone.number} (${phone.note})`],
      ['Call', `${callId} · ${length}`],
      ['What the customer said', note],
    ],
  });

  return resultBuilder.success(
    `Call to ${phone.number}: ${outcome}. (${PROVIDERS.phone}, simulated)`,
    {
      html,
    },
  );
}

/** What the operator writes when stopping a transfer, from what the checks found. */
async function rejectReason(context) {
  const transfer = await context.getRecord(TRANSFER_FIELDS);
  const list = transferReader(context.dataSource);
  const [call, vop] = await Promise.all([
    lastLine(list, transfer.id, 'call_back'),
    lastLine(list, transfer.id, 'payee_check'),
  ]);

  if (call?.new_value === 'DENIED') {
    return 'Customer denies making this transfer: account takeover suspected';
  }

  if (call?.new_value === 'NOT_REACHED') {
    return 'Customer not reached on the number on file: transfer stopped, they can send it again';
  }

  if (vop?.new_value === 'NO_MATCH') {
    const f = await transferFacts(list, transfer);

    return `Payee check: the account is not in the name of ${payeeName(
      f,
    )}. Check the IBAN with the payee, on a number you already know, before sending again`;
  }

  return 'Customer could not confirm the transfer on the call back';
}

/** A takeover the customer reported on the call back: the fraud team takes it from there. */
async function takeoverAlert(context, f, reason) {
  const alert = await openCase(context, 'alerts', 'ALR', {
    alert_type: 'NEW_DEVICE_NEW_PAYEE',
    category: 'ACCOUNT_TAKEOVER',
    source: 'MANUAL',
    created_by: context.caller.email,
    customer_id: f.account.customer_id,
    severity: 'CRITICAL',
    status: 'OPEN',
    triggered_at: now(),
    resolution_notes: reason,
  });
  await insert(context, 'alert_transactions', {
    alert_id: alert.id,
    transaction_id: f.tx.id,
    role: 'REPORTED',
  });

  return alert;
}

function customizeOutgoingTransfers(collection) {
  collection.addAction('Check the payee', { scope: 'Single', execute: checkPayee });

  collection.addAction('Call customer back', {
    scope: 'Single',
    form: [
      {
        label: 'Outcome',
        type: 'Enum',
        enumValues: CALL_OUTCOMES,
        isRequired: true,
        // In the demo, the customer answers the way their file says (a takeover victim denies).
        defaultValue: async context => {
          const transfer = await context.getRecord(TRANSFER_FIELDS);
          const f = await transferFacts(transferReader(context.dataSource), transfer);

          return f ? scriptedAnswer(f)[0] : CALL_OUTCOMES[0];
        },
      },
      {
        label: 'Note',
        type: 'String',
        defaultValue: async context => {
          const transfer = await context.getRecord(TRANSFER_FIELDS);
          const f = await transferFacts(transferReader(context.dataSource), transfer);

          return f ? scriptedAnswer(f)[1] : null;
        },
      },
    ],
    execute: callBack,
  });

  collection.addAction('Approve transfer', {
    scope: 'Single',
    execute: async (context, resultBuilder) => {
      const { transfer, f, list, error } = await pendingTransfer(context);
      if (error) return resultBuilder.error(error);
      const call = await lastLine(list, transfer.id, 'call_back');

      if (call?.new_value === 'DENIED') {
        return resultBuilder.error(
          'The customer denied this transfer on the call back: reject it.',
        );
      }

      const { tx } = f;
      const account = await one(context, 'accounts', tx.account_id, ['balance']);
      const balance = round2(Number(account.balance) - Number(tx.amount));
      const date = new Date();
      await context.collection.update(context.filter, {
        validation_status: 'APPROVED',
        validated_by: context.caller.email,
        validated_at: iso(date),
      });
      await history(
        context,
        'OUTGOING_TRANSFERS',
        transfer.id,
        ['PENDING', 'APPROVED'],
        null,
        'validation_status',
      );
      // The money was reserved when the transfer was asked: only the balance moves now.
      await patch(context, 'transactions', tx.id, {
        status: 'BOOKED',
        booked_at: iso(date),
        value_date: isoDate(date),
        balance_after: balance,
      });
      await patch(context, 'accounts', tx.account_id, { balance, last_activity_at: iso(date) });
      const vop = await lastLine(list, transfer.id, 'payee_check');

      return resultBuilder.success(
        `Transfer of ${euros(tx.amount)} to ${payeeName(f)} approved and sent.`,
        {
          html: resultCard({
            eyebrow: `Transfer validation · ${context.caller.email}`,
            title: `${euros(tx.amount)} sent to ${payeeName(f)}`,
            status: ['Approved and sent', 'green'],
            rows: [
              ['Customer', f.customer.display_name],
              ['From', f.account.iban],
              ['Payee', payeeLine(f)],
              ['Scheme', codeText(transfer.scheme)],
              ['Payee check', vop ? codeText(vop.new_value) : null],
              ['Call back', call ? codeText(call.new_value) : null],
              ['Balance after', euros(balance)],
            ],
            note: 'Booked on the statement now: the transfer leaves "Transfers to validate".',
          }),
        },
      );
    },
  });

  collection.addAction('Reject transfer', {
    scope: 'Single',
    form: [{ label: 'Reason', type: 'String', isRequired: true, defaultValue: rejectReason }],
    execute: async (context, resultBuilder) => {
      const { transfer, f, list, error } = await pendingTransfer(context);
      if (error) return resultBuilder.error(error);
      const { Reason: reason } = context.formValues;
      const { tx } = f;
      const account = await one(context, 'accounts', tx.account_id, ['available_balance']);
      await context.collection.update(context.filter, {
        validation_status: 'REJECTED',
        validated_by: context.caller.email,
        validated_at: now(),
        rejection_reason: reason,
      });
      await history(
        context,
        'OUTGOING_TRANSFERS',
        transfer.id,
        ['PENDING', 'REJECTED'],
        reason,
        'validation_status',
      );
      await patch(context, 'transactions', tx.id, {
        status: 'REJECTED',
        status_reason: `Transfer rejected: ${reason}`,
      });
      await patch(context, 'accounts', tx.account_id, {
        available_balance: round2(Number(account.available_balance) + Number(tx.amount)),
      });
      const call = await lastLine(list, transfer.id, 'call_back');
      const alert = call?.new_value === 'DENIED' ? await takeoverAlert(context, f, reason) : null;

      return resultBuilder.success(
        `Transfer rejected: ${euros(tx.amount)} available again.${
          alert ? ` ${alert.reference} opened for the fraud team (account takeover).` : ''
        }`,
        {
          html: resultCard({
            eyebrow: `Transfer validation · ${context.caller.email}`,
            title: `Transfer of ${euros(tx.amount)} to ${payeeName(f)} stopped`,
            status: ['Rejected', 'red'],
            rows: [
              ['Customer', f.customer.display_name],
              ['From', f.account.iban],
              ['Payee', payeeLine(f)],
              ['Reason', reason],
              ['Money', `${euros(tx.amount)} available again on the account`],
              ['Fraud alert', alert ? `${alert.reference} opened (account takeover)` : null],
            ],
            note: alert
              ? `The fraud team picks ${alert.reference} up in "Fraud and takeover alerts".`
              : 'Nothing left the account. The customer can send the transfer again once the reason is fixed.',
          }),
        },
      );
    },
  });
}

// ---- dispute requests ----------------------------------------------------------------------------

// Reason codes and SEPA codes: evidence/disputes.ts, which the workflows' evidence reads too.
// Wero settles over SEPA Instant, so a Wero payment is recalled like an instant transfer.
const SCHEMES = {
  TRANSFER: 'SCT',
  INSTANT_TRANSFER: 'SCT_INST',
  WERO: 'SCT_INST',
  DIRECT_DEBIT: 'SDD_CORE',
};
const DISPUTE = [
  'id',
  'reference',
  'status',
  'customer_id',
  'transaction_id',
  'amount',
  'reason',
  'payment_type',
  'card_transaction_id',
  'direct_debit_id',
  'outgoing_transfer_id',
  'requested_at',
  'transaction:account_id',
  'transaction:created_at',
];

const addBusinessDays = (date, n) => {
  const d = new Date(date);
  let left = n;

  while (left > 0) {
    d.setTime(d.getTime() + DAY);
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) left -= 1;
  }

  return d;
};

/** The disputed payment, listed on the new case too (the request's DISPUTED row). */
async function linkDisputed(context, dispute, links) {
  const rows = await coll(context, 'dispute_transactions').list(
    {
      conditionTree: {
        aggregator: 'And',
        conditions: [
          { field: 'dispute_request_id', operator: 'Equal', value: dispute.id },
          { field: 'role', operator: 'Equal', value: 'DISPUTED' },
        ],
      },
    },
    ['id', 'chargeback_id', 'sepa_dispute_id'],
  );
  // The request's row, unless it already lists another case: then the new case gets its own.
  const free = rows.find(r => !r.chargeback_id && !r.sepa_dispute_id);

  if (free) {
    await patch(context, 'dispute_transactions', free.id, links);
  } else {
    await listMove(context, dispute.transaction_id, 'DISPUTED', {
      dispute_request_id: dispute.id,
      ...links,
    });
  }
}

/**
 * The provisional credit on an unauthorised card payment (PSD2: by the next business day). French
 * practice: the other chargebacks (not received, wrong amount, duplicate...) are credited only once
 * won, so nothing is booked for them before the network decides.
 */
async function provisionalCredit(context, cb, accountId) {
  const merchant = await merchantOf(context, cb.transaction_id);
  const label = FRAUD_CODES.includes(cb.reason_code)
    ? 'REMBOURSEMENT OPERATION NON AUTORISEE CB'
    : 'CREDIT PROVISOIRE LITIGE CB';
  const tx = await book(context, accountId, 'CREDIT', Number(cb.amount), `${label} ${merchant}`);
  await patch(context, 'chargebacks', cb.id, {
    provisional_credit_issued: true,
    provisional_credit_transaction_id: tx.id,
  });
  await listMove(context, tx.id, 'PROVISIONAL_CREDIT', { chargeback_id: cb.id });

  return tx;
}

async function openChargeback(context, dispute) {
  if (dispute.payment_type !== 'CARD' || !dispute.card_transaction_id) {
    return [null, 'A chargeback is only for a card payment.'];
  }

  const reason = dispute.reason === 'SCAM' ? 'UNAUTHORIZED' : dispute.reason;
  if (!REASON_CODES[reason]) return [null, `No card network reason code for ${dispute.reason}.`];
  const payment = await one(context, 'card_transactions', dispute.card_transaction_id, [
    'card:network',
  ]);
  const { network } = payment.card;
  const [visa, visaLabel, mc, mcLabel] = REASON_CODES[reason];
  const due = new Date(new Date(dispute.transaction.created_at).getTime() + 120 * DAY);
  const cb = await openCase(context, 'chargebacks', 'CBK', {
    customer_id: dispute.customer_id,
    transaction_id: dispute.transaction_id,
    card_transaction_id: dispute.card_transaction_id,
    dispute_request_id: dispute.id,
    network,
    source: 'CUSTOMER_REQUEST',
    reason_code: network === 'VISA' ? visa : mc,
    reason_description: network === 'VISA' ? visaLabel : mcLabel,
    amount: dispute.amount,
    currency: 'EUR',
    status: 'INITIATED',
    assigned_to: context.caller.email,
    provisional_credit_issued: false,
    representment_deadline: iso(due),
    days_to_deadline: Math.ceil((due.getTime() - Date.now()) / DAY),
    is_overdue: due.getTime() < Date.now(),
    created_at: now(),
    updated_at: now(),
  });
  await linkDisputed(context, dispute, { chargeback_id: cb.id });

  if (FRAUD_CODES.includes(cb.reason_code)) {
    await provisionalCredit(context, cb, dispute.transaction.account_id);
  }

  return [cb, null];
}

async function openSepaDispute(context, dispute) {
  const scheme = SCHEMES[dispute.payment_type];
  if (!scheme) return [null, 'A SEPA dispute is only for a transfer or a direct debit.'];
  const debit = dispute.payment_type === 'DIRECT_DEBIT';
  // A transfer the customer did not make is recalled for fraud (FRAD); MD01 is a debit's code.
  let reason = SEPA_REASONS[dispute.reason] || 'CUSTOMER_REQUEST';
  if (!debit && reason === 'UNAUTHORISED') reason = 'FRAUD';
  let type = 'REQUEST_FOR_RECALL';
  if (debit) type = 'REFUND';
  else if (['FRAUD', 'UNAUTHORISED', 'DUPLICATE', 'TECHNICAL'].includes(reason)) type = 'RECALL';
  const row = await openCase(context, 'sepa_disputes', 'SEP', {
    customer_id: dispute.customer_id,
    transaction_id: dispute.transaction_id,
    direct_debit_id: dispute.direct_debit_id || null,
    outgoing_transfer_id: dispute.outgoing_transfer_id || null,
    dispute_request_id: dispute.id,
    scheme,
    type,
    side: 'WE_ASKED',
    reason,
    reason_code: SEPA_CODES[reason],
    amount: dispute.amount,
    requested_at: now(),
    response_due: isoDate(addBusinessDays(new Date(), 15)),
    status: 'OPEN',
    assigned_to: context.caller.email,
  });
  await linkDisputed(context, dispute, { sepa_dispute_id: row.id });
  // Unauthorised (PSD2, L133-18): refunded by the next business day whatever the other bank
  // answers; what the recall or refund brings back then goes to the bank.
  let refund = null;

  if (UNAUTHORISED.includes(dispute.reason)) {
    const payee = await merchantOf(context, dispute.transaction_id);
    refund = await book(
      context,
      dispute.transaction.account_id,
      'CREDIT',
      Number(dispute.amount),
      `REMBOURSEMENT OPERATION NON AUTORISEE ${payee}`,
    );
    await listMove(context, refund.id, 'REFUND', {
      dispute_request_id: dispute.id,
      sepa_dispute_id: row.id,
    });
  }

  // Sent at once through the interbank network: the case now waits for the other bank.
  await patch(context, 'sepa_disputes', row.id, { status: 'WAITING_OTHER_BANK' });
  await history(
    context,
    'SEPA_DISPUTES',
    row.id,
    ['OPEN', 'WAITING_OTHER_BANK'],
    `Sent through the ${PROVIDERS.sepa}`,
  );

  return [{ ...row, status: 'WAITING_OTHER_BANK', refund }, null];
}

/** The card processor's reference for a block, the same on every run for the card. */
const blockReference = cardId => `MQ-${digitsOf(cardId, 10).padStart(10, '0')}`;

/**
 * Blocks the card a payment was made with, through the card processor (simulated). A card
 * blocked already (stolen, blocked at intake) is left as it is: `blocked` says whether we did it.
 */
async function blockCard(context, cardTransactionId) {
  const payment = await one(context, 'card_transactions', cardTransactionId, [
    'card:id',
    'card:status',
    'card:network',
    'card:last_four_digits',
    'card:blocked_at',
    'card:blocked_reason',
  ]);
  const card = payment?.card;
  if (!card?.id) return null;
  if (!['ACTIVE', 'PENDING'].includes(card.status)) return { card, blocked: false };
  const blockedAt = now();
  await patch(context, 'cards', card.id, {
    status: 'BLOCKED',
    blocked_reason: 'FRAUD',
    blocked_at: blockedAt,
  });

  return { card: { ...card, blocked_at: blockedAt }, blocked: true };
}

/** What a card block says on a result: blocked now, or blocked already and why. */
function blockText({ card, blocked }) {
  const name = `${codeText(card.network)} card •••• ${card.last_four_digits}`;

  if (blocked) {
    return `${name} blocked (fraud) through the card processor, ref ${blockReference(
      card.id,
    )} (simulated)`;
  }

  return `${name} ${card.status.toLowerCase()} already${
    card.blocked_reason ? ` (${card.blocked_reason.toLowerCase()})` : ''
  }`;
}

/** BANK_REFUND: the bank gives the money back itself and closes the request. */
async function bankRefund(context, dispute) {
  const merchant = await merchantOf(context, dispute.transaction_id);
  const tx = await book(
    context,
    dispute.transaction.account_id,
    'CREDIT',
    Number(dispute.amount),
    `REMBOURSEMENT LITIGE ${merchant}`,
  );
  await listMove(context, tx.id, 'REFUND', { dispute_request_id: dispute.id });

  return [{ reference: `refund of ${euros(dispute.amount)}` }, null];
}

const ROUTES = {
  CHARGEBACK: openChargeback,
  SEPA_DISPUTE: openSepaDispute,
  BANK_REFUND: bankRefund,
};
const CLOSE_NOTES = {
  CONTACT_MERCHANT: 'Customer asked to contact the merchant first; can come back after 15 days.',
  DECLINED: 'Not eligible.',
  BANK_REFUND:
    'No chargeback right on this payment, so the bank refunded it and bears the loss (PSD2).',
};

/** What the new case says, by route: the network claim, the SEPA request or the refund. */
const ROUTE_DETAILS = {
  CHARGEBACK: cb => [
    ['Reason code', codeLine(cb)],
    ['Deadline to file with the network', frDate(cb.representment_deadline)],
    [
      'Provisional credit',
      FRAUD_CODES.includes(cb.reason_code)
        ? `${euros(cb.amount)} booked now (unauthorised payment, PSD2)`
        : 'None: credited only if the chargeback is won',
    ],
  ],
  SEPA_DISPUTE: row => [
    ['Scheme', codeText(row.scheme)],
    ['Request', `${codeText(row.type)} · ${row.reason_code}`],
    ['Sent through', `${PROVIDERS.sepa} (simulated)`],
    ['Other bank answers by', frDate(row.response_due)],
    [
      'Refund to the customer',
      row.refund ? `${euros(row.refund.amount)} booked now (unauthorised payment, PSD2)` : null,
    ],
  ],
  BANK_REFUND: (refund, dispute) => [
    ['Refund', `${euros(dispute.amount)} booked on the customer account now`],
  ],
};
// Who has the case once the request is routed, by route.
const ROUTE_NEXT = {
  CHARGEBACK: cb =>
    `${cb.reference} waits in "Chargebacks to file": file it with ${codeText(
      cb.network,
    )} before the deadline.`,
  SEPA_DISPUTE: row =>
    `${row.reference} now waits for the other bank's answer, due by ${frDate(row.response_due)}.`,
  BANK_REFUND: () => 'Request closed: the bank bears the loss, nothing else to do.',
  CONTACT_MERCHANT: () => 'Request closed: the customer can come back after 15 days.',
  DECLINED: () => 'Request closed: the customer receives the reason above.',
};
const ROUTE_TITLES = {
  CHARGEBACK: 'Chargeback opened',
  SEPA_DISPUTE: 'SEPA dispute opened',
  BANK_REFUND: 'Refunded by the bank',
  CONTACT_MERCHANT: 'Customer sent to the merchant',
  DECLINED: 'Dispute declined',
};

/** The disputed payment, for the card: merchant or payee, date, card ending. */
async function paidLine(context, dispute) {
  const [tx, payment] = await Promise.all([
    one(context, 'transactions', dispute.transaction_id, ['created_at', 'counterparty:name']),
    one(context, 'card_transactions', dispute.card_transaction_id, ['card:last_four_digits']),
  ]);
  const last4 = payment?.card?.last_four_digits;

  return [tx?.counterparty?.name, tx && frDate(tx.created_at), last4 && `card •••• ${last4}`]
    .filter(Boolean)
    .join(' · ');
}

function routeCard(dispute, route, opened, notes, block, { customer, paid }) {
  const routed = ['CHARGEBACK', 'SEPA_DISPUTE'].includes(route);
  const details = ROUTE_DETAILS[route] && opened ? ROUTE_DETAILS[route](opened, dispute) : [];

  return resultCard({
    eyebrow: `Dispute triage · ${dispute.reference}`,
    title: ROUTE_TITLES[route] || route,
    status: routed ? [`New case ${opened.reference}`, 'green'] : ['Request closed', 'grey'],
    rows: [
      ['Customer', customer],
      ['Disputed payment', paid],
      ['Disputed amount', euros(dispute.amount)],
      ['Customer reason', codeText(dispute.reason)],
      ['Payment', codeText(dispute.payment_type)],
      ['Route', codeText(route)],
      ...details,
      ['Card', block ? blockText(block) : null],
      ['Note', routed ? null : notes],
    ],
    note: ROUTE_NEXT[route] ? ROUTE_NEXT[route](opened) : null,
  });
}

// What the evidence needs to say why a request is declined (evidence/disputes.ts).
const DISPUTE_FILE = [...DISPUTE.filter(f => !f.includes(':')), 'merchant_contacted_at'];

/** The merchant first: the customer asks them, the request waits on the customer. */
async function askToContactMerchant(context, resultBuilder) {
  const dispute = await context.getRecord(DISPUTE);

  if (dispute.status !== 'NEW') {
    return resultBuilder.error(`${dispute.reference} is ${dispute.status}: not a new dispute.`);
  }

  const paid = await one(context, 'transactions', dispute.transaction_id, ['counterparty:name']);
  const merchant = paid?.counterparty?.name || 'the merchant';
  const rfi = await sendRequest(context, {
    customerId: dispute.customer_id,
    serves: 'DISPUTE_REQUEST',
    links: { dispute_request_id: dispute.id },
    questions:
      context.formValues.Questions ||
      `Before we open a claim, please contact ${merchant} and ask for a refund or a delivery date. ` +
        'Send us your order confirmation and their answer here, or tell us if they have not ' +
        'answered within 15 days.',
    dueIn: 15,
  });
  await moveTo(
    context,
    'DISPUTE_REQUESTS',
    dispute,
    'WAITING_CUSTOMER',
    { assigned_to: context.caller.email },
    `${rfi.reference} sent: contact the merchant first`,
  );

  return resultBuilder.success(
    `${rfi.reference} sent: ${dispute.reference} waits on the customer, out of New disputes.`,
    {
      html: resultCard({
        eyebrow: `Dispute triage · ${dispute.reference}`,
        title: 'Customer asked to contact the merchant',
        status: ['Waiting on the customer', 'amber'],
        rows: [
          ['Customer', await nameOf(context, dispute.customer_id)],
          ['Merchant', merchant],
          ['Request', rfi.reference],
          ['Answer due', frDate(rfi.due_at)],
          ['Disputed amount', euros(dispute.amount)],
        ],
        note: 'When the merchant refuses or stays silent for 15 days, the dispute is routed.',
      }),
    },
  );
}

function customizeDisputeRequests(collection) {
  collection.addAction('Ask to contact the merchant', {
    scope: 'Single',
    form: [{ label: 'Questions', type: 'String', widget: 'TextArea' }],
    execute: askToContactMerchant,
  });

  collection.addAction('Route dispute', {
    scope: 'Single',
    form: [
      {
        label: 'Route',
        type: 'Enum',
        enumValues: enumOf('dispute_requests', 'route'),
        isRequired: true,
      },
      { label: 'Note', type: 'String', widget: 'TextArea' },
    ],
    execute: async (context, resultBuilder) => {
      const dispute = await context.getRecord(DISPUTE);

      if (!['NEW', 'WAITING_CUSTOMER'].includes(dispute.status)) {
        return resultBuilder.error(`${dispute.reference} is ${dispute.status}: routed already.`);
      }

      const { Route: route, Note: note } = context.formValues;
      const [opened, error] = ROUTES[route] ? await ROUTES[route](context, dispute) : [null, null];
      if (error) return resultBuilder.error(error);
      const routed = ['CHARGEBACK', 'SEPA_DISPUTE'].includes(route);
      // The customer says the card was used without them: it is blocked now, before anything else.
      const block =
        dispute.payment_type === 'CARD' &&
        dispute.reason === 'UNAUTHORIZED' &&
        route !== 'CONTACT_MERCHANT' &&
        dispute.card_transaction_id
          ? await blockCard(context, dispute.card_transaction_id)
          : null;
      // No note: the reason the rules give (deadline passed, refunded past the network's 120 days).
      const ruled = note
        ? null
        : await ruledNote(reader(context.dataSource), await context.getRecord(DISPUTE_FILE), route);
      const notes = note || ruled || CLOSE_NOTES[route] || null;
      await cancelOpenRequests(context, 'dispute_request_id', dispute.id, `Routed: ${route}`);
      await moveTo(
        context,
        'DISPUTE_REQUESTS',
        dispute,
        routed ? 'ROUTED' : 'CLOSED',
        {
          route,
          routed_at: now(),
          assigned_to: context.caller.email,
          closed_at: routed ? null : now(),
          resolution_notes: routed ? null : notes,
        },
        routed ? route : notes,
      );

      return resultBuilder.success(
        `${dispute.reference} ${routed ? 'routed' : 'closed'} (${codeText(route)})${
          opened ? `: ${opened.reference}` : ''
        }.${block ? ` Card: ${blockText(block)}.` : ''}`,
        {
          html: routeCard(dispute, route, opened, notes, block, {
            customer: await nameOf(context, dispute.customer_id),
            paid: await paidLine(context, dispute),
          }),
        },
      );
    },
  });
}

// ---- chargebacks ---------------------------------------------------------------------------------

const CHARGEBACK = [
  'id',
  'reference',
  'status',
  'customer_id',
  'transaction_id',
  'card_transaction_id',
  'dispute_request_id',
  'network',
  'reason_code',
  'amount',
  'processor_dispute_id',
  'provisional_credit_issued',
  'reason_description',
  'transaction:account_id',
];
const DECIDED = ['WON', 'LOST', 'WITHDRAWN'];
const CARDHOLDER_QUESTIONS = {
  fraud:
    'Please confirm you did not make this card payment, and tell us whether your card was lost, ' +
    'stolen or still with you at the time.',
  other:
    'Please send us your exchanges with the merchant (order confirmation, cancellation, messages) ' +
    'so we can present the dispute to the card network.',
};

async function openChargebackRecord(context) {
  const cb = await context.getRecord(CHARGEBACK);
  const error = DECIDED.includes(cb.status) ? `${cb.reference} is decided (${cb.status}).` : null;

  return [cb, error];
}

function blockLinkedCard(collection) {
  collection.addAction('Block linked card', {
    scope: 'Single',
    execute: async (context, resultBuilder) => {
      const cb = await context.getRecord(['card_transaction_id', 'reference']);
      const block = await blockCard(context, cb.card_transaction_id);
      if (!block) return resultBuilder.error(`No card on ${cb.reference}.`);
      const { card } = block;
      const name = `Card •••• ${card.last_four_digits}`;
      // Blocked already (at intake, stolen, an earlier fraud): nothing to do, the workflow goes on.
      if (!block.blocked) return resultBuilder.success(`${blockText(block)}: nothing to block.`);

      return resultBuilder.success(`${blockText(block)}.`, {
        html: resultCard({
          eyebrow: resultsFrom(PROVIDERS.cardProcessor, 'card block'),
          title: `${name} blocked`,
          status: ['Blocked', 'red'],
          rows: [
            ['Card', `${codeText(card.network)} •••• ${card.last_four_digits}`],
            ['Reason', 'Fraud'],
            ['Blocked at', frStamp(card.blocked_at)],
            ['Processor reference', blockReference(card.id)],
            ['Chargeback', cb.reference],
          ],
          note: 'Every new payment with this card is now declined. A replacement card can be ordered from the customer page.',
        }),
      });
    },
  });
}

/** Statuses where the bank still prepares the file: before the network has it. */
const TO_FILE = ['INITIATED', 'WAITING_CARDHOLDER'];

function requestCardholderInfo(collection) {
  collection.addAction('Request cardholder info', {
    scope: 'Single',
    form: [
      { label: 'Questions', type: 'String', widget: 'TextArea' },
      { label: 'Due in (days)', type: 'Number', defaultValue: 7 },
    ],
    execute: async (context, resultBuilder) => {
      if (badDueIn(context.formValues['Due in (days)'])) return resultBuilder.error(DUE_IN_ERROR);
      const [cb, error] = await openChargebackRecord(context);
      if (error) return resultBuilder.error(error);
      const [waiting] = await coll(context, 'information_requests').list(
        {
          conditionTree: {
            aggregator: 'And',
            conditions: [
              { field: 'chargeback_id', operator: 'Equal', value: cb.id },
              { field: 'status', operator: 'In', value: ['SENT', 'OVERDUE'] },
            ],
          },
        },
        ['reference', 'questions', 'sent_at', 'due_at'],
      );
      const { representment_deadline: deadline } = await context.getRecord([
        'representment_deadline',
      ]);
      // What the operator sees either way: the request out, and the chargeback waiting on it.
      const requestCard = async (rfi, sent) =>
        resultCard({
          eyebrow: `Chargeback ${cb.reference} · request to the cardholder`,
          title: `${rfi.reference} ${sent ? 'sent to' : 'still waiting for'} ${await nameOf(
            context,
            cb.customer_id,
          )}`,
          status: ['Waiting on the cardholder', 'amber'],
          rows: [
            ['Claim', `${codeLine(cb)} · ${euros(cb.amount)}`],
            ['Questions', rfi.questions],
            ['Sent', frDate(rfi.sent_at)],
            ['Answer due', frDate(rfi.due_at)],
            ['Deadline to file', frDate(deadline)],
            [
              'Status',
              cb.status === 'INITIATED'
                ? 'initiated → waiting on the cardholder'
                : readable(cb.status),
            ],
          ],
          note: 'The chargeback leaves "Chargebacks to file" until the cardholder answers; file it before the deadline.',
        });

      // Before filing, the chargeback now waits on the cardholder, out of "Chargebacks to file".
      const wait = async reason => {
        if (cb.status === 'INITIATED') {
          await moveTo(
            context,
            'CHARGEBACKS',
            cb,
            'WAITING_CARDHOLDER',
            { updated_at: now() },
            reason,
          );
        }
      };

      if (waiting) {
        await wait(`${waiting.reference} waiting for an answer`);

        return resultBuilder.success(
          `${waiting.reference} is still waiting for the cardholder's answer: no new request sent.`,
          { html: await requestCard(waiting, false) },
        );
      }

      const fraud = FRAUD_CODES.includes(cb.reason_code);
      const rfi = await sendRequest(context, {
        customerId: cb.customer_id,
        serves: 'CHARGEBACK',
        // Shown on the customer's dispute request too.
        links: { chargeback_id: cb.id, dispute_request_id: cb.dispute_request_id || null },
        questions: context.formValues.Questions || CARDHOLDER_QUESTIONS[fraud ? 'fraud' : 'other'],
        dueIn: context.formValues['Due in (days)'],
      });
      await wait(`${rfi.reference} sent to the cardholder`);

      return resultBuilder.success(
        `${rfi.reference} sent to the cardholder${
          cb.status === 'INITIATED'
            ? `: ${cb.reference} waits on them, out of Chargebacks to file`
            : ''
        }.`,
        { html: await requestCard(rfi, true) },
      );
    },
  });
}

function fileWithNetwork(collection) {
  collection.addAction('File with network', {
    scope: 'Single',
    execute: async (context, resultBuilder) => {
      const cb = await context.getRecord(CHARGEBACK);

      if (!TO_FILE.includes(cb.status)) {
        return resultBuilder.error(`${cb.reference} is ${cb.status}: filed already.`);
      }

      await cancelOpenRequests(context, 'chargeback_id', cb.id, 'Filed with the network');
      const caseId =
        cb.processor_dispute_id ||
        `${cb.network === 'VISA' ? 'VROL' : 'MCOM'}-${digitsOf(cb.id, 10).padStart(10, '0')}`;
      const due = daysFromNow(cb.network === 'MASTERCARD' ? 45 : 30);
      await moveTo(
        context,
        'CHARGEBACKS',
        cb,
        'PRESENTED',
        {
          filed_at: now(),
          processor_dispute_id: caseId,
          representment_deadline: iso(due),
          days_to_deadline: Math.ceil((due.getTime() - Date.now()) / DAY),
          is_overdue: false,
          updated_at: now(),
        },
        `Filed with ${codeText(cb.network)}`,
      );
      // Only an unauthorised payment carries a provisional credit (booked when the claim opened);
      // the others are credited once won.
      const fraud = FRAUD_CODES.includes(cb.reason_code);
      let credit = null;

      if (cb.provisional_credit_issued) {
        credit = await one(
          context,
          'transactions',
          (
            await context.getRecord(['provisional_credit_transaction_id'])
          ).provisional_credit_transaction_id,
          ['amount', 'booked_at'],
        );
      } else if (fraud) {
        credit = await provisionalCredit(context, cb, cb.transaction.account_id);
      }

      let creditLine = 'None: credited to the customer only if the chargeback is won';

      if (credit) {
        creditLine = `${euros(credit.amount)} credited on ${frDate(credit.booked_at)}${
          cb.provisional_credit_issued ? '' : ' (now)'
        } (unauthorised payment, PSD2)`;
      }

      const visa = cb.network === 'VISA';
      const html = resultCard({
        eyebrow: resultsFrom(
          visa ? 'Visa dispute system' : 'Mastercard dispute system',
          'card network',
        ),
        title: `Case ${caseId}`,
        status: ['Presented to the network', 'green'],
        rows: [
          ['Our reference', cb.reference],
          ['Customer', await nameOf(context, cb.customer_id)],
          ['Reason code', codeLine(cb)],
          ['Amount', euros(cb.amount)],
          ['Merchant must answer by', `${frDate(due)} (${visa ? 30 : 45} days)`],
          ['Provisional credit', creditLine],
        ],
        note: 'Without an answer from the acquirer by the deadline, the chargeback is won.',
      });

      return resultBuilder.success(
        `${cb.reference} filed with ${codeText(cb.network)} through ${
          visa ? 'Visa dispute system' : 'Mastercard dispute system'
        }, case ${caseId} (simulated).`,
        { html },
      );
    },
  });
}

/** A chargeback dispute closes when its chargeback is decided. */
async function closeRequestOf(context, cb, notes) {
  const request = await one(context, 'dispute_requests', cb.dispute_request_id, ['status']);
  if (!request || request.status === 'CLOSED') return;
  await patch(context, 'dispute_requests', cb.dispute_request_id, {
    status: 'CLOSED',
    closed_at: now(),
    resolution_notes: notes,
  });
  await history(
    context,
    'DISPUTE_REQUESTS',
    cb.dispute_request_id,
    [request.status, 'CLOSED'],
    notes,
  );
}

function acceptLiability(collection) {
  collection.addAction('Accept Liability & Refund Customer', {
    scope: 'Single',
    form: [{ label: 'Note', type: 'String' }],
    execute: async (context, resultBuilder) => {
      const [cb, error] = await openChargebackRecord(context);
      if (error) return resultBuilder.error(error);
      await cancelOpenRequests(context, 'chargeback_id', cb.id, 'The bank accepted liability');
      // The provisional credit stays with the customer; without one, the bank refunds now.
      let refund = null;

      if (!cb.provisional_credit_issued) {
        const merchant = await merchantOf(context, cb.transaction_id);
        refund = await book(
          context,
          cb.transaction.account_id,
          'CREDIT',
          Number(cb.amount),
          `REMBOURSEMENT LITIGE CB ${merchant}`,
        );
        await listMove(context, refund.id, 'REFUND', { chargeback_id: cb.id });
      }

      const notes = `The bank accepted liability and refunded the customer${
        context.formValues.Note ? `. ${context.formValues.Note}` : ''
      }`;
      // WITHDRAWN: the bank drops the claim to the network (no ACCEPTED status in the model).
      await moveTo(
        context,
        'CHARGEBACKS',
        cb,
        'WITHDRAWN',
        {
          decision_at: now(),
          resolution_notes: notes,
          representment_deadline: null,
          days_to_deadline: null,
          is_overdue: false,
          updated_at: now(),
        },
        notes,
      );
      await closeRequestOf(context, cb, notes);

      return resultBuilder.success(`${cb.reference}: customer refunded ${euros(cb.amount)}.`, {
        html: resultCard({
          eyebrow: `Chargeback decision · ${context.caller.email}`,
          title: `${cb.reference} withdrawn: the bank refunds`,
          status: ['Withdrawn', 'amber'],
          rows: [
            ['Customer', await nameOf(context, cb.customer_id)],
            ['Chargeback', codeLine(cb)],
            ['Amount', euros(cb.amount)],
            [
              'Money',
              refund
                ? `${euros(cb.amount)} refunded now (${frDate(refund.booked_at)})`
                : `The provisional credit of ${euros(cb.amount)} stays with the customer`,
            ],
            ['Dispute request', cb.dispute_request_id ? 'closed' : null],
            ['Note', context.formValues.Note],
          ],
          note: 'The claim to the network is dropped: the bank bears the loss. Nothing else to do.',
        }),
      });
    },
  });
}

/** The merchant answered and we disagree: the last round before the network decides. */
function filePreArbitration(collection) {
  collection.addAction('File pre-arbitration', {
    scope: 'Single',
    form: [{ label: 'Our answer', type: 'String', widget: 'TextArea', isRequired: true }],
    execute: async (context, resultBuilder) => {
      const cb = await context.getRecord(CHARGEBACK);

      if (cb.status !== 'REPRESENTED') {
        return resultBuilder.error(
          `${cb.reference} is ${cb.status}: a pre-arbitration answers the merchant's representment.`,
        );
      }

      const visa = cb.network === 'VISA';
      const tool = visa ? 'Visa dispute system' : 'Mastercard dispute system';
      const due = daysFromNow(visa ? 30 : 45);
      const answer = context.formValues['Our answer'];
      await moveTo(
        context,
        'CHARGEBACKS',
        cb,
        'PRE_ARBITRATION',
        {
          pre_arbitration_filed_at: now(),
          representment_deadline: iso(due),
          days_to_deadline: Math.ceil((due.getTime() - Date.now()) / DAY),
          is_overdue: false,
          updated_at: now(),
        },
        `Pre-arbitration: ${answer}`,
      );
      const html = resultCard({
        eyebrow: resultsFrom(tool, 'card network'),
        title: `Case ${cb.processor_dispute_id}`,
        status: ['Pre-arbitration filed', 'green'],
        rows: [
          ['Our reference', cb.reference],
          ['Customer', await nameOf(context, cb.customer_id)],
          ['Reason code', codeLine(cb)],
          ['Amount', euros(cb.amount)],
          ['Merchant said', cb.representment_reason],
          ['Our answer', answer],
          ["Merchant's bank answers by", `${frDate(due)} (${visa ? 30 : 45} days)`],
        ],
        note: 'If the merchant’s bank declines, the network decides in arbitration; the loser pays its fee.',
      });

      return resultBuilder.success(
        `${cb.reference}: pre-arbitration filed through ${tool}, case ${cb.processor_dispute_id} (simulated).`,
        { html },
      );
    },
  });
}

/** The merchant proved its case: the claim is lost, the provisional credit goes back. */
function acceptRepresentment(collection) {
  collection.addAction('Accept representment', {
    scope: 'Single',
    form: [{ label: 'Note', type: 'String' }],
    execute: async (context, resultBuilder) => {
      const cb = await context.getRecord([
        ...CHARGEBACK,
        'representment_reason',
        'provisional_credit_transaction_id',
        'provisional_credit_reversed_at',
      ]);

      if (!['REPRESENTED', 'PRE_ARBITRATION'].includes(cb.status)) {
        return resultBuilder.error(
          `${cb.reference} is ${cb.status}: the merchant has not answered.`,
        );
      }

      const fraud = FRAUD_CODES.includes(cb.reason_code);
      // An unauthorised payment stays refunded (PSD2): the loss is the bank's. Otherwise the
      // provisional credit is taken back.
      let reversed = null;

      if (cb.provisional_credit_issued && !fraud && !cb.provisional_credit_reversed_at) {
        const merchant = await merchantOf(context, cb.transaction_id);
        reversed = await book(
          context,
          cb.transaction.account_id,
          'DEBIT',
          Number(cb.amount),
          `ANNULATION CREDIT PROVISOIRE ${merchant}`,
        );
        await listMove(context, reversed.id, 'CREDIT_REVERSAL', { chargeback_id: cb.id });
      }

      const why = (cb.representment_reason || 'evidence accepted').toLowerCase();
      const kept = cb.provisional_credit_issued && !reversed && !cb.provisional_credit_reversed_at;
      let outcome = 'nothing had been credited, nothing to take back';
      if (reversed || cb.provisional_credit_reversed_at) outcome = 'the credit was taken back';
      else if (kept) outcome = 'the refund stays, the bank bears the loss';
      const notes = `The merchant proved its case (${why}): ${outcome}${
        context.formValues.Note ? `. ${context.formValues.Note}` : ''
      }`;
      await cancelOpenRequests(context, 'chargeback_id', cb.id, 'Representment accepted');
      await moveTo(
        context,
        'CHARGEBACKS',
        cb,
        'LOST',
        {
          decision_at: now(),
          resolution_notes: notes,
          provisional_credit_reversed_at: reversed ? now() : null,
          representment_deadline: null,
          days_to_deadline: null,
          is_overdue: false,
          updated_at: now(),
        },
        notes,
      );
      await closeRequestOf(context, cb, notes);
      let moneyLine = 'Nothing was credited: nothing to take back';

      if (reversed) {
        moneyLine = `${euros(cb.amount)} taken back from the customer now`;
      } else if (cb.provisional_credit_reversed_at) {
        moneyLine = 'The credit was taken back already';
      } else if (cb.provisional_credit_issued) {
        moneyLine = `The customer keeps ${euros(
          cb.amount,
        )}: the bank bears the loss (unauthorised)`;
      }

      return resultBuilder.success(
        `${cb.reference} lost: ${
          reversed ? `${euros(cb.amount)} taken back from the customer` : outcome
        }.`,
        {
          html: resultCard({
            eyebrow: `Chargeback decision · ${context.caller.email}`,
            title: `${cb.reference} lost`,
            status: ['Lost', 'red'],
            rows: [
              ['Customer', await nameOf(context, cb.customer_id)],
              ['Chargeback', `${codeLine(cb)} · ${euros(cb.amount)}`],
              ['Merchant said', cb.representment_reason],
              ['Money', moneyLine],
              ['Dispute request', cb.dispute_request_id ? 'closed' : null],
              ['Note', context.formValues.Note],
            ],
            note: 'The claim is closed: it leaves "Merchant answered".',
          }),
        },
      );
    },
  });
}

function customizeChargebacks(collection) {
  blockLinkedCard(collection);
  requestCardholderInfo(collection);
  fileWithNetwork(collection);
  acceptLiability(collection);
  filePreArbitration(collection);
  acceptRepresentment(collection);
}

// ---- SEPA disputes -------------------------------------------------------------------------------

const SEPA = [
  'id',
  'reference',
  'status',
  'side',
  'reason',
  'customer_id',
  'transaction_id',
  'amount',
  'alert_id',
  'customer_consent_at',
  'response_due',
  'other_bank_bic',
  'transaction:account_id',
];
const ANSWERED = ['ACCEPTED', 'REFUSED', 'PARTIAL'];
// SEPA recall refusal codes (EPC rulebook), by the reason the other bank gave, when the money is
// there and our customer has not refused: no answer from them yet (NOAS), or a closed account.
// AM04 (nothing left) and CUST (they refused) come from the checks, in refusalFor.
const NO_ANSWER = 'NOAS: no answer from the beneficiary';
const REFUSALS = {
  FRAUD: 'LEGL: the funds are kept on a legal decision',
  ACCOUNT_CLOSED: 'AC04: the account is closed',
};
const CUSTOMER_REFUSES = 'CUST: the beneficiary refuses to return the money';
const NO_FUNDS = 'AM04: the funds have already left the account';
const CONSENT_ANSWERS = ['Agrees to send the money back', 'Refuses'];
const bankName = bic => OTHER_BANKS.find(([, b]) => b === bic)?.[2] || bic || 'the other bank';

/** A recall another bank sent us, still waiting for our answer. */
async function recallToAnswer(context) {
  const row = await context.getRecord(SEPA);

  if (row.side !== 'WE_ARE_ASKED') {
    return [row, `${row.reference} is our own request: the other bank answers it.`];
  }

  if (ANSWERED.includes(row.status)) return [row, `${row.reference} is answered (${row.status}).`];

  return [row, null];
}

const activeHolds = (context, row) =>
  coll(context, 'holds').list(
    {
      conditionTree: {
        aggregator: 'And',
        conditions: [
          { field: 'sepa_dispute_id', operator: 'Equal', value: row.id },
          { field: 'status', operator: 'Equal', value: 'ACTIVE' },
        ],
      },
    },
    ['id', 'reference', 'amount', 'account_id', 'placed_at'],
  );

/** Money held for the recall, put back on the account (before it is returned, or kept); the total. */
async function releaseHolds(context, row, reason) {
  const holds = await activeHolds(context, row);
  await Promise.all(
    holds.map(async h => {
      await patch(context, 'holds', h.id, {
        status: 'RELEASED',
        released_at: now(),
        released_by: context.caller.email,
        release_reason: reason,
      });
      await history(context, 'HOLDS', h.id, ['ACTIVE', 'RELEASED'], reason);
    }),
  );
  const total = holds.reduce((sum, h) => sum + Number(h.amount), 0);

  if (total > 0) {
    const accountId = row.transaction.account_id;
    const account = await one(context, 'accounts', accountId, ['available_balance']);
    await patch(context, 'accounts', accountId, {
      available_balance: round2(Number(account.available_balance) + total),
    });
  }

  return total;
}

/**
 * Part of the money still on the account, held until the recall is answered (FRAD), or until the
 * return goes out once our customer agreed (any other reason).
 */
async function holdFor(context, row, fields) {
  const accountId = row.transaction.account_id;
  const account = await one(context, 'accounts', accountId, ['available_balance']);
  const amount = round2(Math.min(Number(row.amount), Number(account.available_balance)));
  if (amount <= 0) return null;
  const hold = await openCase(context, 'holds', 'HLD', {
    account_id: accountId,
    amount,
    sepa_dispute_id: row.id,
    placed_by: context.caller.email,
    placed_at: now(),
    status: 'ACTIVE',
    expires_at: iso(new Date(`${row.response_due}T21:59:59.000Z`)),
    ...fields,
  });
  await patch(context, 'accounts', accountId, {
    available_balance: round2(Number(account.available_balance) - amount),
  });

  return hold;
}

async function fraudAlert(context, row) {
  const alert = await openCase(context, 'alerts', 'ALR', {
    alert_type: 'INCOMING_FRAUD_RECALL',
    category: 'FRAUD',
    source: 'MANUAL',
    created_by: context.caller.email,
    customer_id: row.customer_id,
    severity: 'HIGH',
    status: 'OPEN',
    triggered_at: now(),
    resolution_notes: context.formValues.Note || null,
  });
  await insert(context, 'alert_transactions', {
    alert_id: alert.id,
    transaction_id: row.transaction_id,
    role: 'REPORTED',
  });

  return alert;
}

/**
 * The fraud team gets the recall: the money mule alert (raised by monitoring when the recall
 * arrived, or now), and what is left of the money held until we answer.
 */
function escalateToFraud(collection) {
  collection.addAction('Escalate to fraud', {
    scope: 'Single',
    form: [{ label: 'Note', type: 'String', widget: 'TextArea' }],
    execute: async (context, resultBuilder) => {
      const [row, error] = await recallToAnswer(context);
      if (error) return resultBuilder.error(error);
      let alert = await one(context, 'alerts', row.alert_id, ['id', 'reference', 'triggered_at']);
      const raised = !alert;

      if (!alert) {
        alert = await fraudAlert(context, row);
        await context.collection.update(context.filter, { alert_id: alert.id });
      }

      const [held] = await activeHolds(context, row);
      const hold = held || (await holdFor(context, row, { reason: 'FRAUD', alert_id: alert.id }));
      let holdText = 'nothing left on the account to hold';
      if (held) holdText = `${euros(held.amount)} on hold since ${held.placed_at.slice(0, 10)}`;
      else if (hold) holdText = `${euros(hold.amount)} on hold now (${hold.reference})`;

      return resultBuilder.success(
        `${alert.reference} ${
          raised ? 'raised' : 'already raised by monitoring'
        } for the fraud team; ${holdText}.`,
      );
    },
  });
}

function askConsent(collection) {
  collection.addAction('Ask the customer for consent', {
    scope: 'Single',
    form: [
      {
        label: 'Message',
        type: 'String',
        widget: 'TextArea',
        defaultValue: async context => {
          const row = await context.getRecord(['amount', 'other_bank_bic']);

          return (
            `${bankName(row.other_bank_bic)} asks us to send back a transfer of ${euros(
              row.amount,
            )} you received, saying it was sent by mistake. Do you agree that we send it back? ` +
            'The money stays yours, and free to use, unless you agree.'
          );
        },
      },
    ],
    execute: async (context, resultBuilder) => {
      const [row, error] = await recallToAnswer(context);
      if (error) return resultBuilder.error(error);

      if (NO_CONSENT.includes(row.reason)) {
        return resultBuilder.error(`${row.reference} is a fraud recall: no consent to ask.`);
      }

      if (row.status === 'WAITING_CUSTOMER') {
        return resultBuilder.error(`${row.reference} is waiting for the customer already.`);
      }

      if (row.customer_consent_at) {
        return resultBuilder.error(`The customer agreed already: return the funds.`);
      }

      // Nothing held while we ask: the money is our customer's until they agree.
      const rfi = await sendRequest(context, {
        customerId: row.customer_id,
        serves: 'SEPA_DISPUTE',
        links: { sepa_dispute_id: row.id },
        questions: context.formValues.Message,
      });
      await moveTo(context, 'SEPA_DISPUTES', row, 'WAITING_CUSTOMER', {}, `${rfi.reference} sent`);

      return resultBuilder.success(
        `${rfi.reference} sent in the app: waiting for the customer's consent, nothing held (the ` +
          'money stays theirs until they agree). The recall leaves the queue until they answer.',
        {
          html: resultCard({
            eyebrow: `Recall ${row.reference} · consent request`,
            title: `${rfi.reference} sent to ${await nameOf(context, row.customer_id)}`,
            status: ['Waiting on the customer', 'amber'],
            rows: [
              ['Asked by', `${bankName(row.other_bank_bic)} · ${euros(row.amount)}`],
              ['Message', context.formValues.Message],
              ['Sent', frDate(rfi.sent_at)],
              ['Answer due', frDate(rfi.due_at)],
              ['Held', 'Nothing: the money stays theirs until they agree'],
              ['Recall', `${readable(row.status)} → waiting on the customer`],
            ],
            note: `The recall leaves "Recalls we received" until the customer's answer is recorded. The other bank expects our answer by ${frDate(
              row.response_due,
            )}.`,
          }),
        },
      );
    },
  });
}

/** The customer's answer to the consent request: the recall comes back to the queue. */
function recordAnswer(collection) {
  collection.addAction('Record the customer’s answer', {
    scope: 'Single',
    form: [
      { label: 'Answer', type: 'Enum', enumValues: CONSENT_ANSWERS, isRequired: true },
      { label: 'Customer’s words', type: 'String', widget: 'TextArea' },
    ],
    execute: async (context, resultBuilder) => {
      const [row, error] = await recallToAnswer(context);
      if (error) return resultBuilder.error(error);

      if (row.status !== 'WAITING_CUSTOMER') {
        return resultBuilder.error(`${row.reference} is not waiting for the customer.`);
      }

      const agrees = context.formValues.Answer === CONSENT_ANSWERS[0];
      const words =
        context.formValues['Customer’s words'] ||
        (agrees
          ? 'Yes, this money is not mine, please send it back.'
          : 'No, this payment was due to me.');
      const [rfi] = await coll(context, 'information_requests').list(
        {
          conditionTree: {
            aggregator: 'And',
            conditions: [
              { field: 'sepa_dispute_id', operator: 'Equal', value: row.id },
              { field: 'status', operator: 'In', value: ['SENT', 'OVERDUE'] },
            ],
          },
        },
        ['id', 'reference', 'status'],
      );

      if (rfi) {
        await patch(context, 'information_requests', rfi.id, {
          status: 'ANSWERED',
          answered_at: now(),
          answer: words,
        });
        await history(context, 'INFORMATION_REQUESTS', rfi.id, [rfi.status, 'ANSWERED']);
      }

      const why = `${rfi?.reference || 'Customer'} answered: ${agrees ? 'agrees' : 'refuses'}`;
      // Agreed: the amount is held from now until the return goes out, so it cannot be spent.
      const hold = agrees ? await holdFor(context, row, { reason: 'DISPUTE' }) : null;
      await moveTo(
        context,
        'SEPA_DISPUTES',
        row,
        'OPEN',
        agrees ? { customer_consent_at: now() } : {},
        why,
      );

      return resultBuilder.success(
        `${why}${hold ? `, ${euros(hold.amount)} on hold until the return goes out` : ''}. ${
          row.reference
        } is back in "Recalls we received".`,
      );
    },
  });
}

/** Why we cannot send the money back without asking: it is our customer's until they agree. */
function consentMissing(row) {
  if (NO_CONSENT.includes(row.reason) || row.customer_consent_at) return null;

  if (row.status === 'WAITING_CUSTOMER') {
    return 'The customer has not answered yet: the money stays theirs until they agree.';
  }

  return 'Our customer has not agreed: ask for their consent first, or refuse the recall.';
}

function acceptAndReturn(collection) {
  collection.addAction('Accept and return funds', {
    scope: 'Single',
    execute: async (context, resultBuilder) => {
      const [row, error] = await recallToAnswer(context);
      if (error) return resultBuilder.error(error);
      const missing = consentMissing(row);
      if (missing) return resultBuilder.error(missing);
      const accountId = row.transaction.account_id;
      const { returnable, held } = await money(sepaReader(context.dataSource), row, accountId);

      if (returnable <= 0) {
        return resultBuilder.error('No money left to return: refuse the recall.');
      }

      await releaseHolds(context, row, `Funds returned to ${bankName(row.other_bank_bic)}`);
      const tx = await book(
        context,
        accountId,
        'DEBIT',
        returnable,
        `RETOUR FONDS RAPPEL SEPA ${row.reference}`,
      );
      await listMove(context, tx.id, 'RETURN', { sepa_dispute_id: row.id });
      const status = returnable >= Number(row.amount) - 0.01 ? 'ACCEPTED' : 'PARTIAL';
      const message = networkRef(row.id, 'return');
      await moveTo(
        context,
        'SEPA_DISPUTES',
        row,
        status,
        { amount_returned: returnable, return_transaction_id: tx.id, answered_at: now() },
        `${message} sent to ${bankName(row.other_bank_bic)}`,
      );

      const html = resultCard({
        eyebrow: resultsFrom(PROVIDERS.sepa, 'recall answered'),
        title: `${euros(returnable)} returned to ${bankName(row.other_bank_bic)}`,
        status: [codeText(status), status === 'ACCEPTED' ? 'green' : 'amber'],
        rows: [
          ['Recall', row.reference],
          ['Customer', await nameOf(context, row.customer_id)],
          ['Asked by the other bank', euros(row.amount)],
          ['Returned', euros(returnable)],
          ['Of which held for the recall', held ? euros(Math.min(held, returnable)) : null],
          ['Return transaction', `${tx.description} · ${frDate(tx.booked_at)}`],
          ['Interbank message', message],
          ['Customer consent', row.customer_consent_at ? 'Given' : 'Not needed (fraud recall)'],
        ],
        note:
          status === 'PARTIAL'
            ? 'Only what was left on the account went back: the payer’s bank claims the rest elsewhere.'
            : 'The recall is answered and closed: the money is back with the other bank.',
      });

      return resultBuilder.success(
        `${euros(returnable)} sent back (${status}). (${PROVIDERS.sepa}, simulated)`,
        { html },
      );
    },
  });
}

/** The refusal code that fits: no money left, the customer said no, or the recall's reason. */
async function refusalFor(context) {
  const row = await context.getRecord(SEPA);

  if (row.customer_consent_at === null && !NO_CONSENT.includes(row.reason)) {
    const [answered] = await coll(context, 'information_requests').list(
      {
        conditionTree: {
          aggregator: 'And',
          conditions: [
            { field: 'sepa_dispute_id', operator: 'Equal', value: row.id },
            { field: 'status', operator: 'Equal', value: 'ANSWERED' },
          ],
        },
      },
      ['id'],
    );
    if (answered) return CUSTOMER_REFUSES;
  }

  const { returnable, held } = await money(
    sepaReader(context.dataSource),
    row,
    row.transaction.account_id,
  );
  // Money held for the recall has not left: never AM04 then.
  if (returnable <= 0 && !held) return NO_FUNDS;

  return REFUSALS[row.reason] || NO_ANSWER;
}

function refuseWithReason(collection) {
  collection.addAction('Refuse with a reason', {
    scope: 'Single',
    form: [
      {
        label: 'Reason',
        type: 'String',
        isRequired: true,
        description: 'SEPA refusal code and why, pre-filled from what the checks found',
        defaultValue: refusalFor,
      },
    ],
    execute: async (context, resultBuilder) => {
      const [row, error] = await recallToAnswer(context);
      if (error) return resultBuilder.error(error);
      // A fraud hold keeps the victim's money until it goes back: refusing would free it.
      const fraudHolds = NO_CONSENT.includes(row.reason) ? await activeHolds(context, row) : [];

      if (fraudHolds.length) {
        const total = fraudHolds.reduce((sum, h) => sum + Number(h.amount), 0);

        return resultBuilder.error(
          `${fraudHolds.map(h => h.reference).join(', ')} holds ${euros(
            total,
          )} for this fraud recall: send it back with "Accept and return funds". Refusing would put the victim's money back on the account.`,
        );
      }

      const { Reason: reason } = context.formValues;
      await cancelOpenRequests(context, 'sepa_dispute_id', row.id, 'Recall refused');
      const released = await releaseHolds(context, row, `Recall refused: ${reason}`);
      const message = networkRef(row.id, 'refusal');
      await moveTo(
        context,
        'SEPA_DISPUTES',
        row,
        'REFUSED',
        { answered_at: now() },
        `${reason} · ${message} sent to ${bankName(row.other_bank_bic)}`,
      );
      const html = resultCard({
        eyebrow: resultsFrom(PROVIDERS.sepa, 'recall answered'),
        title: `Recall refused: ${bankName(row.other_bank_bic)} is told`,
        status: ['Refused', 'red'],
        rows: [
          ['Recall', row.reference],
          ['Customer', await nameOf(context, row.customer_id)],
          ['Asked by the other bank', euros(row.amount)],
          ['Reason', reason],
          ['Interbank message', message],
          ['Hold released', released > 0 ? `${euros(released)} free on the account again` : null],
        ],
        note: 'The recall is answered and closed: nothing goes back to the other bank.',
      });

      return resultBuilder.success(
        `${row.reference} refused: ${reason}. (${PROVIDERS.sepa}, simulated)`,
        { html },
      );
    },
  });
}

function customizeSepaDisputes(collection) {
  escalateToFraud(collection);
  askConsent(collection);
  recordAnswer(collection);
  acceptAndReturn(collection);
  refuseWithReason(collection);
}

/** Registers the case desks' Smart Actions on the customizer. */
export {
  customizeChargebacks,
  customizeDisputeRequests,
  customizeInvestigations,
  customizeOutgoingTransfers,
  customizeSepaDisputes,
  recordTracfinAnswer,
};

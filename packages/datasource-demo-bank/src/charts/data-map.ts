/**
 * The bank's data model, by domain: the API chart `GET /forest/_charts/data_map`.
 *
 * Read live from what the agent serves, so it never goes stale: the domains are fixed here
 * (GROUPS below), each table's fields, links and Smart Actions come from its schema as
 * the agent built it (a field the database does not have, not in seed/data-model.ts, is computed by
 * the agent), and its rows are counted. Only the words are written here: a line per domain and per
 * table.
 */
import { tables as STORED } from '../seed/schema';

// The domains of the bank: tables grouped the way an operator thinks about the work.
// [domain, icon, tables]. A table name starting with '-' belongs to the domain but is a detail
// table (hidden).
const GROUPS: [string, string, string[]][] = [
  [
    'Customers',
    '👥',
    ['customers', 'individuals', 'businesses', '-customer_members', '-business_members'],
  ],
  ['Accounts & cards', '💳', ['accounts', 'cards', 'mandates']],
  [
    'Payments',
    '💸',
    [
      'transactions',
      'card_transactions',
      'incoming_transfers',
      'outgoing_transfers',
      'direct_debits',
      'fees',
      'wero_payments',
      'wallet_transfers',
    ],
  ],
  [
    'Counterparties',
    '🤝',
    [
      'counterparties',
      'card_merchants',
      'sct_emitters',
      'sct_beneficiaries',
      'sdd_creditors',
      'wero_contacts',
    ],
  ],
  [
    'Onboarding & KYC',
    '🛂',
    ['kyc_cases', 'documents', 'information_requests', 'customer_change_requests'],
  ],
  [
    'Financial crime',
    '🚨',
    [
      'alerts',
      'investigations',
      'sar_reports',
      'screening_hits',
      'watchlist_entries',
      'rules',
      'devices',
      'login_events',
      '-alert_transactions',
      '-investigation_transactions',
    ],
  ],
  ['Disputes', '↩️', ['dispute_requests', 'chargebacks', 'sepa_disputes', '-dispute_transactions']],
  [
    'E-invoicing',
    '📃',
    ['invoices', 'einvoicing_registrations', 'ereporting_submissions', '-invoice_payments'],
  ],
  [
    'Credit',
    '💰',
    [
      'loan_applications',
      'loans',
      'repayments',
      'guarantees',
      'collection_cases',
      'limit_requests',
    ],
  ],
  [
    'Lifecycle & legal',
    '⚖️',
    [
      'closures',
      'holds',
      'authority_requests',
      'business_events',
      'insolvency_proceedings',
      'deceased_cases',
    ],
  ],
  ['Service & quality', '📢', ['complaints', 'qa_reviews']],
  ['Admin', '🛠️', ['status_changes']],
];

const DOMAINS = {
  Customers: 'Who banks here: people and companies, and who may act for each customer account.',
  'Accounts & cards':
    'What customers hold: accounts with their IBAN and balance, cards, and the mandates that let creditors debit them.',
  Payments:
    'Every movement of money, as on a statement, with one detail table per payment rail: cards, transfers, direct debits, Wero, wallets, fees.',
  Counterparties:
    'Who customers pay and get paid by: merchants, payees, creditors, payers and contacts.',
  'Onboarding & KYC':
    'Knowing the customer: onboarding and periodic reviews, the papers behind them, and what the bank asks customers.',
  'Financial crime':
    'Keeping the bank clean: alerts raised by rules, screening against sanctions and PEP lists, investigations and the reports filed to TRACFIN.',
  Disputes: 'When a payment goes wrong: the customer’s request, card chargebacks and SEPA recalls.',
  'E-invoicing':
    'The French e-invoicing reform: business customers’ invoices, their registration and the reports sent to the tax office.',
  Credit: 'Lending, from the application to the last repayment, and the files that fall behind.',
  'Lifecycle & legal':
    'The rest of a customer’s life at the bank: account closures, holds, requests from authorities, insolvencies and deaths.',
  'Service & quality':
    'How the bank is doing for its customers: complaints, and quality reviews of its own work.',
  Admin: 'Behind every page: the history of what changed, on which record, by whom and why.',
};

const PURPOSES = {
  customers: 'A banking relationship: a person or a company, its risk rating and its next review.',
  individuals: 'A person: identity, address, tax residence, the profile they declared.',
  businesses: 'A company: registration, legal form, activity, card acceptance.',
  customer_members: 'Who acts on a customer account, and with which rights.',
  business_members: 'Who owns and runs a company: shareholders, directors, beneficial owners.',
  accounts: 'A current or savings account: IBAN, balance, status (active, frozen, closed).',
  cards: 'A payment card on an account: its network, status and when it was blocked.',
  mandates: 'A direct debit mandate: which creditor may take money from which account.',
  transactions:
    'Every movement on an account, as on a statement: the rail tells which table holds the rest.',
  card_transactions: 'A card payment or withdrawal: merchant, entry mode, 3-D Secure, country.',
  incoming_transfers:
    'A transfer received: scheme, purpose and the payer’s remittance information.',
  outgoing_transfers:
    'A transfer sent: payee check, the strong authentication used, the four-eyes validation above a threshold.',
  direct_debits: 'A direct debit taken under a mandate, and its return when refused.',
  fees: 'What the bank charges: plan fees, incidents, and their waivers.',
  wero_payments: 'A Wero payment between phones, by number or email.',
  wallet_transfers: 'A transfer between two customers of the bank.',
  counterparties: 'Anyone on the other side of a payment, screened and blockable.',
  card_merchants: 'A shop or website taking card payments: category, acquirer.',
  sct_emitters: 'A bank account that sends transfers to our customers.',
  sct_beneficiaries: 'A payee a customer saved, with its verification of payee result.',
  sdd_creditors: 'A company collecting direct debits: utilities, telecoms, insurers.',
  wero_contacts: 'A Wero contact: the phone number or email a customer pays.',
  kyc_cases:
    'A KYC review: an onboarding or a periodic review, its checks, its risk and its decision.',
  documents: 'A paper a customer sent: ID, selfie, proof of address, payslip; and its check.',
  information_requests: 'What the bank asked a customer, and when they must answer.',
  customer_change_requests: 'A customer changing a sensitive detail: address, phone, IBAN.',
  alerts: 'A suspicious pattern a rule raised: AML or fraud, its score and severity.',
  investigations: 'A case built from alerts or a screening hit, up to the MLRO’s decision.',
  sar_reports: 'A suspicious activity report filed to TRACFIN, and its answer.',
  screening_hits: 'A possible match of a name on a sanctions or PEP list, to clear or confirm.',
  watchlist_entries: 'A person or company on a sanctions or PEP list (EU, UN, OFAC, UK).',
  rules: 'A detection rule: what it watches, its threshold, the severity it raises.',
  devices: 'A phone or computer a customer logs in from, trusted or not.',
  login_events: 'A login attempt: where from, how, and its risk score.',
  alert_transactions: 'Which transactions an alert is about.',
  investigation_transactions:
    'Which transactions an investigation covers, and which go in the SAR.',
  dispute_requests: 'A customer contesting a payment: what, why, and where it is routed.',
  chargebacks: 'A card chargeback filed with the network, and its deadlines.',
  sepa_disputes: 'A SEPA recall or return, asked by us or by another bank.',
  dispute_transactions: 'Which transactions a dispute is about.',
  invoices: 'An e-invoice a business customer sent or received, and its status.',
  einvoicing_registrations: 'A company’s registration to send and receive e-invoices.',
  ereporting_submissions: 'A report of transactions sent to the tax office.',
  invoice_payments: 'Which payment settles which invoice.',
  loan_applications: 'A loan request: amount, term, income and the credit checks.',
  loans: 'A loan granted: principal, rate, outstanding balance, days past due.',
  repayments: 'One instalment of a loan, due, paid or late.',
  guarantees: 'What secures a loan: a guarantor, a deposit, a property.',
  collection_cases: 'A loan falling behind: the stage of recovery and promises to pay.',
  limit_requests: 'A customer asking for a higher card or overdraft limit.',
  closures: 'An account being closed: by whom, why, the balance to give back.',
  holds: 'Money set aside on an account: a seizure, a dispute, an investigation.',
  authority_requests: 'A request from a court, the tax office or the police, and the amounts held.',
  business_events: 'Something that changed at a business customer: owners, address, activity.',
  insolvency_proceedings: 'A business customer in insolvency, and the bank’s claim.',
  deceased_cases: 'A customer who died: the estate, the notary, the balance at death.',
  complaints: 'A customer complaint, its regulatory deadline and its outcome.',
  qa_reviews: 'A quality check of an operator’s decision.',
  status_changes: 'One line of a record’s history: what changed, from what to what, by whom, why.',
};

// Readable names: the words a table name abbreviates.
const WORDS = { kyc: 'KYC', sar: 'SAR', sct: 'SCT', sdd: 'SDD', qa: 'QA', sepa: 'SEPA' };
const labelOf = table =>
  table
    .split('_')
    .map((word, i) => WORDS[word] || (i ? word : word[0].toUpperCase() + word.slice(1)))
    .join(' ');

const SCOPES = { Single: 'one record', Bulk: 'several records', Global: 'the whole table' };
const COUNT_TTL_MS = 60 * 1000;
let counted = { at: 0, rows: {}, unavailable: [] };

/**
 * Every table's rows, counted at most once a minute (a demo page polls; the counts barely move).
 * A table whose count fails has no rows (null) and is listed in `unavailable`; such a result is not
 * kept, so the next read counts again.
 */
async function rowCounts(dataSource, names) {
  if (Date.now() - counted.at < COUNT_TTL_MS) return counted;
  const entries = await Promise.all(
    names.map(async name => {
      try {
        const [row] = await dataSource.getCollection(name).aggregate({}, { operation: 'Count' });

        return [name, Number(row?.value) || 0];
      } catch {
        return [name, null];
      }
    }),
  );
  const result = {
    at: Date.now(),
    rows: Object.fromEntries(entries),
    unavailable: entries.filter(([, n]) => n === null).map(([name]) => name),
  };
  if (!result.unavailable.length) counted = result;

  return result;
}

/** One table as the visitor reads it: what it is, its fields, its links, its actions. */
function tableOf(dataSource, name, hidden, rows) {
  const { schema } = dataSource.getCollection(name);
  const stored = new Set((STORED[name]?.fields || []).map(f => f.name));
  const fields = [];
  const computed = [];
  const belongsTo = [];
  const hasMany = [];
  Object.entries(schema.fields).forEach(([field, spec]: [string, any]) => {
    if (spec.type === 'Column') {
      const entry = { name: field, type: spec.columnType, key: Boolean(spec.isPrimaryKey) };
      if (stored.has(field) || spec.isPrimaryKey) fields.push(entry);
      else computed.push(entry);
    } else if (spec.type === 'ManyToOne' || spec.type === 'OneToOne') {
      belongsTo.push({ name: field, table: spec.foreignCollection });
    } else if (spec.type === 'OneToMany' || spec.type === 'ManyToMany') {
      hasMany.push({ name: field, table: spec.foreignCollection });
    }
  });
  const actions = Object.entries(schema.actions || {}).map(([action, spec]: [string, any]) => ({
    name: action,
    on: SCOPES[spec.scope] || spec.scope,
  }));

  return {
    name,
    label: labelOf(name),
    purpose: PURPOSES[name] || '',
    hidden,
    rows: rows[name] ?? null,
    fields,
    computed,
    belongsTo,
    hasMany,
    actions,
  };
}

async function dataMap(dataSource) {
  const entries = GROUPS.flatMap(([, , list]) =>
    list.map(entry => ({ name: entry.replace(/^-/, ''), hidden: entry.startsWith('-') })),
  );
  const { rows, unavailable } = await rowCounts(
    dataSource,
    entries.map(e => e.name),
  );
  const domains = GROUPS.map(([name, icon, list]) => ({
    name,
    icon,
    blurb: DOMAINS[name] || '',
    tables: list.map(entry =>
      tableOf(dataSource, entry.replace(/^-/, ''), entry.startsWith('-'), rows),
    ),
  }));
  const all = domains.flatMap(d => d.tables);

  return {
    stats: {
      domains: domains.length,
      tables: all.length,
      links: all.reduce((n, t) => n + t.belongsTo.length, 0),
      actions: all.reduce((n, t) => n + t.actions.length, 0),
      rows: all.reduce((n, t) => n + (t.rows || 0), 0),
    },
    domains,
    // The tables whose rows could not be counted (their `rows` is null).
    unavailable,
  };
}

function addDataMapChart(customizer) {
  customizer.addChart('data_map', async (context, resultBuilder) =>
    resultBuilder.smart(await dataMap(context.dataSource)),
  );
}

export { DOMAINS, GROUPS, PURPOSES, addDataMapChart, dataMap };

/**
 * Core banking: who customers pay and get paid by (counterparties and their roles), cards, and six
 * months of statement per account. Each statement is simulated day by day: salary or revenue in,
 * rent, direct debits, card payments, cash, transfers, fees. Balances add up line by line, and a
 * payment that would break the overdraft limit is declined or rejected, as in a real bank.
 */
import {
  DAY,
  NOW,
  TODAY,
  between,
  chance,
  daysAgo,
  iso,
  isoDate,
  pick,
  random as rand,
  round2,
  uniqueName,
  uuid,
  weighted,
  withTime,
} from './random';
import { COUNTRIES, EMPLOYERS, otherBankAccount } from './reference';

const HISTORY_DAYS = 183;
const HIGH_VALUE = 10000; // outgoing transfers above this wait for a second pair of eyes

// Where people pay by card: name, MCC (the card network's merchant category), statement
// category, amount range (EUR), country, city. ATMs are merchants too (MCC 6011).
const MERCHANTS = [
  ['Carrefour Market', '5411', 'GROCERIES', [12, 95], 'FR', 'Paris'],
  ['Monoprix', '5411', 'GROCERIES', [8, 70], 'FR', 'Lyon'],
  ['Lidl', '5411', 'GROCERIES', [10, 80], 'FR', 'Marseille'],
  ['Picard', '5411', 'GROCERIES', [15, 60], 'FR', 'Nantes'],
  ['Franprix', '5411', 'GROCERIES', [5, 35], 'FR', 'Paris'],
  ['Biocoop', '5411', 'GROCERIES', [12, 75], 'FR', 'Bordeaux'],
  ['Boulangerie Paul', '5462', 'GROCERIES', [3, 18], 'FR', 'Lille'],
  ['Le Comptoir du Marché', '5812', 'RESTAURANTS', [18, 85], 'FR', 'Paris'],
  ['Big Mamma', '5812', 'RESTAURANTS', [25, 110], 'FR', 'Paris'],
  ['Starbucks', '5814', 'RESTAURANTS', [4, 12], 'FR', 'Lyon'],
  ['McDonald’s', '5814', 'RESTAURANTS', [7, 25], 'FR', 'Toulouse'],
  ['Deliveroo', '5812', 'RESTAURANTS', [15, 45], 'FR', 'Paris'],
  ['Uber Eats', '5812', 'RESTAURANTS', [14, 42], 'NL', 'Amsterdam'],
  ['SNCF Connect', '4112', 'TRANSPORT', [25, 140], 'FR', 'Saint-Denis'],
  ['RATP', '4111', 'TRANSPORT', [2, 86], 'FR', 'Paris'],
  ['Uber', '4121', 'TRANSPORT', [9, 45], 'NL', 'Amsterdam'],
  ['TotalEnergies', '5541', 'TRANSPORT', [35, 90], 'FR', 'Lyon'],
  ['Air France', '4511', 'TRANSPORT', [90, 450], 'FR', 'Paris'],
  ['Amazon', '5942', 'SHOPPING', [10, 180], 'LU', 'Luxembourg'],
  ['Fnac', '5732', 'SHOPPING', [15, 300], 'FR', 'Paris'],
  ['Zara', '5651', 'SHOPPING', [20, 150], 'FR', 'Lyon'],
  ['Decathlon', '5941', 'SHOPPING', [15, 220], 'FR', 'Lille'],
  ['IKEA', '5712', 'SHOPPING', [20, 400], 'FR', 'Paris'],
  ['Sephora', '5977', 'SHOPPING', [15, 120], 'FR', 'Paris'],
  ['Pharmacie Centrale', '5912', 'SHOPPING', [5, 60], 'FR', 'Rennes'],
  ['Netflix', '4899', 'BILLS', [13.49, 13.49], 'NL', 'Amsterdam'],
  ['Spotify', '4899', 'BILLS', [11.12, 11.12], 'SE', 'Stockholm'],
  ['Apple', '5818', 'BILLS', [0.99, 19.99], 'IE', 'Cork'],
  ['OVHcloud', '7372', 'BILLS', [5, 90], 'FR', 'Roubaix'],
  ['Google Workspace', '7372', 'BILLS', [6.8, 81.6], 'IE', 'Dublin'],
  ['Tesco', '5411', 'GROCERIES', [10, 70], 'GB', 'London'],
  ['Pret A Manger', '5814', 'RESTAURANTS', [6, 18], 'GB', 'London'],
  ['Whole Foods Market', '5411', 'GROCERIES', [15, 90], 'US', 'New York'],
  ['Migros', '5411', 'GROCERIES', [12, 80], 'CH', 'Geneva'],
  ['El Corte Inglés', '5311', 'SHOPPING', [20, 200], 'ES', 'Madrid'],
  ['ATM Forest Lab Bank', '6011', 'CASH', [20, 200], 'FR', 'Paris'],
  ['ATM BNP Paribas', '6011', 'CASH', [20, 150], 'FR', 'Lyon'],
  ['ATM Barclays', '6011', 'CASH', [20, 200], 'GB', 'London'],
  ['ATM Chase', '6011', 'CASH', [20, 200], 'US', 'New York'],
];
const isAtm = merchant => merchant.category === 'CASH';
const FOREIGN_CURRENCY = { GB: ['GBP', 0.85], US: ['USD', 1.08], CH: ['CHF', 0.94] };

// Companies that take money by SEPA direct debit: name, sector, monthly amount range.
const CREDITORS = [
  ['EDF', 'Energy', [45, 140]],
  ['Engie', 'Energy', [35, 120]],
  ['Orange', 'Telecom', [20, 60]],
  ['SFR', 'Telecom', [15, 45]],
  ['Free', 'Telecom', [10, 40]],
  ['Bouygues Telecom', 'Telecom', [15, 45]],
  ['AXA', 'Insurance', [25, 95]],
  ['MAIF', 'Insurance', [30, 85]],
  ['MACIF', 'Insurance', [20, 80]],
  ['Basic-Fit', 'Fitness', [24.99, 34.99]],
  ['Canal+', 'Media', [25.99, 45.99]],
  ['URSSAF', 'Social security', [0, 0]],
  ['DGFiP', 'Taxes', [0, 0]],
];

const MONTHS = ['JAN', 'FEV', 'MAR', 'AVR', 'MAI', 'JUN', 'JUL', 'AOU', 'SEP', 'OCT', 'NOV', 'DEC'];
const PLAN_FEE = { STANDARD: 0, PREMIUM: 7.99, METAL: 14.99, BUSINESS_PRO: 29 };

const hex = n => Array.from({ length: n }, () => between(0, 15).toString(16)).join('');
const digits = n => Array.from({ length: n }, () => between(0, 9)).join('');
const upper = s => s.toUpperCase();
/** Read back a date this file wrote ('YYYY-MM-DD HH:MM:SS.SSS +00:00'). */
const toDate = text => new Date(text.replace(' +00:00', 'Z').replace(' ', 'T'));

// A friend, a landlord, a Wero contact: never the namesake of anyone else in the bank.
const personName = () =>
  uniqueName(
    () => `${pick(COUNTRIES.FR.male.concat(COUNTRIES.FR.female))} ${pick(COUNTRIES.FR.last)}`,
  );

function transactionRow(account, fields) {
  return {
    id: uuid(),
    account_id: account.id,
    counterparty_id: null,
    initiated_by_id: null,
    device_id: null,
    currency: 'EUR',
    status: 'BOOKED',
    booked_at: null,
    value_date: null,
    balance_after: null,
    reference: null,
    status_reason: null,
    reversed_at: null,
    ...fields,
  };
}

// ---- counterparties ---------------------------------------------------------------------------

/** One counterparty = one type: the same company paying by card and by transfer is two of them. */
function newCounterparty(rows, type, name, country, extra = {}) {
  const party = {
    id: uuid(),
    counterparty_type: type,
    name,
    country,
    risk_level: weighted([
      ['LOW', 92],
      ['MEDIUM', 7],
      ['HIGH', 1],
    ]),
    is_blocked: false,
    first_seen_at: iso(withTime(daysAgo(between(400, 2500)))),
    last_screened_at: iso(withTime(daysAgo(between(1, 30)))),
    blocked_at: null,
    block_reason: null,
    ...extra,
  };
  rows.counterparties.push(party);

  return party;
}

/**
 * Who sends money to one customer by SEPA credit transfer: an SCT emitter of its own, with its own
 * counterparty. The same employer paying ten customers is ten emitters (same IBAN, ten rows).
 */
function newEmitter(rows, customer, identity) {
  const party = newCounterparty(rows, 'SCT_EMITTER', identity.name, 'FR');
  const emitter = {
    id: uuid(),
    counterparty_id: party.id,
    customer_id: customer.id,
    ...identity.account,
  };
  rows.sct_emitters.push(emitter);

  return { party, emitter, name: identity.name };
}

/** A company or person outside the bank, with its account at another bank. */
const identity = name => ({ name, account: otherBankAccount() });

/**
 * What every customer shares: card merchants and SDD creditors (one shop, one creditor identifier),
 * plus the outside parties customers deal with (employers, public payers, card acquirers, companies),
 * which become an SCT emitter or beneficiary of each customer who deals with them.
 */
function sharedParties(rows) {
  const merchants = MERCHANTS.map(([name, mcc, category, range, country, city]) => {
    const party = newCounterparty(rows, 'CARD_MERCHANT', name, country, { risk_level: 'LOW' });
    const merchant = {
      id: uuid(),
      counterparty_id: party.id,
      mcc_code: mcc,
      category,
      acquirer: pick(['Worldline', 'Adyen', 'Stripe', 'Nexi']),
      acquirer_merchant_id: digits(10),
      city,
    };
    rows.card_merchants.push(merchant);

    return { party, merchant, name, category, range, country, city, mcc };
  });

  const creditors = CREDITORS.map(([name, sector, range]) => {
    const party = newCounterparty(rows, 'SDD_CREDITOR', name, 'FR', { risk_level: 'LOW' });
    const creditor = {
      id: uuid(),
      counterparty_id: party.id,
      creditor_identifier: `FR${digits(2)}ZZZ${digits(6)}`,
      iban: otherBankAccount().iban,
      sector,
    };
    rows.sdd_creditors.push(creditor);

    return { party, creditor, name, range };
  });

  const employers = Object.fromEntries(EMPLOYERS.map(name => [name, identity(name)]));
  const publicPayers = {
    PENSION: identity('CNAV Assurance Retraite'),
    UNEMPLOYMENT: identity('France Travail'),
  };
  const acquirers = ['Worldline', 'Stripe Payments Europe', 'Adyen'].map(identity);
  const suffixes = ['SAS', 'SARL', 'Industries', 'Services', 'Distribution', 'Logistique'];
  // Clients and suppliers of our business customers: one company per name, one IBAN each.
  const companies = Array.from({ length: 60 }, () =>
    identity(uniqueName(() => `${pick(COUNTRIES.FR.last)} ${pick(suffixes)}`)),
  );

  return { merchants, creditors, employers, publicPayers, acquirers, companies };
}

/** A payee of one customer: the counterparty plus its beneficiary row (saved payee). */
function newBeneficiary(rows, customer, party, added, account = otherBankAccount(), saved = true) {
  const bank = account;
  const beneficiary = {
    id: uuid(),
    counterparty_id: party.id,
    customer_id: customer.id,
    added_from_device_id: null,
    ...bank,
    nickname: saved ? party.name.split(' ')[0] : null,
    is_saved: saved,
    payee_check: weighted([
      ['MATCH', 93],
      ['CLOSE_MATCH', 5],
      ['NOT_POSSIBLE', 2],
    ]),
    payee_check_name: null,
    is_trusted: saved && chance(0.6),
    added_at: iso(added),
    removed_at: null,
    last_used_at: null,
  };
  if (beneficiary.payee_check === 'CLOSE_MATCH') beneficiary.payee_check_name = upper(party.name);
  rows.sct_beneficiaries.push(beneficiary);

  return beneficiary;
}

// ---- cards -------------------------------------------------------------------------------------

function cardRow(account, customer, holder, issued, extra = {}) {
  const expires = new Date(issued.getTime() + 3 * 365 * DAY);
  const recent = TODAY.getTime() - issued < 5 * DAY;

  return {
    id: uuid(),
    customer_id: customer.id,
    account_id: account.id,
    holder_id: holder.id,
    card_type: 'PHYSICAL',
    network: weighted([
      ['VISA', 60],
      ['MASTERCARD', 40],
    ]),
    embossed_name: upper(`${holder.first_name} ${holder.last_name}`).slice(0, 26),
    last_four_digits: digits(4),
    card_token: `tok_${hex(16)}`,
    issued_at: iso(issued),
    expires_at: isoDate(expires),
    activated_at: recent ? null : iso(new Date(issued.getTime() + between(2, 9) * DAY)),
    status: recent ? 'PENDING' : 'ACTIVE',
    blocked_at: null,
    blocked_reason: null,
    replaces_card_id: null,
    ...extra,
  };
}

/** Cards of one account's holders: renewed every 3 years, sometimes lost and replaced. */
/** One holder's physical cards over time: renewed before expiry, replaced when lost or stolen. */
function cardHistory(rows, account, customer, holder, opened) {
  const cards = [];
  let issued = new Date(opened.getTime() + between(1, 4) * DAY);
  let previous = null;

  while (issued < TODAY) {
    const card = cardRow(account, customer, holder, issued, {
      replaces_card_id: previous?.id || null,
    });
    const expires = new Date(`${card.expires_at}T00:00:00Z`);
    const lost = expires < TODAY && chance(0.08);
    if (expires < TODAY) card.status = 'EXPIRED';

    if (lost) {
      Object.assign(card, {
        status: 'BLOCKED',
        blocked_reason: pick(['LOST', 'STOLEN']),
        blocked_at: iso(withTime(new Date(issued.getTime() + between(60, 900) * DAY))),
      });
    }

    rows.cards.push(card);
    cards.push(card);
    previous = card;
    const next = lost
      ? new Date(card.blocked_at.slice(0, 10))
      : new Date(expires.getTime() - 20 * DAY);
    issued = new Date(next.getTime() + between(1, 6) * DAY);
  }

  return cards;
}

/** The relationship's status reaches its cards: blocked when frozen, cancelled when closed. */
function followRelationship(cards, customer, account) {
  cards
    .filter(c => c.status === 'ACTIVE' || c.status === 'PENDING')
    .forEach(c => {
      if (customer.status === 'SUSPENDED' || account.status === 'FROZEN') {
        const at = account.frozen_at || iso(withTime(daysAgo(between(2, 60))));
        Object.assign(c, { status: 'BLOCKED', blocked_reason: 'AML_FREEZE', blocked_at: at });
      } else if (account.status === 'CLOSED') {
        Object.assign(c, {
          status: 'CANCELLED',
          blocked_reason: 'ACCOUNT_CLOSED',
          blocked_at: account.closed_at,
        });
      }
    });
}

/** Cards of one account's holders, plus a virtual card for some of them. */
function cardsFor(rows, account, customer, holders) {
  const opened = toDate(account.opened_at);
  const cards = holders.flatMap(holder => {
    const history = cardHistory(rows, account, customer, holder, opened);
    if (!history.length || !chance(0.25)) return history;
    const issuedAt = withTime(daysAgo(between(10, 500)));
    const virtual = cardRow(account, customer, holder, issuedAt < opened ? opened : issuedAt, {
      card_type: 'VIRTUAL',
    });
    Object.assign(virtual, { status: 'ACTIVE', activated_at: virtual.issued_at });
    rows.cards.push(virtual);

    return [...history, virtual];
  });
  followRelationship(cards, customer, account);

  return cards;
}

/** The card a holder used on a given day, if any. */
function cardOn(cards, date) {
  return cards.find(c => {
    const from = new Date(c.issued_at.slice(0, 10));
    const to = new Date(`${c.expires_at}T00:00:00Z`);

    return from <= date && date < to && c.status !== 'PENDING';
  });
}

// ---- statements --------------------------------------------------------------------------------

/** The days of the statement window of one account. */
function statementWindow(account) {
  const start = Math.max(toDate(account.opened_at).getTime(), daysAgo(HISTORY_DAYS).getTime());
  let end = NOW.getTime();
  // Payments stop a few days before closing, so the last card payments clear before the payout.
  if (account.closed_at) end = Math.min(end, toDate(account.closed_at).getTime() - 4 * DAY);
  if (account.frozen_at) end = Math.min(end, toDate(account.frozen_at).getTime());
  if (account.status === 'DORMANT') end = start; // nothing moved recently
  end = Math.max(end, start); // an account closed within days of opening has an empty window

  return { start: new Date(start), end: new Date(end) };
}

/** Every month's day `day` (clamped to the month) inside the window. */
function monthly({ start, end }, day) {
  const dates = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));

  while (cursor <= end) {
    const last = new Date(
      Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0),
    ).getUTCDate();
    const date = withTime(
      new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), Math.min(day, last))),
    );
    if (date >= start && date <= end) dates.push(date);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return dates;
}

/** `n` random moments inside the window. */
function scattered({ start, end }, n) {
  const span = end - start;

  return Array.from({ length: n }, () =>
    withTime(new Date(start.getTime() + Math.floor(rand() * (span / DAY)) * DAY)),
  )
    .filter(d => d <= end)
    .sort((a, b) => a.getTime() - b.getTime());
}

/** The part of the window after a mandate was signed: no direct debit before that. */
const signed = (span, m) => ({
  start: new Date(Math.max(span.start, toDate(m.row.signed_at).getTime())),
  end: span.end,
});
const amountIn = ([min, max]) => round2(min + rand() * (max - min));
const monthLabel = date => `${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;

const monthsIn = span => Math.max(1, (span.end - span.start) / (30 * DAY));

// ---- Wero and wallet-to-wallet -------------------------------------------------------------------

// Shops taking Wero online, with the domain of their payment address.
const WERO_SHOPS = [
  ['Cdiscount', 'cdiscount.com'],
  ['Veepee', 'veepee.fr'],
  ['Leboncoin', 'leboncoin.fr'],
  ['BlaBlaCar', 'blablacar.fr'],
  ['Fnac', 'fnac.com'],
];
const WERO_MESSAGES = [
  'Resto',
  'Cinéma',
  'Part du cadeau',
  'Courses',
  'Billets concert',
  'Merci !',
  'Taxi',
];
const slug = text =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.|\.$/g, '');

/** A Wero contact of one customer, known by phone number or email, with its own counterparty. */
function weroContact(rows, customer, name, proxy, address = null) {
  const party = newCounterparty(rows, 'WERO_CONTACT', name, 'FR');
  const contact = {
    id: uuid(),
    counterparty_id: party.id,
    customer_id: customer.id,
    proxy_type: proxy,
    proxy_value:
      address ||
      (proxy === 'PHONE'
        ? `+33 6 ${digits(2)} ${digits(2)} ${digits(2)} ${digits(2)}`
        : `${slug(name)}@${pick(['gmail.com', 'outlook.com', 'orange.fr'])}`),
  };
  rows.wero_contacts.push(contact);

  return { party, contact, name };
}

/** Half of retail customers use Wero: a few friends, sometimes a shop that takes Wero online. */
function weroSetup(rows, ctx) {
  if (ctx.business || !chance(0.5)) return;
  const friends = Array.from({ length: between(1, 4) }, () =>
    weroContact(rows, ctx.customer, personName(), chance(0.7) ? 'PHONE' : 'EMAIL'),
  );
  // A shop takes Wero at its own address, not a personal mailbox.
  const [shop, domain] = pick(WERO_SHOPS);
  const shops = chance(0.4)
    ? [weroContact(rows, ctx.customer, shop, 'EMAIL', `paiement@${domain}`)]
    : [];
  ctx.wero = { friends, shops };
}

/** Wero payments sent and received, online purchases, and requests to pay (some refused or expired). */
function weroEvents(ctx, span) {
  if (!ctx.wero) return [];
  const { friends, shops } = ctx.wero;

  return scattered(span, between(1, 3) * Math.round(monthsIn(span))).map(date => {
    const kind = weighted([
      ['SENT', 50],
      ['RECEIVED', 25],
      ['ECOMMERCE', shops.length ? 10 : 0],
      ['REQUEST', 15],
    ]);
    const base = { kind: 'WERO', date, category: 'TRANSFERS', message: pick(WERO_MESSAGES) };

    if (kind === 'ECOMMERCE') {
      const amount = round2(15 + rand() * 120);

      return {
        ...base,
        contact: pick(shops),
        flow: 'ECOMMERCE',
        direction: 'SENT',
        status: 'PAID',
        amount,
        message: null,
        category: 'SHOPPING',
      };
    }

    const contact = pick(friends);
    const amount = round2(5 + rand() * 75);

    if (kind === 'REQUEST') {
      const status = weighted([
        ['PAID', 60],
        ['DECLINED', 20],
        ['EXPIRED', 20],
      ]);

      return { ...base, contact, flow: 'REQUEST_TO_PAY', direction: 'SENT', status, amount };
    }

    return {
      ...base,
      contact,
      flow: 'P2P',
      direction: kind,
      status: 'PAID',
      amount,
      credit: kind === 'RECEIVED',
    };
  });
}

function weroRow(state, tx, event) {
  const request = event.flow === 'REQUEST_TO_PAY';
  const requested = request
    ? new Date(event.date.getTime() - between(1, 72) * 3600000)
    : event.date;
  state.rows.wero_payments.push({
    id: uuid(),
    transaction_id: tx ? tx.id : null,
    account_id: state.ctx.account.id,
    wero_contact_id: event.contact.contact.id,
    direction: event.direction,
    flow: event.flow,
    status: event.status,
    proxy_used: event.contact.contact.proxy_value,
    message: event.message,
    requested_at: iso(requested),
    expires_at: request ? iso(new Date(requested.getTime() + 7 * DAY)) : null,
    paid_at: event.status === 'PAID' ? iso(event.date) : null,
    decline_reason: event.decline_reason || null,
    merchant_order_id: event.flow === 'ECOMMERCE' ? `CMD-${digits(8)}` : null,
  });
}

/**
 * Wallet-to-wallet transfers between customers of the bank, drawn before the statements: each one
 * appears on the sender's statement (debit) and, once all statements exist, on the receiver's.
 */
function drawWalletTransfers(rows, count) {
  const customers = new Map(rows.customers.map(c => [c.id, c]));
  // Accounts opened in the last days have no room for a transfer yet.
  const candidates = rows.accounts
    .filter(a => a.type === 'CURRENT' && a.status === 'ACTIVE' && toDate(a.opened_at) < daysAgo(3))
    .map(account => ({ account, customer: customers.get(account.customer_id) }));
  const outs = new Map();
  Array.from({ length: count }).forEach(() => {
    const from = pick(candidates);
    const to = pick(candidates.filter(c => c.customer.id !== from.customer.id));
    const earliest = Math.max(
      toDate(from.account.opened_at).getTime(),
      toDate(to.account.opened_at).getTime(),
      daysAgo(HISTORY_DAYS).getTime(),
    );
    const date = withTime(
      new Date(earliest + Math.floor(rand() * ((daysAgo(1).getTime() - earliest) / DAY)) * DAY),
    );
    const transfer = {
      kind: 'WALLET',
      date,
      amount: round2(10 + rand() * 190),
      to,
      category: 'TRANSFERS',
    };
    Object.assign(transfer, {
      reference: `WAL${hex(10).toUpperCase()}`,
      message: pick(WERO_MESSAGES),
    });
    if (!outs.has(from.account.id)) outs.set(from.account.id, []);
    outs.get(from.account.id).push(transfer);
  });

  return outs;
}

/** The WALLET_PEER counterparty a customer sees for another customer (one per pair). */
function walletPeer(rows, shared, customer, other) {
  const key = `${customer.id}>${other.id}`;

  if (!shared.walletPeers.has(key)) {
    shared.walletPeers.set(
      key,
      newCounterparty(rows, 'WALLET_PEER', other.display_name, 'FR', { risk_level: 'LOW' }),
    );
  }

  return shared.walletPeers.get(key);
}

/** The receiving side of the wallet transfers that were booked on their senders' statements. */
function creditWalletTransfers(rows, shared, ctxByAccount) {
  shared.walletCredits.forEach(w => {
    const receiver = ctxByAccount.get(w.to.account.id);
    if (!receiver) return;
    const peer = walletPeer(rows, shared, w.to.customer, w.from.customer);
    const tx = transactionRow(w.to.account, {
      rail: 'WALLET',
      direction: 'CREDIT',
      amount: w.amount,
      category: 'TRANSFERS',
      counterparty_id: peer.id,
      description: `VIR WALLET ${upper(w.from.customer.display_name)}`,
      reference: w.message,
      created_at: iso(w.date),
      booked_at: iso(w.date),
      value_date: isoDate(w.date),
    });
    rows.transactions.push(tx);
    receiver.booked.push(tx);
    rows.wallet_transfers.push({
      id: uuid(),
      transaction_id: tx.id,
      peer_account_id: w.from.account.id,
      transfer_reference: w.reference,
      message: w.message,
    });
  });
}

// ---- retail events -----------------------------------------------------------------------------

/** The monthly income of an employee, a retiree or a job seeker (null when there is none). */
function monthlyIncome(ctx, span, date) {
  const { holder, parties, customer } = ctx;
  const income = customer.expected_monthly_in;
  const status = holder.employment_status;

  if (status === 'EMPLOYED' && holder.employer) {
    const from = ctx.payer(parties.employers[holder.employer]);
    const label = `VIR SEPA ${upper(from.name)} SALAIRE ${monthLabel(date)}`;

    return { date, amount: round2(income * (0.95 + rand() * 0.1)), from, purpose: 'SALA', label };
  }

  if (status === 'RETIRED') {
    // Pensions arrive on the 9th: skip a month whose 9th falls outside the window.
    const paid = withTime(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 9)));
    if (paid < span.start || paid > span.end) return null;
    const label = `VIR SEPA CNAV RETRAITE ${monthLabel(date)}`;

    return {
      date: paid,
      amount: round2(income * 0.98),
      from: ctx.payer(parties.publicPayers.PENSION),
      purpose: 'PENS',
      label,
    };
  }

  if (status === 'UNEMPLOYED') {
    const label = `VIR SEPA FRANCE TRAVAIL ARE ${monthLabel(date)}`;

    return {
      date,
      amount: round2(income * 0.9),
      from: ctx.payer(parties.publicPayers.UNEMPLOYMENT),
      purpose: 'BENE',
      label,
    };
  }

  return null;
}

/** Money in: a salary, a pension, benefits; client payments for the self-employed, family help for students. */
function incomeEvents(ctx, span) {
  const events: Record<string, any>[] = monthly(span, between(25, 30))
    .map(date => monthlyIncome(ctx, span, date))
    .filter(Boolean)
    .map(e => ({ kind: 'IN', category: 'SALARY', ...e }));
  const status = ctx.holder.employment_status;

  if (['SELF_EMPLOYED', 'STUDENT'].includes(status)) {
    const n = status === 'SELF_EMPLOYED' ? 3 : 1;
    scattered(span, n * Math.round(monthsIn(span))).forEach(date => {
      const from = status === 'SELF_EMPLOYED' ? ctx.clientOf() : ctx.familyOf();
      const amount = round2((ctx.customer.expected_monthly_in / n) * (0.8 + rand() * 0.4));
      events.push({
        kind: 'IN',
        date,
        amount,
        from,
        category: 'TRANSFERS',
        label: `VIR SEPA ${upper(from.name)}`,
        remittance: status === 'SELF_EMPLOYED' ? `FACTURE ${digits(5)}` : 'ARGENT DU MOIS',
      });
    });
  }

  return events;
}

/** Rent by standing order and the direct debits of the account's mandates. */
function billEvents(ctx, span) {
  const events = [];

  if (ctx.payees.landlord) {
    const rent = round2(ctx.customer.expected_monthly_in * (0.25 + rand() * 0.1));
    monthly(span, between(1, 5)).forEach(date =>
      events.push({
        kind: 'OUT',
        date,
        amount: rent,
        to: ctx.payees.landlord,
        category: 'BILLS',
        standing: true,
        label: `VIR PERMANENT LOYER ${monthLabel(date)}`,
      }),
    );
  }

  ctx.mandates.forEach(m =>
    monthly(signed(span, m), m.day).forEach(date =>
      events.push({
        kind: 'DD',
        date,
        amount: amountIn(m.range),
        mandate: m,
        category: 'BILLS',
        label: `PRLV SEPA ${upper(m.name)}`,
      }),
    ),
  );

  return events;
}

/** Savings top-ups (once the savings account exists) and the plan's monthly fee. */
function savingsAndFeeEvents(ctx, span) {
  const { account, savingsAccount } = ctx;
  const events = [];

  if (savingsAccount) {
    const topUp = round2(Math.max(20, ctx.customer.expected_monthly_in * (0.03 + rand() * 0.12)));
    const since = {
      start: new Date(Math.max(span.start, toDate(savingsAccount.opened_at).getTime())),
      end: span.end,
    };
    monthly(since, between(2, 6)).forEach(date =>
      events.push({
        kind: 'SAVE',
        date,
        amount: topUp,
        category: 'TRANSFERS',
        label: 'VIR INTERNE VERS LIVRET',
      }),
    );
  }

  if (PLAN_FEE[account.plan]) {
    monthly(span, 1).forEach(date =>
      events.push({
        kind: 'FEE',
        date,
        amount: PLAN_FEE[account.plan],
        fee: 'MONTHLY_PLAN',
        category: 'FEES',
        label: `COTISATION OFFRE ${account.plan} ${monthLabel(date)}`,
      }),
    );
  }

  return events;
}

/** Where a card payment happens: a shop at home, sometimes abroad, sometimes a cash machine. */
function pickMerchant(merchants) {
  const abroad = chance(0.05);
  const foreign = m => m.country in FOREIGN_CURRENCY;
  const atm = chance(abroad ? 0.2 : 0.08);

  return pick(merchants.filter(m => isAtm(m) === atm && foreign(m) === abroad));
}

/** Cash comes out in round notes of the local currency; the account is debited in euros. */
function cashAmount(merchant) {
  const notes = between(2, 10) * 10;
  const foreign = FOREIGN_CURRENCY[merchant.country];

  return foreign ? round2(notes / foreign[1]) : notes;
}

/** Card payments and cash withdrawals, more of them for higher incomes; transfers to friends. */
function spendingEvents(ctx, span) {
  const { cards, parties, payees } = ctx;
  const perMonth = Math.round(Math.min(40, 10 + ctx.customer.expected_monthly_in / 250));
  const events = [];
  scattered(span, Math.round(perMonth * monthsIn(span))).forEach(date => {
    const card = cardOn(cards, date);
    if (!card) return;
    const merchant = pickMerchant(parties.merchants);
    const amount = isAtm(merchant) ? cashAmount(merchant) : amountIn(merchant.range);
    events.push({ kind: 'CARD', date, amount, merchant, card, category: merchant.category });
  });

  if (payees.friends.length) {
    scattered(span, between(0, 2) * Math.round(monthsIn(span))).forEach(date =>
      events.push({
        kind: 'OUT',
        date,
        amount: round2(10 + rand() * 140),
        to: pick(payees.friends),
        category: 'TRANSFERS',
        instant: chance(0.6),
        label: 'VIR SEPA',
        remittance: pick(['RESTO', 'REMBOURSEMENT', 'CADEAU', 'WEEK-END', 'COURSES', 'MERCI !']),
      }),
    );
  }

  return events;
}

/**
 * People don't let a surplus pile up on a current account: each month they move most of it to their
 * own account elsewhere (another bank, a brokerage), which keeps the balance near a month of income.
 */
function sweepEvents(ctx, span, events) {
  const total = kind => events.filter(kind).reduce((sum, e) => sum + e.amount, 0);
  const credit = e => e.kind === 'IN' || e.credit;
  const surplus = (total(credit) - total(e => !credit(e))) / monthsIn(span);
  if (!ctx.payees.self || surplus < 0.15 * ctx.customer.expected_monthly_in) return [];
  const bank = upper(ctx.payees.self.beneficiary.bank_name);

  return monthly(span, between(27, 30)).map(date => ({
    kind: 'OUT',
    date,
    amount: round2(surplus * 0.85 * (0.9 + rand() * 0.2)),
    to: ctx.payees.self,
    category: 'TRANSFERS',
    label: `VIR SEPA VERS MON COMPTE ${bank}`,
  }));
}

/** What happens on a retail current account over the window, before balances are applied. */
function retailEvents(ctx) {
  const span = statementWindow(ctx.account);
  const events = [
    ...incomeEvents(ctx, span),
    ...billEvents(ctx, span),
    ...savingsAndFeeEvents(ctx, span),
    ...spendingEvents(ctx, span),
    ...weroEvents(ctx, span),
    ...(ctx.shared.walletOuts.get(ctx.account.id) || []),
  ];

  return [...events, ...sweepEvents(ctx, span, events)];
}

// ---- business events ---------------------------------------------------------------------------

/** Client invoices paid by transfer, and card sales settled by the acquirer a few times a week. */
function revenueEvents(ctx, span) {
  const { business, parties } = ctx;
  const revenue = business.monthlyRevenue;
  const cardShare = business.accepts_card_payments ? 0.6 : 0;
  const events = scattered(span, Math.round(between(4, 12) * monthsIn(span))).map(date => {
    const from = ctx.clientOf();
    const amount = round2(((revenue * (1 - cardShare)) / 8) * (0.5 + rand()));

    return {
      kind: 'IN',
      date,
      amount,
      from,
      category: 'TRANSFERS',
      label: `VIR SEPA ${upper(from.name)} FACT ${digits(5)}`,
    };
  });

  if (cardShare) {
    const acquirer = ctx.payer(pick(parties.acquirers));
    scattered(span, Math.round(12 * monthsIn(span))).forEach(date => {
      const amount = round2(((revenue * cardShare) / 12) * (0.6 + rand() * 0.8));
      events.push({
        kind: 'IN',
        date,
        amount,
        from: acquirer,
        category: 'TRANSFERS',
        label: `VIR ${upper(acquirer.name)} REMISE CB ${digits(6)}`,
      });
    });
  }

  return events;
}

/** Payroll on the last days of the month, rent of the premises, supplier invoices. */
function payrollAndSupplierEvents(ctx, span) {
  const { business, payees } = ctx;
  const revenue = business.monthlyRevenue;
  const events = [];
  monthly(span, between(26, 28)).forEach(date =>
    ctx.payroll.forEach(({ employee, salary }) =>
      events.push({
        kind: 'OUT',
        date,
        amount: salary,
        to: employee,
        category: 'SALARY',
        purpose: 'SALA',
        label: `VIR SEPA SALAIRE ${monthLabel(date)}`,
      }),
    ),
  );

  if (payees.landlord) {
    const rent = round2(revenue * (0.05 + rand() * 0.06));
    monthly(span, between(1, 5)).forEach(date =>
      events.push({
        kind: 'OUT',
        date,
        amount: rent,
        to: payees.landlord,
        category: 'BILLS',
        standing: true,
        label: `VIR PERMANENT LOYER LOCAL ${monthLabel(date)}`,
      }),
    );
  }

  scattered(span, Math.round(between(3, 8) * monthsIn(span))).forEach(date => {
    const to = pick(payees.suppliers);
    const amount = chance(0.06)
      ? between(HIGH_VALUE + 500, 45000)
      : round2(revenue * (0.02 + rand() * 0.12));
    events.push({
      kind: 'OUT',
      date,
      amount,
      to,
      category: 'TRANSFERS',
      purpose: 'SUPP',
      label: `VIR SEPA ${upper(to.party.name)} FACT ${digits(5)}`,
    });
  });

  return events;
}

/** What each business direct debit takes: social charges follow payroll, VAT follows revenue. */
function businessDebit(ctx, mandate) {
  if (mandate.name === 'URSSAF') {
    return round2(ctx.payroll.reduce((sum, p) => sum + p.salary, 0) * 0.42 + 150);
  }

  if (mandate.name === 'DGFiP') return round2(ctx.business.monthlyRevenue * 0.08);

  return amountIn(mandate.range);
}

/** Social charges, VAT and utilities by direct debit; the plan fee; card expenses. */
function chargesAndExpenseEvents(ctx, span) {
  const events = [];
  ctx.mandates.forEach(m =>
    monthly(signed(span, m), m.day).forEach(date => {
      const amount = businessDebit(ctx, m);

      if (amount > 0) {
        events.push({
          kind: 'DD',
          date,
          amount,
          mandate: m,
          category: 'BILLS',
          label: `PRLV SEPA ${upper(m.name)}`,
        });
      }
    }),
  );
  monthly(span, 1).forEach(date =>
    events.push({
      kind: 'FEE',
      date,
      amount: PLAN_FEE.BUSINESS_PRO,
      fee: 'MONTHLY_PLAN',
      category: 'FEES',
      label: `COTISATION OFFRE PRO ${monthLabel(date)}`,
    }),
  );
  const expenses = ctx.parties.merchants.filter(m =>
    ['TRANSPORT', 'BILLS', 'RESTAURANTS'].includes(m.category),
  );
  scattered(span, Math.round(between(4, 15) * monthsIn(span))).forEach(date => {
    const card = cardOn(ctx.cards, date);
    if (!card) return;
    const merchant = pick(expenses);
    events.push({
      kind: 'CARD',
      date,
      amount: amountIn(merchant.range),
      merchant,
      card,
      category: merchant.category,
    });
  });

  return events;
}

/** What happens on a business account: clients and card sales in; payroll, suppliers, taxes out. */
function businessEvents(ctx) {
  const span = statementWindow(ctx.account);
  ctx.payroll = ctx.payees.employees.map(e => ({ employee: e, salary: between(1800, 4200) }));

  return [
    ...revenueEvents(ctx, span),
    ...payrollAndSupplierEvents(ctx, span),
    ...chargesAndExpenseEvents(ctx, span),
  ];
}

// ---- turning events into rows ------------------------------------------------------------------

// Online payments without 3-D Secure, as PSD2 allows: low value (under 30 EUR), subscriptions the
// merchant charges by itself after the first payment, and merchants outside Europe.
const SUBSCRIPTIONS = ['Netflix', 'Spotify', 'Apple', 'Google Workspace', 'OVHcloud'];
const exempt3ds = (merchant, amount) =>
  Number(amount) < 30 || SUBSCRIPTIONS.includes(merchant.name) || merchant.country === 'US';

// Merchants people only pay online or in their app.
const ONLINE_ONLY = [
  ...SUBSCRIPTIONS,
  'Amazon',
  'Uber',
  'Uber Eats',
  'Deliveroo',
  'SNCF Connect',
  'Air France',
];

function cardDetail(rows, tx, event) {
  const { merchant, card, date } = event;
  const foreign = FOREIGN_CURRENCY[merchant.country];
  const mode =
    event.mode ||
    (ONLINE_ONLY.includes(merchant.name) && 'ONLINE') ||
    (isAtm(merchant)
      ? 'CHIP'
      : weighted([
          ['CONTACTLESS', 45],
          ['CHIP', 15],
          ['ONLINE', 25],
          ['MOBILE_WALLET', 15],
        ]));
  const detail = {
    id: uuid(),
    transaction_id: tx.id,
    card_id: card.id,
    merchant_id: merchant.merchant.id,
    type: isAtm(merchant) ? 'ATM_WITHDRAWAL' : 'PURCHASE',
    authorization_code: hex(6).toUpperCase(),
    entry_mode: mode,
    is_3ds: mode === 'ONLINE' && !exempt3ds(merchant, tx.amount),
    country: merchant.country,
    // What the merchant charged, in its currency (euros for most payments).
    original_amount: foreign ? round2(tx.amount * foreign[1]) : tx.amount,
    original_currency: foreign ? foreign[0] : 'EUR',
    exchange_rate: foreign ? Math.round((1.02 / foreign[1]) * 1e6) / 1e6 : null,
    wallet_type: mode === 'MOBILE_WALLET' ? pick(['APPLE_PAY', 'GOOGLE_PAY', 'SAMSUNG_PAY']) : null,
    city: upper(merchant.city),
    authorized_at: iso(date),
    decline_reason: null,
    cleared_at: null,
    settled_at: null,
    acquirer_reference_number: null,
    status: 'AUTHORIZED',
  };
  rows.card_transactions.push(detail);

  return detail;
}

/** An incoming SEPA credit transfer: who sent it and their message. */
function incomingDetail(rows, tx, event, emitter) {
  const detail = {
    id: uuid(),
    transaction_id: tx.id,
    emitter_id: emitter.id,
    // Salaries and pensions come by batch (SEPA); people and clients often pay instantly.
    scheme: !event.purpose && chance(0.35) ? 'SEPA_INSTANT' : 'SEPA',
    end_to_end_id: `E2E${hex(13).toUpperCase()}`,
    purpose_code: event.purpose || null,
    remittance_info: event.remittance || null,
  };
  rows.incoming_transfers.push(detail);

  return detail;
}

/** An outgoing SEPA credit transfer: to which beneficiary, how it was approved and validated. */
function outgoingDetail(rows, tx, event, fields) {
  const detail = {
    id: uuid(),
    transaction_id: tx.id,
    beneficiary_id: null,
    scheme: event.instant ? 'SEPA_INSTANT' : 'SEPA',
    initiated_via: 'BANKING_APP',
    end_to_end_id: `E2E${hex(13).toUpperCase()}`,
    payee_check: null,
    validation_status: 'NOT_REQUIRED',
    validated_by: null,
    validated_at: null,
    requested_execution_date: isoDate(event.date),
    rejection_reason: null,
    sca_method: null,
    purpose_code: event.purpose || null,
    is_standing_order: Boolean(event.standing),
    ...fields,
  };
  rows.outgoing_transfers.push(detail);

  return detail;
}

// Each kind of movement has its handler. They share the account's running state: what is
// available (balance minus payments still pending), the overdraft limit, booked and pending lines.

const book = (state, tx, at) => {
  Object.assign(tx, { status: 'BOOKED', booked_at: iso(at), value_date: isoDate(at) });
  state.booked.push(tx);
};

const reject = (tx, reason) => Object.assign(tx, { status: 'REJECTED', status_reason: reason });
const fits = (state, amount) => state.available - amount >= state.limit;

const pend = (state, tx) => {
  tx.status = 'PENDING';
  state.pendingDebits.push(tx);
};

/** A fee caused by a payment; the bank waives what the overdraft limit can't take. */
function chargeFee(state, date, amount, type, trigger) {
  if (!fits(state, amount)) return;
  state.available -= amount;
  state.ctx.extraFees.push({ date, amount, fee: type, trigger });
}

/** Declined (no money, or a wrong PIN...) or cancelled by the merchant: true if it stops here. */
function cardStopped(state, tx, detail, event) {
  const enough = fits(state, event.amount);

  if (!enough || chance(0.004)) {
    detail.status = 'DECLINED';
    detail.decline_reason = enough
      ? pick(['WRONG_PIN', 'SUSPECTED_FRAUD', 'LIMIT_EXCEEDED'])
      : 'INSUFFICIENT_FUNDS';
    const what = isAtm(event.merchant) ? 'Cash withdrawal' : 'Card payment';
    reject(tx, `${what} declined: ${detail.decline_reason.toLowerCase().replace(/_/g, ' ')}`);

    return true;
  }

  if (chance(0.004)) {
    detail.status = 'REVERSED';
    Object.assign(tx, {
      status: 'REVERSED',
      reversed_at: iso(new Date(event.date.getTime() + 3600000)),
      status_reason: isAtm(event.merchant) ? 'Cash not dispensed' : 'Cancelled by the merchant',
    });

    return true;
  }

  return false;
}

/** Authorised today, cleared by the merchant a day or two later, settled the day after. */
function applyCard(state, tx, event) {
  Object.assign(tx, {
    counterparty_id: event.merchant.party.id,
    initiated_by_id: event.card.holder_id,
    // French statements: "CB <shop> <city>" for a payment, "RETRAIT DAB <bank> <city>" for cash.
    description: isAtm(event.merchant)
      ? `RETRAIT DAB ${upper(event.merchant.name.replace(/^ATM /, ''))} ${upper(
          event.merchant.city,
        )}`
      : `CB ${upper(event.merchant.name)} ${upper(event.merchant.city)}`,
  });
  const detail = cardDetail(state.rows, tx, event);
  if (cardStopped(state, tx, detail, event)) return;
  state.available -= event.amount;

  if ((NOW.getTime() - event.date) / DAY < between(1, 2)) {
    pend(state, tx);

    return;
  }

  const cleared = withTime(new Date(event.date.getTime() + between(1, 2) * DAY));
  const settled = withTime(new Date(cleared.getTime() + DAY));
  Object.assign(detail, {
    cleared_at: iso(cleared),
    acquirer_reference_number: digits(23),
    status: settled < NOW ? 'SETTLED' : 'CLEARED',
    settled_at: settled < NOW ? iso(settled) : null,
  });
  book(state, tx, cleared < NOW ? cleared : event.date);

  if (detail.original_currency !== 'EUR' && state.ctx.account.plan === 'STANDARD') {
    if (isAtm(event.merchant)) {
      chargeFee(state, cleared, round2(3 + event.amount * 0.02), 'FOREIGN_ATM_WITHDRAWAL', tx);
    } else {
      chargeFee(state, cleared, round2(event.amount * 0.02), 'FOREIGN_CARD_PAYMENT', tx);
    }
  }
}

function applyIn(state, tx, event) {
  tx.counterparty_id = event.from.party.id;
  tx.reference = event.remittance || null;
  incomingDetail(state.rows, tx, event, event.from.emitter);
  state.available += event.amount;
  book(state, tx, event.date);
}

/** Collected under its mandate, or rejected (with a fee) when the money isn't there. */
function applyDirectDebit(state, tx, event) {
  const { mandate } = event;
  tx.counterparty_id = mandate.party.id;
  tx.reference = `${mandate.row.mandate_reference} ${isoDate(event.date).slice(0, 7)}`;
  const prefix = upper(mandate.name)
    .replace(/[^A-Z]/g, '')
    .slice(0, 6);
  const detail = {
    id: uuid(),
    transaction_id: tx.id,
    mandate_id: mandate.row.id,
    amount: event.amount,
    mandate_type: mandate.row.type,
    sequence: mandate.collected ? 'RECURRING' : 'FIRST',
    collection_date: isoDate(event.date),
    received_at: iso(withTime(new Date(event.date.getTime() - between(5, 14) * DAY))),
    end_to_end_id: `${prefix}${hex(10).toUpperCase()}`,
    status: 'COLLECTED',
    return_reason: null,
  };
  state.rows.direct_debits.push(detail);
  mandate.collected = true;

  if (!fits(state, event.amount)) {
    Object.assign(detail, { status: 'REJECTED', return_reason: 'AM04 Insufficient funds' });
    reject(tx, 'Direct debit rejected: insufficient funds');
    chargeFee(state, event.date, 20, 'REJECTED_PAYMENT', tx);

    return;
  }

  mandate.row.last_collection_at = iso(event.date);
  state.available -= event.amount;
  book(state, tx, event.date);
}

function applyFee(state, tx, event) {
  if (!fits(state, event.amount)) {
    reject(tx, 'Fee not taken: account at its limit');

    return;
  }

  state.rows.fees.push({
    id: uuid(),
    transaction_id: tx.id,
    account_id: state.ctx.account.id,
    triggered_by_transaction_id: event.trigger?.id || null,
    type: event.fee,
    amount: event.amount,
    currency: 'EUR',
    period: isoDate(event.date).slice(0, 7),
    status: 'CHARGED',
    charged_at: iso(event.date),
    waived_by: null,
    waiver_reason: null,
    waived_at: null,
    refunded_at: null,
    refund_transaction_id: null,
  });
  state.available -= event.amount;
  book(state, tx, event.date);
}

/** To the customer's own savings account: the savings side is booked afterwards. */
function applySave(state, tx, event) {
  tx.initiated_by_id = state.ctx.initiator?.id || null;

  if (!fits(state, event.amount)) {
    reject(tx, 'Insufficient funds');

    return;
  }

  state.available -= event.amount;
  book(state, tx, event.date);
  state.ctx.savingsCredits.push({ date: event.date, amount: event.amount });
}

/** Large transfers wait for a second pair of eyes; recent ones are still waiting. */
function validation(event, waiting) {
  if (event.amount <= HIGH_VALUE) return { validation_status: 'NOT_REQUIRED' };
  if (waiting) return { validation_status: 'PENDING' };

  return {
    validation_status: 'APPROVED',
    validated_by: `${pick(['claire.morel', 'hugo.lambert', 'sofia.marin'])}@forest-lab-bank.fr`,
    validated_at: iso(new Date(event.date.getTime() + between(10, 90) * 60000)),
  };
}

// A large transfer of the last two days waits for a second pair of eyes (applyTransferOut).
const waitsValidation = e =>
  e.kind === 'OUT' && e.amount > HIGH_VALUE && (NOW.getTime() - e.date) / DAY < 2;

function applyTransferOut(state, tx, event) {
  const { to } = event;
  Object.assign(tx, {
    initiated_by_id: state.ctx.initiator?.id || null,
    counterparty_id: to.party.id,
    description: `${event.label} ${upper(to.party.name)}`,
    reference: event.remittance || null,
  });
  to.beneficiary.last_used_at = iso(event.date);
  const waiting = waitsValidation(event);
  const detail = outgoingDetail(state.rows, tx, event, {
    beneficiary_id: to.beneficiary.id,
    payee_check: to.beneficiary.payee_check,
    sca_method: event.standing ? 'EXEMPTED' : pick(['APP_CONFIRMATION', 'BIOMETRIC', 'SMS_OTP']),
    initiated_via: state.ctx.business && chance(0.3) ? 'API' : 'BANKING_APP',
    ...validation(event, waiting),
  });

  if (!fits(state, event.amount)) {
    detail.rejection_reason = 'Insufficient funds';
    reject(tx, 'Transfer rejected: insufficient funds');

    return;
  }

  state.available -= event.amount;
  if (event.device) tx.device_id = event.device;

  if (event.held) {
    // Stopped by a fraud or sanctions rule: the money is reserved until someone decides.
    Object.assign(tx, { status: 'HELD', status_reason: event.held });
    state.pendingDebits.push(tx);

    return;
  }

  if (waiting) {
    pend(state, tx);

    return;
  }

  book(state, tx, event.date);

  if (event.instant && state.ctx.account.plan === 'STANDARD') {
    chargeFee(state, event.date, 0.5, 'INSTANT_TRANSFER', tx);
  }
}

// What the payer wrote, as it appears on the statement after the counterparty's name.
const REMITTANCE: [RegExp, (m) => string][] = [
  [/ SALAIRE (\w+ \d{4})$/, m => `SALAIRE ${m[1]}`],
  [/ RETRAITE (\w+ \d{4})$/, m => `RETRAITE ${m[1]}`],
  [/ ARE (\w+ \d{4})$/, m => `ALLOCATION ${m[1]}`],
  [/ FACT (\d+)$/, m => `FACTURE ${m[1]}`],
  [/ REMISE CB (\d+)$/, m => `REMISE CB ${m[1]}`],
  [/LOYER( LOCAL)? (\w+ \d{4})$/, m => `LOYER ${m[2]}`],
  [/VERS MON COMPTE/, () => 'EPARGNE'],
];

function remittanceOf(event) {
  if (event.remittance) return event.remittance;
  const rule = REMITTANCE.find(([re]) => re.test(event.label || ''));

  return rule ? rule[1](event.label.match(rule[0])) : null;
}

/** A paid Wero payment moves money by SEPA Instant, in or out. */
function applyWero(state, tx, event) {
  Object.assign(tx, {
    counterparty_id: event.contact.party.id,
    description: `WERO ${upper(event.contact.name)}`,
    reference: event.message,
    initiated_by_id: event.credit ? null : state.ctx.initiator?.id || null,
  });
  state.available += event.credit ? event.amount : -event.amount;
  book(state, tx, event.date);
  weroRow(state, tx, event);
}

/** The sender's side of a wallet transfer; the receiver's is booked once every statement exists. */
function applyWallet(state, tx, event) {
  const { ctx } = state;
  const peer = walletPeer(state.rows, ctx.shared, ctx.customer, event.to.customer);
  Object.assign(tx, {
    counterparty_id: peer.id,
    initiated_by_id: ctx.initiator?.id || null,
    description: `VIR WALLET ${upper(event.to.customer.display_name)}`,
    reference: event.message,
  });
  state.available -= event.amount;
  book(state, tx, event.date);
  state.rows.wallet_transfers.push({
    id: uuid(),
    transaction_id: tx.id,
    peer_account_id: event.to.account.id,
    transfer_reference: event.reference,
    message: event.message,
  });
  ctx.shared.walletCredits.push({
    ...event,
    from: { account: ctx.account, customer: ctx.customer },
  });
}

/**
 * A request to pay can be refused (or refused for lack of money) or left to expire: the Wero row is
 * written, but no money moves and there is no transaction. True when that is the case.
 */
function weroWithoutMoney(state, event) {
  if (event.kind !== 'WERO') return false;

  if (event.flow === 'REQUEST_TO_PAY' && event.status === 'PAID' && !fits(state, event.amount)) {
    Object.assign(event, { status: 'DECLINED', decline_reason: 'Insufficient funds' });
  }

  if (event.status === 'PAID') return false;
  const reason = event.status === 'DECLINED' ? 'Refused by the customer' : null;
  weroRow(state, null, { ...event, decline_reason: event.decline_reason || reason });

  return true;
}

const HANDLERS = {
  CARD: applyCard,
  IN: applyIn,
  DD: applyDirectDebit,
  FEE: applyFee,
  SAVE: applySave,
  OUT: applyTransferOut,
  WERO: applyWero,
  WALLET: applyWallet,
};
const RAIL = {
  CARD: 'CARD',
  DD: 'DIRECT_DEBIT',
  FEE: 'FEE',
  SAVE: 'INTERNAL',
  WERO: 'WERO',
  WALLET: 'WALLET',
};

/**
 * Apply one account's events in time order: declines and rejections when the money isn't there,
 * card payments that clear and settle days later, large transfers waiting for validation.
 */
function statement(rows, ctx, events) {
  const state = {
    rows,
    ctx,
    available: Number(ctx.openingBalance),
    limit: -Number(ctx.account.overdraft_limit || 0),
    booked: [],
    pendingDebits: [],
  };
  events
    .sort((a, b) => a.date - b.date)
    .forEach(event => {
      // Nobody tries to send money they don't have: only scheduled payments (standing orders,
      // payroll) and the creditor's direct debits can bounce.
      // Story movements (wave B) always happen: they are what the alerts are about.
      const optional =
        (event.kind === 'OUT' && !event.standing && event.purpose !== 'SALA' && !event.story) ||
        ['SAVE', 'WALLET'].includes(event.kind) ||
        (event.kind === 'WERO' && event.flow !== 'REQUEST_TO_PAY' && !event.credit);
      if (optional && !fits(state, event.amount)) return;
      if (weroWithoutMoney(state, event)) return;
      const tx = transactionRow(ctx.account, {
        rail: RAIL[event.kind] || 'TRANSFER',
        direction: event.kind === 'IN' || event.credit ? 'CREDIT' : 'DEBIT',
        amount: event.amount,
        category: event.category,
        description: event.label || null,
        created_at: iso(event.date),
      });
      rows.transactions.push(tx);
      if (event.story) event.story.lines.push({ tx, event });

      if (event.kind === 'IN' || event.kind === 'OUT') {
        Object.assign(event, { remittance: remittanceOf(event) });
      }

      HANDLERS[event.kind](state, tx, event);
    });

  return { booked: state.booked, pendingDebits: state.pendingDebits };
}

/** Write balances line by line (booked order), then the account's own balance fields. */
function settle(account, openingBalance, booked, pendingDebits) {
  let balance = Number(openingBalance);
  booked
    .sort((a, b) => (a.booked_at < b.booked_at ? -1 : 1))
    .forEach(tx => {
      balance = round2(balance + (tx.direction === 'CREDIT' ? tx.amount : -tx.amount));
      tx.balance_after = balance;
    });
  const pending = pendingDebits.reduce((sum, tx) => sum + tx.amount, 0);
  Object.assign(account, {
    balance,
    available_balance: round2(balance - pending),
    last_activity_at: booked.length
      ? booked[booked.length - 1].booked_at
      : account.last_activity_at,
  });
}

// ---- putting it together ------------------------------------------------------------------------

const CONSUMER_CREDITORS = [
  'EDF',
  'Engie',
  'Orange',
  'SFR',
  'Free',
  'Bouygues Telecom',
  'AXA',
  'MAIF',
  'MACIF',
  'Basic-Fit',
  'Canal+',
];

function mandatesFor(rows, account, names, parties, b2b = []) {
  const opened = toDate(account.opened_at);

  return names.map(name => {
    const creditor = parties.creditors.find(c => c.name === name);
    const row = {
      id: uuid(),
      account_id: account.id,
      customer_id: account.customer_id,
      creditor_id: creditor.creditor.id,
      mandate_reference: `RUM${hex(12).toUpperCase()}`,
      type: b2b.includes(name) ? 'B2B' : 'CORE',
      signed_at: iso(new Date(opened.getTime() + between(1, 60) * DAY)),
      status: 'ACTIVE',
      revoked_at: null,
      last_collection_at: null,
    };
    rows.mandates.push(row);

    return {
      row,
      party: creditor.party,
      name,
      range: creditor.range,
      day: between(3, 15),
      collected: false,
    };
  });
}

/** A payee of one customer: its own SCT_BENEFICIARY counterparty and beneficiary row. */
function personPayee(rows, customer, name, added, account = otherBankAccount()) {
  const party = newCounterparty(rows, 'SCT_BENEFICIARY', name, 'FR');

  return { party, beneficiary: newBeneficiary(rows, customer, party, added, account) };
}

/** Money the bank's customers owe nobody: fees caused by a payment, credits to savings. */
function bookExtras(rows, ctx, booked) {
  ctx.extraFees.forEach(f => {
    if (f.date > NOW) return;
    const labels = {
      FOREIGN_CARD_PAYMENT: 'COMMISSION PAIEMENT HORS ZONE EURO',
      FOREIGN_ATM_WITHDRAWAL: 'COMMISSION RETRAIT HORS ZONE EURO',
      REJECTED_PAYMENT: 'FRAIS REJET PRELEVEMENT',
      INSTANT_TRANSFER: 'FRAIS VIREMENT INSTANTANE',
    };
    const tx = transactionRow(ctx.account, {
      rail: 'FEE',
      direction: 'DEBIT',
      amount: f.amount,
      category: 'FEES',
      description: labels[f.fee],
      created_at: iso(f.date),
      booked_at: iso(f.date),
      value_date: isoDate(f.date),
    });
    rows.transactions.push(tx);
    booked.push(tx);
    rows.fees.push({
      id: uuid(),
      transaction_id: tx.id,
      account_id: ctx.account.id,
      triggered_by_transaction_id: f.trigger.id,
      type: f.fee,
      amount: f.amount,
      currency: 'EUR',
      period: isoDate(f.date).slice(0, 7),
      status: 'CHARGED',
      charged_at: iso(f.date),
      waived_by: null,
      waiver_reason: null,
      waived_at: null,
      refunded_at: null,
      refund_transaction_id: null,
    });
  });
}

/** Close the books of a closed account: the remaining balance leaves, the account ends at zero. */
function closingPayout(rows, account, payee) {
  const balance = Number(account.balance);
  if (!account.closed_at || balance === 0) return;
  const at = toDate(account.closed_at);
  const tx = transactionRow(account, {
    rail: 'TRANSFER',
    direction: balance > 0 ? 'DEBIT' : 'CREDIT',
    amount: Math.abs(balance),
    category: 'TRANSFERS',
    description: balance > 0 ? 'VIR SEPA CLOTURE DE COMPTE' : 'REGULARISATION CLOTURE DE COMPTE',
    created_at: account.closed_at,
    booked_at: account.closed_at,
    value_date: isoDate(at),
    balance_after: 0,
  });

  if (balance > 0 && payee) {
    tx.counterparty_id = payee.party.id;
    outgoingDetail(
      rows,
      tx,
      { date: at },
      {
        beneficiary_id: payee.beneficiary.id,
        payee_check: 'MATCH',
        sca_method: 'EXEMPTED',
        // A large payout is a large transfer: it was validated too.
        validation_status: Math.abs(balance) > HIGH_VALUE ? 'APPROVED' : 'NOT_REQUIRED',
        validated_by: Math.abs(balance) > HIGH_VALUE ? 'claire.morel@forest-lab-bank.fr' : null,
        validated_at: Math.abs(balance) > HIGH_VALUE ? account.closed_at : null,
      },
    );
  }

  rows.transactions.push(tx);
  Object.assign(account, { balance: 0, available_balance: 0, last_activity_at: account.closed_at });
}

/**
 * Counterparties, cards, mandates and six months of statement for every account in `rows`.
 * `businesses` maps a business id to its row (with monthlyRevenue, removed afterwards).
 */
const PAYMENT_ROLES = ['HOLDER', 'JOINT_HOLDER', 'SIGNATORY'];

/** The people who can pay from a customer's accounts, main holder first. */
function holdersOf(rows, people, customer) {
  return rows.customer_members
    .filter(m => m.customer_id === customer.id)
    .filter(
      m =>
        PAYMENT_ROLES.includes(m.role) || (m.role === 'AUTHORISED_USER' && m.can_initiate_payments),
    )
    .map(m => people.get(m.individual_id));
}

/** A business pays rent, staff and suppliers, and owes social charges and VAT. */
function businessSetup(rows, ctx, added) {
  const { customer, payees, parties } = ctx;

  if (chance(0.7)) {
    payees.landlord = personPayee(
      rows,
      customer,
      // Past 30 names taken, another word: the same family's SCI is never two landlords.
      uniqueName(k => `SCI ${pick(COUNTRIES.FR.last)} ${k < 30 ? 'Immobilier' : 'Foncière'}`),
      added(),
    );
  }

  payees.employees = Array.from({ length: between(1, 8) }, () =>
    personPayee(rows, customer, personName(), added()),
  );
  // A supplier keeps its IBAN whoever pays it; each customer paying it has its own beneficiary.
  payees.suppliers = Array.from({ length: between(3, 8) }, () => {
    const company = pick(parties.companies);

    return personPayee(rows, customer, company.name, added(), company.account);
  });

  // A company leaving the bank sends its balance to its account at another bank.
  if (customer.status === 'OFFBOARDED') {
    payees.self = personPayee(rows, customer, ctx.business.legal_name, added());
  }

  const debits = ['URSSAF', 'DGFiP', pick(['Orange', 'SFR', 'EDF'])];
  ctx.mandates = mandatesFor(rows, ctx.account, debits, parties, ['URSSAF', 'DGFiP']);
  ctx.openingBalance = round2(ctx.business.monthlyRevenue * (0.2 + rand() * 0.5));
}

/** A household may pay rent, sends money to friends, and has a few direct debits. */
function retailSetup(rows, ctx, added) {
  const { customer, payees, parties, holder } = ctx;

  if (holder.employment_status !== 'RETIRED' && chance(0.6)) {
    payees.landlord = personPayee(rows, customer, personName(), added());
  }

  // The customer's own account at another bank, where a monthly surplus goes.
  payees.self = personPayee(rows, customer, `${holder.first_name} ${holder.last_name}`, added());
  payees.friends = Array.from({ length: between(0, 4) }, () =>
    personPayee(rows, customer, personName(), added()),
  );
  const names = CONSUMER_CREDITORS.slice()
    .sort(() => rand() - 0.5)
    .slice(0, between(2, 4));
  ctx.mandates = mandatesFor(rows, ctx.account, names, parties);
  ctx.openingBalance =
    Number(ctx.account.balance) || round2(customer.expected_monthly_in * (0.3 + rand() * 0.7));
}

/** The savings side of the top-ups, then the savings account's own balances. */
function savingsStatement(rows, ctx) {
  const { savingsAccount, payees } = ctx;
  const credits = ctx.savingsCredits.map(c => {
    const tx = transactionRow(savingsAccount, {
      rail: 'INTERNAL',
      direction: 'CREDIT',
      amount: c.amount,
      category: 'TRANSFERS',
      description: 'VIR INTERNE DEPUIS COMPTE COURANT',
      created_at: iso(c.date),
      booked_at: iso(c.date),
      value_date: isoDate(c.date),
    });
    rows.transactions.push(tx);

    return tx;
  });
  const opening = Number(savingsAccount.balance) - credits.reduce((sum, tx) => sum + tx.amount, 0);
  settle(savingsAccount, round2(Math.max(0, opening)), credits, []);
  closingPayout(rows, savingsAccount, payees.landlord || payees.friends[0]);
}

/**
 * The first money on an account opened inside the statement window: what it starts with arrives
 * from the customer's own account elsewhere, instead of being there already.
 */
function firstDeposit(ctx, opened) {
  // Opened before the six months of statement: it starts from its balance, as everyone's.
  if (opened < daysAgo(HISTORY_DAYS)) return [];
  const { holder, business, payees } = ctx;
  const own = payees.self?.beneficiary;
  const name = business ? business.legal_name : `${holder.first_name} ${holder.last_name}`;
  const from = ctx.payer(
    own
      ? { name, account: { iban: own.iban, bic: own.bic, bank_name: own.bank_name } }
      : identity(name),
  );
  // Minutes after the opening, before anything else moves on the account.
  const date = new Date(
    Math.max(
      opened.getTime() + 60000,
      Math.min(opened.getTime() + between(5, 90) * 60000, NOW.getTime() - 2 * 60000),
    ),
  );
  const event = {
    kind: 'IN',
    date,
    amount: ctx.openingBalance,
    from,
    category: 'TRANSFERS',
    label: `VIR SEPA ${upper(name)}`,
    remittance: business ? 'APPORT TRESORERIE' : 'PREMIER VERSEMENT',
  };
  ctx.openingBalance = 0;

  if (ctx.savingsAccount && toDate(ctx.savingsAccount.opened_at) >= daysAgo(HISTORY_DAYS)) {
    // A savings account opened since holds what was moved to it, nothing from before.
    Object.assign(ctx.savingsAccount, { balance: 0, available_balance: 0 });
  }

  return event.amount > 0 ? [event] : [];
}

/**
 * Everything about one customer's money: cards, payees, mandates, statements. None of a
 * `newcomer`'s transfers (onboarding-funnel.js) waits for validation: the payments desk keeps the
 * queue its own cases make.
 */
function customerBanking(rows, customer, shared, { newcomer = false } = {}) {
  const accounts = rows.accounts.filter(a => a.customer_id === customer.id);
  const main = accounts.find(a => a.type !== 'SAVINGS');
  if (!main) return null;
  const holders = holdersOf(rows, shared.people, customer);
  const holder = holders[0];
  let family = null;
  const emitters = new Map();
  const ctx: Record<string, any> = {
    shared,
    account: main,
    customer,
    holder,
    initiator: holder,
    business: customer.business_id ? shared.businesses.get(customer.business_id) : null,
    parties: shared.parties,
    cards: cardsFor(rows, main, customer, holders),
    payees: { friends: [], employees: [], suppliers: [], landlord: null },
    savingsAccount: accounts.find(a => a.type === 'SAVINGS'),
    extraFees: [],
    savingsCredits: [],
    // Each outside party who pays this customer becomes one SCT emitter of this customer.
    payer: id => {
      if (!emitters.has(id)) emitters.set(id, newEmitter(rows, customer, id));

      return emitters.get(id);
    },
    clientOf: () => ctx.payer(pick(shared.parties.companies)),
    familyOf: () => {
      family =
        family ||
        identity(
          uniqueName(
            () => `${pick(COUNTRIES.FR.male.concat(COUNTRIES.FR.female))} ${holder.last_name}`,
          ),
        );

      return ctx.payer(family);
    },
  };
  const opened = toDate(main.opened_at);
  const added = () => withTime(new Date(opened.getTime() + between(1, 200) * DAY));
  if (ctx.business) businessSetup(rows, ctx, added);
  else retailSetup(rows, ctx, added);

  weroSetup(rows, ctx);

  // An account opened within the statement starts from zero: its first deposit comes first.
  const deposit = firstDeposit(ctx, opened);
  // A wave B story (mule, takeover...) adds its own movements to the statement.
  const story = shared.stories.get(customer.id);
  const events = [
    ...deposit,
    ...(ctx.business ? businessEvents(ctx) : retailEvents(ctx)),
    ...(story ? story.events(rows, ctx).filter(e => e.date < NOW) : []),
  ]
    .filter(e => !newcomer || !waitsValidation(e))
    // Nothing moves before the first deposit: no negative balance on day one.
    .filter(e => !deposit.length || e === deposit[0] || e.date > deposit[0].date);
  Object.assign(ctx, statement(rows, ctx, events));
  bookExtras(rows, ctx, ctx.booked);

  return ctx;
}

/** Once every movement is booked (wallet credits included): balances, closing payouts, savings. */
function closeTheBooks(rows, ctx) {
  settle(ctx.account, ctx.openingBalance, ctx.booked, ctx.pendingDebits);
  const payee = ctx.business
    ? ctx.payees.self || ctx.payees.landlord
    : ctx.payees.landlord || ctx.payees.friends[0];
  closingPayout(rows, ctx.account, payee);
  if (ctx.savingsAccount) savingsStatement(rows, ctx);
}

// What coreBanking shared between customers (merchants, creditors, employers...), by rows: later
// customers (onboarding-funnel.js) bank with the same ones.
const SHARED = new WeakMap();
const sharedOf = rows => SHARED.get(rows);

/**
 * Counterparties, cards, mandates and six months of statement for every account in `rows`, with
 * the movements of the wave B stories (by customer id) mixed in.
 */
function coreBanking(rows, stories = new Map()) {
  const tables = [
    'counterparties',
    'card_merchants',
    'sct_emitters',
    'sct_beneficiaries',
    'sdd_creditors',
  ];
  tables
    .concat(['wero_contacts', 'mandates', 'cards', 'transactions', 'card_transactions'])
    .concat([
      'incoming_transfers',
      'outgoing_transfers',
      'direct_debits',
      'fees',
      'wero_payments',
      'wallet_transfers',
    ])
    .forEach(table => {
      rows[table] = [];
    });
  const shared = {
    parties: sharedParties(rows),
    people: new Map(rows.individuals.map(i => [i.id, i])),
    businesses: new Map(rows.businesses.map(b => [b.id, b])),
    walletOuts: drawWalletTransfers(rows, 250),
    walletCredits: [],
    walletPeers: new Map(),
    stories,
  };
  // Phase 1: every customer's own movements. Phase 2: wallet credits reach their receivers, then
  // balances are written, so both sides of a wallet transfer land on the same day.
  const ctxs = rows.customers
    .map(customer => customerBanking(rows, customer, shared))
    .filter(Boolean);
  creditWalletTransfers(rows, shared, new Map(ctxs.map(c => [c.account.id, c])));
  ctxs.forEach(ctx => closeTheBooks(rows, ctx));
  // Revenue only drove the statements; it isn't a column.
  rows.businesses.forEach(b => delete b.monthlyRevenue);
  SHARED.set(rows, shared);

  return rows;
}

export {
  closeTheBooks,
  coreBanking,
  customerBanking,
  sharedOf,
  identity,
  personPayee,
  toDate,
  monthLabel,
  digits,
  hex,
  upper,
  NOW,
  FOREIGN_CURRENCY,
  cardOn,
  businessEvents,
  cardsFor,
  newBeneficiary,
  newCounterparty,
  newEmitter,
  retailEvents,
  settle,
  sharedParties,
  statement,
  transactionRow,
  statementWindow,
  HISTORY_DAYS,
};

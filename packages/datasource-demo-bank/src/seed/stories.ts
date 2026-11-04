/**
 * Wave B stories: the few customers whose statements hide what a financial crime team looks for.
 * Each story picks a customer before the statements are simulated, adds its movements to that
 * customer's statement (banking.ts calls `story.events`), and keeps the lines it produced, so
 * crime.ts can raise the alerts, open the investigations and file the SARs about exactly them.
 *
 * - Money mules: young customers receive victims' transfers and forward them within hours to the
 *   same accounts abroad. Two collectors tie six customers together (the network view's ring).
 * - Split payments: a large sum arrives, then leaves in transfers just under the 10,000 EUR
 *   validation threshold.
 * - Account takeovers: a login from a new device abroad, an MFA reset, a phone change, a new payee
 *   and most of the balance sent to it (instantly, or held by the fraud rules).
 * - Card testing: a burst of tiny online payments at dubious merchants, then a real purchase.
 * - High-risk countries: business payments to suppliers in jurisdictions on the watch list.
 * - Sanctions: a payment to a company on the EU list, held by screening.
 */
import { cardOn, hex, identity, newCounterparty, personPayee, toDate, upper } from './banking';
import {
  DAY,
  NOW,
  between,
  daysAgo,
  iso,
  pick,
  random as rand,
  round2,
  uniqueName,
  uuid,
  withTime,
} from './random';
import { COUNTRIES, foreignBankAccount } from './reference';

const HOUR = 3600000;
const at = (date, hours) => new Date(date.getTime() + hours * HOUR);
const earlier = (a, b) => (a < b ? a : b);
const personName = country =>
  uniqueName(
    () =>
      `${pick(COUNTRIES[country].male.concat(COUNTRIES[country].female))} ${pick(
        COUNTRIES[country].last,
      )}`,
  );

// What victims write when they pay a mule: they think they are buying or renting something.
const VICTIM_REASONS = [
  'ACOMPTE LOCATION APPARTEMENT',
  'ACHAT VEHICULE',
  'RESERVATION VACANCES',
  'ACHAT CONSOLE',
  'PLACEMENT CRYPTO',
  'CAUTION LOGEMENT',
];

// The ring's two collector accounts abroad (fictional people and banks).
const COLLECTORS = [
  ['Darius Petrauskas', 'LT'],
  ['Konstantinou Trading Ltd', 'CY'],
];

// Where takeovers log in from: country, city, IP prefix.
const ATTACKERS = [
  ['RO', 'Bucharest', '86.124'],
  ['NG', 'Lagos', '105.112'],
  ['UA', 'Odesa', '91.200'],
];

// Online shops used to test stolen card numbers (fictional): name, MCC, country, city.
const TESTING_SHOPS = [
  ['GIFTCARDZ ONLINE', '5999', 'US', 'Wilmington'],
  ['DIGIKEYS STORE', '5816', 'GB', 'London'],
  ['QUICKDONATE', '8398', 'US', 'Dover'],
];

// Suppliers abroad, in jurisdictions on the bank's high-risk list (fictional).
const RISKY_SUPPLIERS = [
  ['Al Noor General Trading LLC', 'AE'],
  ['Anatolia Tekstil Sanayi A.S.', 'TR'],
];

// The company on the EU sanctions list (fictional), and the matching list entry in crime.ts.
const SANCTIONED = { name: 'Volga Maritime Trading LLC', country: 'CY' };

// ---- choosing who lives each story ------------------------------------------------------------

/** Active customers with an active account that existed through the whole statement window. */
function candidates(rows, type) {
  const accountOf = new Map();
  rows.accounts
    .filter(a => a.type !== 'SAVINGS' && a.status === 'ACTIVE')
    .filter(a => toDate(a.opened_at) < daysAgo(200))
    .forEach(a => accountOf.set(a.customer_id, a));
  const holderOf = new Map();
  const people = new Map(rows.individuals.map(i => [i.id, i]));
  rows.customer_members
    .filter(m => ['HOLDER', 'SIGNATORY'].includes(m.role))
    .forEach(m => {
      if (!holderOf.has(m.customer_id)) holderOf.set(m.customer_id, people.get(m.individual_id));
    });

  return rows.customers
    .filter(c => c.status === 'ACTIVE' && c.customer_type === type && accountOf.has(c.id))
    .map(c => ({ customer: c, account: accountOf.get(c.id), holder: holderOf.get(c.id) }))
    .filter(c => c.holder)
    .map(c => ({ ...c, order: rand() }))
    .sort((a, b) => a.order - b.order);
}

const age = person => (NOW.getTime() - new Date(person.date_of_birth).getTime()) / (365.25 * DAY);

/** Freeze every account of a customer from `date` (the statement stops there). */
function freeze(rows, customer, date, reason, note) {
  rows.accounts
    .filter(a => a.customer_id === customer.id && a.status !== 'CLOSED')
    .forEach(a =>
      Object.assign(a, {
        status: 'FROZEN',
        frozen_at: iso(date),
        freeze_reason: reason,
        freeze_note: note,
      }),
    );
}

// ---- the stories -------------------------------------------------------------------------------

/** The first two mules use the Lithuanian collector, the third both, the others the Cypriot one. */
function collectorsOf(i, collectors) {
  if (i < 2) return [collectors[0]];

  return i === 2 ? collectors : [collectors[1]];
}

/** Each victim's transfer comes in, and most of it leaves for a collector within hours. */
function muleEvents(rows, ctx, story, victims, maxGap) {
  const payees = story.collectors.map(c =>
    personPayee(rows, ctx.customer, c.name, at(story.start, -2), c.account),
  );
  story.payees = payees;

  return victims.flatMap((victim, k) => {
    const received = withTime(new Date(story.start.getTime() + k * between(1, maxGap) * DAY));
    const amount = between(90, 480) * 10;

    return [
      {
        kind: 'IN',
        date: received,
        amount,
        from: ctx.payer(victim),
        category: 'TRANSFERS',
        label: `VIR SEPA INST ${upper(victim.name)}`,
        remittance: pick(VICTIM_REASONS),
        story,
        role: 'VICTIM_IN',
      },
      {
        kind: 'OUT',
        date: at(received, between(2, 20)),
        amount: round2((amount * between(88, 95)) / 100),
        to: payees[k % payees.length],
        category: 'TRANSFERS',
        instant: true,
        label: 'VIR SEPA INST',
        remittance: pick(['FACTURE', 'REMBOURSEMENT', 'PRET', 'SERVICE']),
        story,
        role: 'FORWARD_OUT',
      },
    ];
  });
}

/**
 * Six mules, oldest first. The first three forward to the Lithuanian collector, the last three to
 * the Cypriot one (the Lithuanian account is blocked by then); the third uses both, which ties the
 * ring together. Two mules share a phone, and one victim paid two mules.
 */
function muleStories(rows, pool) {
  const mules = pool
    .filter(c => age(c.holder) < 32 && c.customer.risk_rating !== 'HIGH')
    .slice(0, 6);
  const collectors = COLLECTORS.map(([name, country]) => ({
    name,
    account: foreignBankAccount(country),
  }));
  const sharedVictim = identity(personName('FR'));
  const outcomes = ['SAR_FILED', 'SAR_FILED', 'PENDING_MLRO', 'IN_PROGRESS', 'IN_REVIEW', 'OPEN'];
  const starts = [150, 122, 74, 46, 15, 6];
  const sharedPhone = { id: uuid(), fingerprint: hex(32) };

  return mules.map((m, i) => {
    const start = withTime(daysAgo(starts[i]));
    const n = i >= 4 ? 3 : between(4, 5);
    const story = {
      kind: 'MULE',
      ...m,
      outcome: outcomes[i],
      start,
      collectors: collectorsOf(i, collectors),
      sharedPhone: i === 3 || i === 4 ? sharedPhone : null,
      lines: [],
    };
    // The oldest victim of the first two mules is the same person.
    const victims = Array.from({ length: n }, (_, k) =>
      i < 2 && k === 0 ? sharedVictim : identity(personName('FR')),
    );
    story.events = (allRows, ctx) => muleEvents(allRows, ctx, story, victims, i >= 4 ? 2 : 3);

    if (i < 4) {
      const last = new Date(start.getTime() + (n * 3 + 1) * DAY);
      const frozen = withTime(new Date(last.getTime() + between(5, 12) * DAY));
      story.frozenAt = earlier(frozen, withTime(daysAgo(1)));
      // Victims' money passes through: frozen to protect it while the case is open (crime.ts
      // lifts it once the case is closed).
      const note =
        'Protective freeze: money from fraud victims goes through this account. Frozen while the investigation is open.';
      freeze(rows, m.customer, story.frozenAt, 'AML_INVESTIGATION', note);
      if (i < 2) m.customer.status = 'SUSPENDED';
    }

    return story;
  });
}

/** A large sum arrives, then leaves in three or four transfers just under the threshold. */
function splitStories(pool) {
  return pool.slice(0, 2).map((m, i) => {
    const start = withTime(daysAgo([62, 5][i]));
    const story = { kind: 'SPLIT', ...m, outcome: ['IN_PROGRESS', 'OPEN'][i], start, lines: [] };

    story.events = (rows, ctx) => {
      const lastName = upper(pick(COUNTRIES.FR.last));
      const notary = identity(`Etude Maitre ${lastName} Notaires`);
      const payee = personPayee(rows, ctx.customer, personName('FR'), at(start, 20));
      const total = between(28, 38) * 1000;
      const events: Record<string, any>[] = [
        {
          kind: 'IN',
          date: start,
          amount: total,
          from: ctx.payer(notary),
          category: 'TRANSFERS',
          label: `VIR SEPA ${upper(notary.name)}`,
          remittance: `VENTE BIEN ${lastName}`,
          story,
          role: 'LARGE_IN',
        },
      ];
      Array.from({ length: between(3, 4) }).forEach((_, k) =>
        events.push({
          kind: 'OUT',
          date: withTime(new Date(start.getTime() + (k + 1) * DAY)),
          amount: round2(9400 + rand() * 550),
          to: payee,
          category: 'TRANSFERS',
          label: 'VIR SEPA',
          remittance: `PART ${k + 1}`,
          story,
          role: 'SPLIT_OUT',
        }),
      );

      return events;
    };

    return story;
  });
}

/** Login abroad, MFA reset, phone change, new payee, then most of the balance leaves instantly. */
function takeoverStories(pool) {
  return pool.slice(0, 3).map((m, i) => {
    const [country, city, ip] = ATTACKERS[i];
    const when =
      i === 0 ? withTime(daysAgo(52)) : new Date(NOW.getTime() - [0, 30, 5][i] * HOUR - 600000);
    const story = {
      kind: 'TAKEOVER',
      ...m,
      outcome: ['CLOSED', 'OPEN', 'IN_REVIEW'][i],
      start: at(when, -0.7),
      when,
      attacker: {
        id: uuid(),
        fingerprint: hex(32),
        country,
        city,
        ip: `${ip}.${between(1, 254)}.${between(1, 254)}`,
        platform: pick(['ANDROID', 'WEB']),
      },
      lines: [],
    };

    story.events = (rows, ctx) => {
      const name = personName(pick(['DE', 'IT', 'ES']));
      story.payee = personPayee(rows, ctx.customer, name, at(when, -0.1), foreignBankAccount('LT'));
      story.payee.beneficiary.added_from_device_id = story.attacker.id;
      story.payee.beneficiary.is_trusted = false;
      story.payee.beneficiary.payee_check = 'NOT_POSSIBLE';

      return [
        {
          kind: 'OUT',
          date: when,
          amount: round2(ctx.customer.expected_monthly_in * (0.5 + rand() * 0.2)),
          to: story.payee,
          category: 'TRANSFERS',
          // A held transfer waits for a decision: a standard SEPA one. An instant transfer is
          // executed or rejected within seconds, it is never held for hours.
          instant: i !== 2,
          label: i === 2 ? 'VIR SEPA' : 'VIR SEPA INST',
          remittance: 'REMBOURSEMENT',
          device: story.attacker.id,
          held: i === 0 ? null : 'Held by fraud rules: new device and new payee',
          story,
          role: 'TAKEOVER_OUT',
        },
      ];
    };

    return story;
  });
}

/** Ten tiny online payments in half an hour, then one real purchase with the tested card. */
function cardTestingStories(pool) {
  let shops = null;

  const shopsFor = rows => {
    shops =
      shops ||
      TESTING_SHOPS.map(([name, mcc, country, city]) => {
        const party = newCounterparty(rows, 'CARD_MERCHANT', name, country, { risk_level: 'HIGH' });
        const merchant = {
          id: uuid(),
          counterparty_id: party.id,
          mcc_code: mcc,
          category: 'SHOPPING',
          acquirer: 'Stripe',
          acquirer_merchant_id: String(between(1e9, 9e9)),
          city,
        };
        rows.card_merchants.push(merchant);

        return { party, merchant, name, category: 'SHOPPING', country, city, mcc };
      });

    return shops;
  };

  return pool.slice(0, 2).map((m, i) => {
    const start = withTime(daysAgo([36, 2][i]));
    const story = { kind: 'CARD_TESTING', ...m, outcome: ['CLOSED', 'OPEN'][i], start, lines: [] };

    story.events = (rows, ctx) => {
      const card = cardOn(ctx.cards, start);
      if (!card) return [];
      const list = shopsFor(rows);
      const events = Array.from({ length: between(8, 11) }, (_, k) => ({
        kind: 'CARD',
        date: at(start, k * 0.05),
        amount: round2(0.5 + rand() * 2.5),
        merchant: pick(list),
        card,
        mode: 'ONLINE',
        category: 'SHOPPING',
        story,
        role: 'TEST_PAYMENT',
      }));
      events.push({
        kind: 'CARD',
        date: at(start, 1.2),
        amount: round2(150 + rand() * 250),
        merchant: list[0],
        card,
        mode: 'ONLINE',
        category: 'SHOPPING',
        story,
        role: 'FRAUD_PAYMENT',
      });

      return events;
    };

    return story;
  });
}

/** A business pays a supplier in a high-risk jurisdiction. */
function highRiskStories(pool) {
  return pool.slice(0, 2).map((m, i) => {
    const [name, country] = RISKY_SUPPLIERS[i];
    const date = withTime(daysAgo([81, 9][i]));
    const story = {
      kind: 'HIGH_RISK',
      ...m,
      outcome: ['CLEARED', 'OPEN'][i],
      start: date,
      country,
      lines: [],
    };

    story.events = (rows, ctx) => {
      const payee = personPayee(
        rows,
        ctx.customer,
        name,
        at(date, -24 * 20),
        foreignBankAccount(country),
      );
      const amount = round2(
        Math.min(24000, ctx.business.monthlyRevenue * 0.35) * (0.9 + rand() * 0.2),
      );
      const client = ctx.clientOf();

      // A client's large order pays for the goods bought abroad two days later.
      return [
        {
          kind: 'IN',
          date: at(date, -48),
          amount: round2(amount * 1.3),
          from: client,
          category: 'TRANSFERS',
          label: `VIR SEPA ${upper(client.name)}`,
          remittance: `FACTURE ${between(10000, 99999)}`,
        },
        {
          kind: 'OUT',
          date,
          amount,
          to: payee,
          category: 'TRANSFERS',
          label: 'VIR SEPA',
          remittance: `INVOICE ${between(2000, 9999)}`,
          purpose: 'GDDS',
          story,
          role: 'HIGH_RISK_OUT',
        },
      ];
    };

    return story;
  });
}

/** A payment to a company on the EU list, stopped by screening yesterday. */
function sanctionsStory(pool) {
  const m = pool[0];
  const date = new Date(NOW.getTime() - 26 * HOUR);
  const story = { kind: 'SANCTIONS', ...m, outcome: 'OPEN', start: date, lines: [] };

  story.events = (rows, ctx) => {
    story.payee = personPayee(
      rows,
      ctx.customer,
      SANCTIONED.name,
      at(date, -0.5),
      foreignBankAccount(SANCTIONED.country),
    );

    return [
      {
        kind: 'OUT',
        date,
        amount: round2(Math.min(18500, ctx.business.monthlyRevenue * 0.3)),
        to: story.payee,
        category: 'TRANSFERS',
        label: 'VIR SEPA',
        remittance: `FREIGHT ${between(100, 999)}`,
        held: 'Held by sanctions screening: possible match on the EU list',
        story,
        role: 'SANCTIONS_OUT',
      },
    ];
  };

  return story;
}

/** Every story, by customer id. Called once the parties and accounts exist. */
function assignStories(rows) {
  const retail = candidates(rows, 'RETAIL');
  const business = candidates(rows, 'BUSINESS');
  const take = (pool, used) => pool.filter(c => !used.has(c.customer.id));
  const used = new Set();
  const all = [];
  const add = list =>
    list.forEach(s => {
      used.add(s.customer.id);
      all.push(s);
    });
  add(muleStories(rows, take(retail, used)));
  add(splitStories(take(retail, used).filter(c => c.customer.expected_monthly_in > 3000)));
  add(takeoverStories(take(retail, used)));
  add(cardTestingStories(take(retail, used)));
  add(highRiskStories(take(business, used)));
  add([sanctionsStory(take(business, used))]);

  return new Map(all.map(s => [s.customer.id, s]));
}

export { assignStories, SANCTIONED };

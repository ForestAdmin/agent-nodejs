/**
 * The stories behind the desks' history (desk-history.ts), and the words written from them.
 *
 * - Investigations: each case gets the movements of its story, booked on the customer's statement
 *   with the payers, payees and transfer details a real one has (money from people with no link to
 *   the customer sent abroad within 48 hours, an income far above the declared one, a car sold, an
 *   inheritance, a wedding paid by the family, a flat's deposit). The summary and the SAR's
 *   narrative are then written from those lines: their names, dates, amounts and countries.
 * - Alerts cleared by an analyst: the note says what the lines show (the merchant and what it
 *   sells, the payer and the payee, the month's income against the declared one).
 *
 * English text, English numbers ("12,450.00 EUR", "4 May"), French labels on the statements as the
 * banks write them.
 */
import {
  newBeneficiary,
  newCounterparty,
  newEmitter,
  toDate,
  transactionRow,
  upper,
} from './banking';
import { between, chance, iso, isoDate, pick, round2, uniqueName, uuid } from './random';
import { COUNTRIES, foreignBankAccount, otherBankAccount } from './reference';

const HOUR = 3600 * 1000;
const MINUTE = 60 * 1000;
const at = (date, hours) => new Date(date.getTime() + hours * HOUR);
const HIGH_VALUE = 10000;

const euros = n => `${Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2 })} EUR`;
const day = date =>
  new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Paris',
  });
const monthName = date =>
  new Date(date).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Paris',
  });
const sum = lines => round2(lines.reduce((s, tx) => s + Number(tx.amount), 0));

/** `n` moments from `start`, each `gap()` hours after the one before. */
const spaced = (start, n, gap) => {
  let time = start.getTime();

  return Array.from({ length: n }, (_, k) => {
    if (k) time += gap() * HOUR;

    return new Date(time);
  });
};

const lastOf = lines => toDate(lines.reduce((m, t) => (t.created_at > m ? t.created_at : m), ''));
const frenchName = (last = null) =>
  uniqueName(() => {
    const fr = COUNTRIES.FR;

    return `${pick(fr.male.concat(fr.female))} ${last || pick(fr.last)}`;
  });

// Payees abroad: fictional people and companies, their country and how the text names it.
const ABROAD = {
  LT: {
    name: 'Lithuania',
    first: ['Tomas', 'Mantas', 'Rasa', 'Lukas', 'Ieva', 'Darius', 'Egle', 'Jonas'],
    last: ['Kazlauskas', 'Jankauskas', 'Petrauskaite', 'Stankevicius', 'Vasiliauskas', 'Zukauskas'],
  },
  CY: {
    name: 'Cyprus',
    first: ['Andreas', 'Elena', 'Marios', 'Christos', 'Maria', 'Nikos', 'Sofia', 'Giorgos'],
    last: ['Georgiou', 'Christodoulou', 'Ioannou', 'Constantinou', 'Charalambous', 'Savva'],
  },
};
const abroadPerson = country =>
  uniqueName(() => `${pick(ABROAD[country].first)} ${pick(ABROAD[country].last)}`);
// Companies abroad: country, how the text names it, the legal form.
const ABROAD_FIRMS = [
  ['AE', 'the United Arab Emirates', 'FZE'],
  ['TR', 'Turkey', 'Ltd Sti'],
  ['CY', 'Cyprus', 'Ltd'],
];
const FIRM_WORDS = ['Meridian', 'Kordon', 'Halcyon', 'Orion', 'Atlas', 'Sable', 'Vertex', 'Nova'];
const FIRM_TRADES = ['Trade', 'Ventures', 'Holdings', 'Logistics', 'Commerce', 'Capital'];
const STRANGER_REASONS = [
  'ACOMPTE LOCATION',
  'ACHAT VEHICULE',
  'CAUTION LOGEMENT',
  'RESERVATION VACANCES',
  'ACHAT CONSOLE',
  'PLACEMENT',
];
const LOAN_LABELS = ['PRET', 'AVANCE', 'REMBOURSEMENT PRET'];
const CAR_BRANDS = ['PEUGEOT 308', 'RENAULT CLIO', 'CITROEN C3', 'TOYOTA YARIS', 'DACIA DUSTER'];
const VENUE_KINDS = ['Domaine', 'Château', 'Moulin', 'Manoir', 'Bastide', 'Ferme'];
const VENUE_PLACES = [
  'des Tilleuls',
  'de la Brède',
  'de Sénart',
  'des Vignes',
  'du Lac',
  'des Roses',
  'de Chantemerle',
  'du Prieuré',
];
const venueName = () => uniqueName(() => `${pick(VENUE_KINDS)} ${pick(VENUE_PLACES)}`);

// ---- booking a story's movement ----------------------------------------------------------------

/** The device a person used at `date`: their own phone first, never one revoked before it. */
function deviceOf(ctx, personId, date) {
  if (!ctx.devicesByPerson) {
    ctx.devicesByPerson = new Map();
    ctx.rows.devices.forEach(d => {
      if (!ctx.devicesByPerson.has(d.individual_id)) ctx.devicesByPerson.set(d.individual_id, []);
      ctx.devicesByPerson.get(d.individual_id).push(d);
    });
  }

  const list = (ctx.devicesByPerson.get(personId) || []).filter(
    d =>
      d.is_trusted !== false &&
      toDate(d.first_seen_at) <= date &&
      (!d.revoked_at || toDate(d.revoked_at) > date),
  );

  return list.find(d => d.platform !== 'WEB') || list[0] || null;
}

/** A booked line on the account, in the ledger and the history's statement indexes. */
function book(ctx, account, fields) {
  const tx = transactionRow(account, {
    status: 'BOOKED',
    booked_at: fields.created_at,
    value_date: fields.created_at.slice(0, 10),
    ...fields,
  });
  ctx.rows.transactions.push(tx);
  ctx.txOf.get(account.id).push(tx);
  ctx.txById.set(tx.id, tx);
  if (!ctx.linesOf.has(account.id)) ctx.linesOf.set(account.id, []);
  const lines = ctx.linesOf.get(account.id);
  lines.push(tx);
  lines.sort((a, b) => (a.created_at < b.created_at ? -1 : 1));

  if (tx.direction === 'DEBIT') {
    const times = ctx.debitsOf.get(account.customer_id) || [];
    times.push(toDate(tx.created_at).getTime());
    times.sort((a, b) => a - b);
    ctx.debitsOf.set(account.customer_id, times);
  }

  return tx;
}

/** Money in by SEPA transfer from `name` (a payer of this customer only). */
function moneyIn(ctx, story, { name, amount, date, remittance, instant = false }) {
  const { party, emitter } = newEmitter(ctx.rows, story.customer, {
    name,
    account: story.payerAccount ? story.payerAccount() : otherBankAccount(),
  });
  const tx = book(ctx, story.account, {
    rail: 'TRANSFER',
    direction: 'CREDIT',
    amount: round2(amount),
    category: 'TRANSFERS',
    counterparty_id: party.id,
    description: `${instant ? 'VIR SEPA INST' : 'VIR SEPA'} ${upper(name)}`,
    reference: remittance,
    created_at: iso(date),
  });
  ctx.rows.incoming_transfers.push({
    id: uuid(),
    transaction_id: tx.id,
    emitter_id: emitter.id,
    scheme: instant ? 'SEPA_INSTANT' : 'SEPA',
    end_to_end_id: `E2E${uuid().replace(/-/g, '').slice(0, 13).toUpperCase()}`,
    purpose_code: null,
    remittance_info: remittance,
  });
  ctx.inOf?.set(tx.id, ctx.rows.incoming_transfers[ctx.rows.incoming_transfers.length - 1]);
  story.parties.set(tx.id, { name, country: 'FR' });

  return tx;
}

/** A payee the customer adds from their phone shortly before paying it. */
function newPayee(ctx, story, { name, country, added, account }) {
  const party = newCounterparty(ctx.rows, 'SCT_BENEFICIARY', name, country);
  const beneficiary = newBeneficiary(ctx.rows, story.customer, party, added, account);
  const device = deviceOf(ctx, story.person.id, added);
  Object.assign(beneficiary, {
    payee_check: 'MATCH',
    payee_check_name: null,
    is_trusted: false,
    added_from_device_id: device ? device.id : null,
  });

  return { party, beneficiary, name, country };
}

/** Money out by SEPA transfer to a payee, from the customer's phone, under the validation line. */
function moneyOut(ctx, story, payee, { amount, date, remittance, instant = false }) {
  const device = deviceOf(ctx, story.person.id, date);
  const tx = book(ctx, story.account, {
    rail: 'TRANSFER',
    direction: 'DEBIT',
    amount: round2(Math.min(amount, HIGH_VALUE - 1)),
    category: 'TRANSFERS',
    counterparty_id: payee.party.id,
    initiated_by_id: story.person.id,
    device_id: device ? device.id : null,
    description: `${instant ? 'VIR SEPA INST' : 'VIR SEPA'} ${upper(payee.name)}`,
    reference: remittance,
    created_at: iso(date),
  });
  payee.beneficiary.last_used_at = iso(date);
  const detail = {
    id: uuid(),
    transaction_id: tx.id,
    beneficiary_id: payee.beneficiary.id,
    scheme: instant ? 'SEPA_INSTANT' : 'SEPA',
    initiated_via: 'BANKING_APP',
    end_to_end_id: `E2E${uuid().replace(/-/g, '').slice(0, 13).toUpperCase()}`,
    payee_check: payee.beneficiary.payee_check,
    validation_status: 'NOT_REQUIRED',
    validated_by: null,
    validated_at: null,
    requested_execution_date: isoDate(date),
    rejection_reason: null,
    sca_method: pick(['APP_CONFIRMATION', 'BIOMETRIC']),
    purpose_code: null,
    is_standing_order: false,
    callback_at: null,
    callback_result: null,
  };
  ctx.rows.outgoing_transfers.push(detail);
  ctx.outOf?.set(tx.id, detail);
  story.parties.set(tx.id, { name: payee.name, country: payee.country });

  return tx;
}

/** Amounts that add up to about `total`, `n` of them, rounded like people pay (tens). */
function split(total, n) {
  const weights = Array.from({ length: n }, () => 0.6 + between(0, 80) / 100);
  const all = weights.reduce((a, b) => a + b, 0);

  return weights.map(w => Math.max(50, Math.round((total * w) / all / 10) * 10));
}

// ---- the stories --------------------------------------------------------------------------------

/**
 * Each story books its lines from `start` on and returns them with the alert its rule would raise
 * (the line that sets it off), the notes on each line, and the summary written from them. `story`
 * holds the customer, its current account, the holder and the declared income.
 */
const STORIES = {
  // SAR: money from strangers, sent abroad within 48 hours.
  strangersAbroad(ctx, story, start) {
    const n = between(4, 7);
    const amounts = Array.from({ length: n }, () => between(30, 180) * 10);
    const times = spaced(start, n, () => between(3, 14) + between(0, 59) / 60);
    const credits = amounts.map((amount, k) =>
      moneyIn(ctx, story, {
        name: frenchName(),
        amount,
        date: times[k],
        remittance: pick(STRANGER_REASONS),
        instant: chance(0.7),
      }),
    );
    const country = pick(Object.keys(ABROAD));
    const last = lastOf(credits);
    const payee = newPayee(ctx, story, {
      name: abroadPerson(country),
      country,
      added: new Date(toDate(credits[0].created_at).getTime() - between(30, 300) * MINUTE),
      account: foreignBankAccount(country),
    });
    const total = sum(credits);
    const out = round2((total * between(86, 94)) / 100);
    const parts = out > 9000 ? [round2(out / 2), round2(out - round2(out / 2))] : [out];
    const debits = parts.map((amount, k) =>
      moneyOut(ctx, story, payee, {
        amount,
        date: at(last, between(2, 20) + 3 * k),
        remittance: pick(['FACTURE', 'SERVICE', 'REMBOURSEMENT']),
        instant: true,
      }),
    );
    const reasons = [...new Set(credits.map(c => c.reference))].slice(0, 2);

    return {
      alertType: 'RAPID_MOVEMENT',
      trigger: debits[debits.length - 1],
      lines: [...credits, ...debits],
      notes: tx =>
        tx.direction === 'CREDIT'
          ? 'Transfer from a person with no link to the customer'
          : `Sent on to ${payee.name} (${ABROAD[country].name}) within 48 hours`,
      summary: `Between ${day(credits[0].created_at)} and ${day(
        last,
      )}, ${n} transfers came in from ${n} people with no link to the customer (${euros(
        total,
      )}), with reasons such as “${reasons.join('” and “')}”. Within 48 hours ${euros(
        sum(debits),
      )} left for ${payee.name}, an account in ${ABROAD[country].name} added on ${day(
        payee.beneficiary.added_at.replace(' +00:00', 'Z').replace(' ', 'T'),
      )}. The customer could not say who the payers were or why the money went on.`,
      keywords: { abroad: true, within48: true, payers: n },
    };
  },

  // SAR: a company's payments passed through to a company abroad.
  passThroughAbroad(ctx, story, start) {
    const firm = uniqueName(
      () => `${pick(COUNTRIES.FR.last)} ${pick(['Conseil', 'Négoce', 'Import Export'])} SAS`,
    );
    const income = Number(story.customer.expected_monthly_in);
    const total = Math.min(
      9500,
      Math.max(4000, Math.round((income * between(25, 40)) / 10 / 10) * 10),
    );
    const n = total > 6000 ? 2 : 1;
    const firmTimes = spaced(start, n, () => between(20, 30));
    const credits = split(total, n).map((amount, k) =>
      moneyIn(ctx, story, {
        name: firm,
        amount,
        date: firmTimes[k],
        remittance: `FACTURE 2026-0${between(10, 99)}`,
      }),
    );
    const [country, countryName, form] = pick(ABROAD_FIRMS);
    const name = uniqueName(() => `${pick(FIRM_WORDS)} ${pick(FIRM_TRADES)} ${form}`);
    const last = lastOf(credits);
    const payee = newPayee(ctx, story, {
      name,
      country,
      added: at(toDate(credits[0].created_at), -between(2, 20)),
      account: foreignBankAccount(country),
    });
    const debit = moneyOut(ctx, story, payee, {
      amount: round2((sum(credits) * between(90, 96)) / 100),
      date: at(last, between(18, 40)),
      remittance: 'PAIEMENT FACTURE',
    });
    const job = (story.person.occupation || 'retail customer').toLowerCase();

    return {
      alertType: 'RAPID_MOVEMENT',
      trigger: debit,
      lines: [...credits, debit],
      notes: tx =>
        tx.direction === 'CREDIT'
          ? `Payment from ${firm}, with no contract behind it`
          : `Sent on to ${name} (${countryName}) within 48 hours`,
      summary: `${euros(sum(credits))} came in from ${firm} (“${credits[0].reference}”) on ${day(
        credits[0].created_at,
      )}, and ${euros(
        debit.amount,
      )} left within 48 hours for ${name}, an account in ${countryName}. The customer, a ${job}, has no business with either company and gave no contract or invoice.`,
      keywords: { abroad: true, within48: true, payers: 1 },
    };
  },

  // SAR: an income far above the declared one, with no source the customer could show.
  noSource(ctx, story, start) {
    const income = Number(story.customer.expected_monthly_in);
    const payers = [frenchName(), frenchName()];
    const n = between(3, 4);
    const total = Math.round((income * between(40, 60)) / 10 / 10) * 10;
    const loanTimes = spaced(start, n, () => between(40, 110));
    const credits = split(total, n).map((amount, k) =>
      moneyIn(ctx, story, {
        name: payers[k % 2],
        amount: Math.min(amount, 9800),
        date: loanTimes[k],
        remittance: pick(LOAN_LABELS),
      }),
    );
    const got = sum(credits);
    const times = round2(got / income).toFixed(1);

    return {
      alertType: 'UNUSUAL_VOLUME',
      trigger: credits[credits.length - 1],
      lines: credits,
      notes: () => 'Money in, no source of funds shown',
      summary: `${euros(got)} came in between ${day(credits[0].created_at)} and ${day(
        credits[credits.length - 1].created_at,
      )} from ${payers[0]} and ${payers[1]} (“${
        credits[0].reference
      }”), ${times} times the declared income of ${euros(
        income,
      )} a month. Asked where it came from, the customer spoke of loans from friends but showed no agreement and no reason for the amounts.`,
      keywords: { abroad: false, within48: false, payers: 2 },
    };
  },

  // No SAR: the sale of the customer's car.
  carSale(ctx, story, start) {
    const income = Number(story.customer.expected_monthly_in);
    const buyer = frenchName();
    const brand = pick(CAR_BRANDS);
    const credit = moneyIn(ctx, story, {
      name: buyer,
      amount: Math.max(2.5 * income, between(55, 140) * 100),
      date: start,
      remittance: `VENTE VEHICULE ${brand}`,
    });

    return {
      alertType: 'UNUSUAL_VOLUME',
      trigger: credit,
      lines: [credit],
      notes: () => 'The buyer’s payment for the car',
      summary: `${euros(credit.amount)} came in from ${buyer} on ${day(
        credit.created_at,
      )} (“VENTE VEHICULE ${brand}”): the sale of the customer’s car. The bill of sale and the registration transfer are on file.`,
      keywords: { abroad: false, within48: false, payers: 1 },
    };
  },

  // No SAR: an inheritance paid by the notary.
  inheritance(ctx, story, start) {
    const income = Number(story.customer.expected_monthly_in);
    const family = upper(story.person.last_name);
    const notary = uniqueName(() => `Étude de Maître ${pick(COUNTRIES.FR.last)}, notaire`);
    const credit = moneyIn(ctx, story, {
      name: notary,
      amount: Math.max(3 * income, between(80, 260) * 100),
      date: start,
      remittance: `SUCCESSION ${family}`,
    });

    return {
      alertType: 'UNUSUAL_VOLUME',
      trigger: credit,
      lines: [credit],
      notes: () => 'Paid by the notary settling the estate',
      summary: `${euros(credit.amount)} paid by ${notary} on ${day(
        credit.created_at,
      )} (“SUCCESSION ${family}”): an inheritance in the customer’s family. The notary’s statement is on file.`,
      keywords: { abroad: false, within48: false, payers: 1 },
    };
  },

  // No SAR: relatives pay for a wedding, the venue is paid within 48 hours.
  wedding(ctx, story, start) {
    const n = between(4, 6);
    const last = story.person.last_name;
    const giftTimes = spaced(start, n, () => between(4, 13));
    const credits = Array.from({ length: n }, (_, k) =>
      moneyIn(ctx, story, {
        name: frenchName(last),
        amount: between(15, 60) * 10,
        date: giftTimes[k],
        remittance: pick(['MARIAGE', 'CADEAU MARIAGE', 'PARTICIPATION MARIAGE']),
        instant: chance(0.5),
      }),
    );
    const end = lastOf(credits);
    const venue = newPayee(ctx, story, {
      name: venueName(),
      country: 'FR',
      added: at(toDate(credits[0].created_at), -between(24, 200)),
      account: otherBankAccount(),
    });
    const debit = moneyOut(ctx, story, venue, {
      amount: round2((sum(credits) * between(85, 98)) / 100),
      date: at(end, between(3, 30)),
      remittance: 'SOLDE RECEPTION MARIAGE',
    });

    return {
      alertType: 'RAPID_MOVEMENT',
      trigger: debit,
      lines: [...credits, debit],
      notes: tx =>
        tx.direction === 'CREDIT' ? `A relative’s gift (${last})` : 'The reception venue’s bill',
      summary: `Between ${day(credits[0].created_at)} and ${day(
        end,
      )}, ${n} transfers came in from relatives named ${last} (${euros(
        sum(credits),
      )}, “MARIAGE”), then ${euros(debit.amount)} went to ${
        venue.name
      } within 48 hours: the wedding reception. The venue’s invoice is on file; consistent with the family’s profile.`,
      keywords: { abroad: false, within48: true, payers: n },
    };
  },

  // No SAR: the customer's own savings, paid to the notary as a flat's deposit.
  flatDeposit(ctx, story, start) {
    const own = story.customer.display_name;
    const bank = otherBankAccount();
    const amount = between(60, 97) * 100;
    story.payerAccount = () => bank;
    const credit = moneyIn(ctx, story, {
      name: own,
      amount,
      date: start,
      remittance: 'EPARGNE',
    });
    delete story.payerAccount;
    const notary = newPayee(ctx, story, {
      name: uniqueName(() => `SCP ${pick(COUNTRIES.FR.last)} et Associés, notaires`),
      country: 'FR',
      added: at(start, -between(24, 120)),
      account: otherBankAccount(),
    });
    const debit = moneyOut(ctx, story, notary, {
      amount: round2(amount - between(0, 4) * 50),
      date: at(start, between(18, 40)),
      remittance: 'SEQUESTRE COMPROMIS',
    });

    return {
      alertType: 'RAPID_MOVEMENT',
      trigger: debit,
      lines: [credit, debit],
      notes: tx =>
        tx.direction === 'CREDIT'
          ? `From the customer’s own account at ${bank.bank_name}`
          : 'The deposit, held by the notary',
      summary: `${euros(credit.amount)} came in from the customer’s own account at ${
        bank.bank_name
      } on ${day(start)}, and ${euros(debit.amount)} went within 48 hours to ${
        notary.name
      } (“SEQUESTRE COMPROMIS”): the deposit for a flat. The sale agreement is on file.`,
      keywords: { abroad: false, within48: true, payers: 1 },
    };
  },
};

const SAR_STORIES = ['strangersAbroad', 'passThroughAbroad', 'noSource'];
const CLEAR_STORIES = ['carSale', 'inheritance', 'wedding', 'flatDeposit'];

/** How long a story takes from its first line to the line that sets the alert off, in hours. */
const STORY_HOURS = 120;

/**
 * Books the story `name` on the customer's statement from `start`, and returns what it wrote.
 * `story`: { customer, account, person }.
 */
function tellStory(ctx, name, story, start) {
  const told = STORIES[name](ctx, { ...story, parties: new Map() }, start);
  told.name = name;
  told.lines.sort((a, b) => (a.created_at < b.created_at ? -1 : 1));

  return told;
}

// ---- notes on cleared alerts ------------------------------------------------------------------

const MERCHANT_REASONS = {
  'Air France': amount =>
    `Flights booked with Air France (${amount}), a holiday the customer described on the call`,
  IKEA: amount => `Furniture from IKEA (${amount}); the customer sent the order confirmation`,
  Fnac: amount => `A laptop bought at Fnac (${amount}); the customer sent the invoice`,
  Decathlon: amount => `A bike bought at Decathlon (${amount}); the customer sent the invoice`,
  'El Corte Inglés': amount =>
    `Shopping at El Corte Inglés in Madrid (${amount}) during a stay in Spain the customer confirmed`,
  Amazon: amount => `A household appliance ordered on Amazon (${amount}); order confirmation sent`,
  'SNCF Connect': amount => `Train tickets for the family's holidays (${amount})`,
};

/** A card purchase far above the usual basket: confirmed, or explained by what the shop sells. */
function cardNote(trigger, clearance, { name, income }) {
  const merchant = name(trigger.tx.counterparty_id);
  const amount = euros(trigger.tx.amount);

  if (clearance === 'FALSE_POSITIVE') {
    return pick([
      `Customer confirmed the ${amount} payment to ${merchant} in the app the same day.`,
      `Customer confirmed the ${amount} payment to ${merchant} on a call back the same day.`,
    ]);
  }

  const reason = MERCHANT_REASONS[merchant] || (a => `A one-off purchase at ${merchant} (${a})`);

  return `${reason(amount)}, in line with the declared income of ${income} a month.`;
}

/** Money in, then out within 48 hours: the customer's own savings, salary and bills, shared costs. */
function movementNote(trigger, clearance, name) {
  const [debit, credit] = trigger.lines;
  const payee = name(debit.counterparty_id);
  const payer = name(credit.counterparty_id);
  const flow = `${euros(credit.amount)} from ${payer}, then ${euros(debit.amount)} to`;

  if (clearance !== 'FALSE_POSITIVE') {
    return `${flow} ${payee} within 48 hours: shared costs the customer collected and paid on; messages provided.`;
  }

  if (/MON COMPTE/.test(debit.description)) {
    return `${flow} the customer’s own account at another bank: savings, as every month.`;
  }

  if (credit.category === 'SALARY') {
    return `Salary: ${flow} ${payee}, the customer’s usual monthly payments.`;
  }

  return `${flow} ${payee}: the customer confirmed both and pays ${payee} regularly.`;
}

/** A month's money in above twice the declared income: two salaries, a bonus, a one-off. */
function volumeNote(trigger, clearance, { name, income }) {
  const month = monthName(toDate(trigger.lines[0].created_at));
  const top = trigger.lines.slice().sort((a, b) => b.amount - a.amount)[0];
  const topPayer = name(top.counterparty_id);
  const salaries = trigger.lines.filter(t => t.category === 'SALARY');

  if (clearance === 'FALSE_POSITIVE' && salaries.length >= 2) {
    return `Two salary payments from ${name(
      salaries[0].counterparty_id,
    )} in ${month} (the pay date moved); payslips provided.`;
  }

  if (clearance === 'FALSE_POSITIVE') {
    return `Money in during ${month} above the declared ${income}: the largest payment, ${euros(
      top.amount,
    )} from ${topPayer}, is a payer the customer has had for months.`;
  }

  if (top.category === 'SALARY') {
    return `A bonus paid with the salary by ${topPayer} in ${month} (${euros(
      top.amount,
    )}); the payslip is on file.`;
  }

  return `${euros(
    top.amount,
  )} from ${topPayer} in ${month}, a one-off the customer documented (a refund between relatives); in line with the profile.`;
}

/**
 * The analyst's note on a cleared alert, from its lines. FALSE_POSITIVE: nothing was wrong, the
 * customer confirmed the payment or the pattern is their everyday one. EXPLAINED_BY_PROFILE: out of
 * the ordinary for this customer, explained by a purchase or an income they documented.
 */
function clearanceNote(ctx, trigger, clearance) {
  const name = id => ctx.parties.get(id)?.name || 'the counterparty';
  const income = euros(trigger.customer.expected_monthly_in);
  if (trigger.type === 'UNUSUAL_CARD_SPEND') return cardNote(trigger, clearance, { name, income });
  if (trigger.type === 'RAPID_MOVEMENT') return movementNote(trigger, clearance, name);

  return volumeNote(trigger, clearance, { name, income });
}

export { CLEAR_STORIES, SAR_STORIES, STORY_HOURS, clearanceNote, deviceOf, euros, day, tellStory };

/**
 * Wave E: e-invoicing. The bank is an approved platform (plateforme agréée) for its business
 * customers. Since 1 September 2026 they all receive their suppliers' e-invoices through it; the
 * ones that started sending early also send theirs and file the e-reporting (SMEs must send from
 * 1 September 2027). Invoices come from the statements: a supplier paid "FACT 12345" had sent
 * invoice 12345, a client who paid "FACTURE 56457" had received invoice 56457.
 *
 * - Registrations in the national directory, one per business customer.
 * - Invoices received and sent with the life cycle the tax office expects; unpaid and overdue
 *   ones, a few rejected by the platform, one disputed, one refused.
 * - Payments matched to their invoice; a few only suggested (a typo in the reference, a partial
 *   payment), waiting for someone to confirm.
 * - Supplier invoices asking to be paid to another IBAN: rule FRD-005 raises an alert before
 *   anything is paid (one waiting, one genuine change, one fake invoice).
 * - E-reporting: sales to consumers every 10 days, cash received on services every month.
 */
const { digits, toDate } = require('./banking');
const { vatNumber } = require('./business');
const {
  NOW,
  alert,
  at,
  investigation,
  later,
  numberReferences,
  op,
  past,
  trail,
} = require('./crime');
const {
  DAY,
  between,
  chance,
  daysAgo,
  iso,
  isoDate,
  pick,
  round2,
  uuid,
  weighted,
  withTime,
} = require('./random');
const { foreignBankAccount, otherBankAccount } = require('./reference');
const { homeAddress } = require('./retail');

const WAVE_E = [
  'einvoicing_registrations',
  'invoices',
  'invoice_payments',
  'ereporting_submissions',
];
// Every company receives e-invoices from this day; SMEs send them from SENDING_SMES.
const REFORM = new Date('2026-09-01T00:00:00Z');
const SENDING_SMES = '2027-09-01';

const ago = date => (NOW - date) / DAY;
const earlierOf = (a, b) => (a < b ? a : b);
const days = (date, n) => new Date(new Date(date).getTime() + n * DAY);

// ---- who the other party is: the same company always has the same SIREN and address ----------

const luhnDigit = base => {
  const sum = [...base].reduce((total, c, i) => {
    let d = Number(c) * (i % 2 ? 2 : 1);
    if (d > 9) d -= 9;

    return total + d;
  }, 0);

  return String((10 - (sum % 10)) % 10);
};

/** A SIREN computed from the company's name: valid (Luhn), the same on every invoice. */
function sirenOf(key) {
  const hash = [...key].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 100000000, 7);
  const base = `${hash % 9 === 0 ? 4 : hash % 9}${String(hash).padStart(8, '0')}`.slice(0, 8);

  return `${base}${luhnDigit(`${base}`.padEnd(8, '0'))}`;
}

/** One company per name (names are unique in the bank): the same SIREN and address for all. */
function otherParty(ctx, counterpartyId) {
  const name = ctx.parties.get(counterpartyId)?.name || 'Client';

  if (!ctx.partyCard.has(name)) {
    const siren = sirenOf(name);
    const home = homeAddress('FR');
    ctx.partyCard.set(name, {
      other_party_name: name,
      other_party_siren: siren,
      other_party_vat_number: vatNumber(siren),
      other_party_address: `${home.address_line1}, ${home.postal_code} ${home.city}`,
    });
  }

  return ctx.partyCard.get(name);
}

const SERVICES = [
  'Software development',
  'Business consulting',
  'Design',
  'General practice',
  'Road freight',
  'Hotel',
  'Restaurant',
  'Hairdressing',
  'Property rental',
];
const GOODS = ['Bakery', 'Clothing retail', 'E-commerce'];

const natureOf = industry => {
  if (SERVICES.includes(industry)) return 'SERVICES';

  return GOODS.includes(industry) ? 'GOODS' : 'MIXED';
};

const VAT_RATES = { Restaurant: 10, Hotel: 10, Bakery: 5.5, 'General practice': 0 };

// ---- registrations in the directory ----------------------------------------------------------------

const VOLUNTARY = 0.45;
// Other approved platforms our customers chose (names made up for the demo).
const PLATFORMS = ['Factéo', 'Dematix', 'Plateforme Atlas Facture', 'NetFacture'];

function registration(ctx, customer) {
  const business = ctx.businesses.get(customer.business_id);
  const annual = Number(customer.expected_monthly_in || 0) * 12;
  const onboarded = customer.onboarded_at ? toDate(customer.onboarded_at) : null;
  const registered = onboarded && onboarded > REFORM ? at(onboarded, between(2, 30)) : null;
  const row = {
    id: uuid(),
    reference: null,
    customer_id: customer.id,
    business_id: business.id,
    siren: business.registration_number,
    routing_address: chance(0.2)
      ? `${business.registration_number}_FACTURES`
      : business.registration_number,
    receiving_platform: chance(0.1) ? 'OTHER_PLATFORM' : 'OUR_PLATFORM',
    other_platform: null,
    status: 'ACTIVE',
    company_size: annual > 2000000 ? 'SME' : 'MICRO',
    // Simplified VAT regime under 840,000 EUR of yearly sales, 254,000 for services.
    vat_regime:
      annual > (natureOf(business.industry) === 'SERVICES' ? 254000 : 840000)
        ? 'MONTHLY'
        : 'SIMPLIFIED',
    sending_mandatory_from: SENDING_SMES,
    sends_einvoices: false,
    voluntary_since: null,
    registered_at: iso(registered || withTime(new Date(REFORM.getTime() - between(5, 75) * DAY))),
    activated_at: null,
    left_at: null,
  };
  row.created_at = iso(at(toDate(row.registered_at), -between(1, 48)));

  if (customer.status === 'ONBOARDING') {
    Object.assign(row, { status: 'PENDING', registered_at: iso(past(withTime(daysAgo(1)))) });
    row.created_at = row.registered_at;
  } else {
    row.activated_at = iso(past(at(toDate(row.registered_at), between(24, 72))));
  }

  if (customer.status === 'OFFBOARDED') {
    const left = later(toDate(customer.updated_at), at(toDate(row.activated_at), 24));
    // It was published through us before leaving: our platform, whatever the draw said.
    Object.assign(row, {
      status: 'LEFT',
      left_at: iso(past(left)),
      receiving_platform: 'OUR_PLATFORM',
    });
  }

  // On another platform: in the directory, but we registered nothing for it.
  if (row.receiving_platform === 'OTHER_PLATFORM' && row.status === 'ACTIVE') {
    Object.assign(row, {
      registered_at: null,
      activated_at: null,
      other_platform: pick(PLATFORMS),
    });
  }

  return row;
}

function registrationHistory(ctx, row) {
  if (!row.registered_at) {
    const why = 'Found in the directory: receives through another platform';
    trail(ctx.rows, 'EINVOICING_REGISTRATIONS', row, [
      ['ACTIVE', toDate(row.created_at), 'system', why],
    ]);

    return;
  }

  const steps = [['PENDING', toDate(row.created_at), 'customer', 'Directory entry requested']];

  if (row.activated_at) {
    steps.push(['ACTIVE', toDate(row.activated_at), 'system', 'Published in the directory']);
  }

  if (row.left_at) steps.push(['LEFT', toDate(row.left_at), 'system', 'Customer left the bank']);
  trail(ctx.rows, 'EINVOICING_REGISTRATIONS', row, steps);
}

/** Every business customer since the reform; the larger ones on the monthly regime send early. */
function registrations(ctx) {
  ctx.rows.customers
    .filter(c => c.customer_type === 'BUSINESS' && c.business_id)
    .filter(c => c.status !== 'OFFBOARDED' || toDate(c.updated_at) > REFORM)
    .filter(c => c.status !== 'PROSPECT')
    .forEach(customer => {
      const row = registration(ctx, customer);
      ctx.rows.einvoicing_registrations.push(row);
      registrationHistory(ctx, row);
    });
  const candidates = ctx.rows.einvoicing_registrations.filter(
    r =>
      r.status === 'ACTIVE' &&
      r.receiving_platform === 'OUR_PLATFORM' &&
      r.vat_regime === 'MONTHLY' &&
      VAT_RATES[ctx.businesses.get(r.business_id).industry] !== 0,
  );
  candidates
    .filter((r, k) => k < 4 || chance(VOLUNTARY))
    .forEach(r =>
      Object.assign(r, {
        sends_einvoices: true,
        voluntary_since: isoDate(new Date(REFORM.getTime() + between(0, 20) * DAY)),
      }),
    );
}

// ---- invoices --------------------------------------------------------------------------------------

const WHAT = {
  'Software development': ['Développement de l’application', 'Maintenance et hébergement'],
  'Business consulting': ['Mission de conseil', 'Atelier de stratégie'],
  Design: ['Création de l’identité visuelle', 'Maquettes du site web'],
  'Road freight': ['Transport de marchandises', 'Affrètement complet'],
  Hotel: ['Nuitées et petits-déjeuners', 'Hébergement d’équipe'],
  Restaurant: ['Repas d’affaires', 'Traiteur pour un événement'],
  'House building': ['Travaux de gros œuvre', 'Fourniture et pose'],
  'Electrical installation': ['Installation électrique', 'Mise aux normes'],
  'E-commerce': ['Commande professionnelle', 'Lot de marchandises'],
  'Clothing retail': ['Vêtements de travail', 'Tenues du personnel'],
  Bakery: ['Viennoiseries pour une réception', 'Livraison hebdomadaire'],
};
const MOIS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];
/** What is billed, and for which month: "Mission de conseil, septembre 2026". */
const billed = (what, date) => `${what}, ${MOIS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
// What each kind of business buys: [what, nature, VAT rate].
const SUPPLIES = {
  Bakery: [
    ['Farine T65, sacs de 25 kg', 'GOODS', 5.5],
    ['Beurre AOP', 'GOODS', 5.5],
    ['Entretien du four', 'SERVICES', 20],
  ],
  Restaurant: [
    ['Produits frais', 'GOODS', 5.5],
    ['Vins et boissons', 'GOODS', 20],
    ['Nettoyage des hottes', 'SERVICES', 20],
  ],
  'Clothing retail': [
    ['Collection automne-hiver', 'GOODS', 20],
    ['Cintres et emballages', 'GOODS', 20],
  ],
  'E-commerce': [
    ['Emballages carton', 'GOODS', 20],
    ['Prestation logistique', 'SERVICES', 20],
    ['Hébergement de la boutique en ligne', 'SERVICES', 20],
  ],
  Hairdressing: [
    ['Produits capillaires', 'GOODS', 20],
    ['Entretien des fauteuils', 'SERVICES', 20],
  ],
  Hotel: [
    ['Linge et blanchisserie', 'SERVICES', 20],
    ['Produits d’accueil', 'GOODS', 20],
    ['Maintenance de la climatisation', 'SERVICES', 20],
  ],
  'Software development': [
    ['Hébergement cloud', 'SERVICES', 20],
    ['Licences logicielles', 'SERVICES', 20],
    ['Ordinateurs portables', 'GOODS', 20],
  ],
  'Business consulting': [
    ['Location de bureaux', 'SERVICES', 20],
    ['Licences logicielles', 'SERVICES', 20],
  ],
  'House building': [
    ['Béton prêt à l’emploi', 'GOODS', 20],
    ['Location de matériel de chantier', 'SERVICES', 20],
    ['Acier et ferraillage', 'GOODS', 20],
  ],
  'Road freight': [
    ['Gazole professionnel', 'GOODS', 20],
    ['Entretien des poids lourds', 'SERVICES', 20],
  ],
  'Electrical installation': [
    ['Câbles et tableaux électriques', 'GOODS', 20],
    ['Location de nacelle', 'SERVICES', 20],
  ],
  Design: [
    ['Licences logicielles', 'SERVICES', 20],
    ['Impression grand format', 'SERVICES', 20],
  ],
  'General practice': [
    ['Matériel médical', 'GOODS', 20],
    ['Logiciel de gestion du cabinet', 'SERVICES', 20],
  ],
  'Property rental': [
    ['Travaux d’entretien', 'SERVICES', 10],
    ['Honoraires de syndic', 'SERVICES', 20],
  ],
};
const DEFAULT_SUPPLIES = [
  ['Fournitures de bureau', 'GOODS', 20],
  ['Prestation de services', 'SERVICES', 20],
];
const supplyFor = (ctx, reg) =>
  pick(SUPPLIES[ctx.businesses.get(reg.business_id).industry] || DEFAULT_SUPPLIES);

/** A quantity and unit price that give the amount exactly: units of goods, days of work. */
function units(nature, excl) {
  const cents = Math.round(Number(excl) * 100);
  const sizes =
    nature === 'GOODS' ? [50, 40, 25, 20, 12, 10, 8, 5, 4, 2] : [20, 15, 10, 8, 5, 4, 2];
  const quantity = sizes.find(q => cents % q === 0 && cents / q >= 1000 && chance(0.7)) || 1;

  return { quantity, unit_price: round2(cents / quantity / 100) };
}

/** The amounts of an invoice from what it costs in total (VAT included). */
function amounts(total, rate) {
  const excl = round2(total / (1 + rate / 100));

  return {
    amount_incl_vat: round2(total),
    amount_excl_vat: excl,
    vat_rate: rate,
    vat_amount: round2(total - excl),
  };
}

function invoiceRow(ctx, reg, fields) {
  const business = ctx.businesses.get(reg.business_id);
  const row = {
    id: uuid(),
    reference: null,
    customer_id: reg.customer_id,
    business_id: reg.business_id,
    registration_id: reg.id,
    counterparty_id: null,
    vat_on_debits: false,
    currency: 'EUR',
    format: weighted([
      ['FACTUR_X', 70],
      ['UBL', 20],
      ['CII', 10],
    ]),
    status_reason: null,
    payee_iban: null,
    iban_check: null,
    alert_id: null,
    amount_paid: null,
    paid_at: null,
    ...fields,
  };

  if (row.direction === 'ISSUED') {
    row.payee_iban = (ctx.accountsOf.get(reg.customer_id) || [])[0]?.iban || null;
    row.nature = fields.nature === undefined ? natureOf(business.industry) : fields.nature;
    if (row.nature === 'SERVICES') row.vat_on_debits = chance(0.3);
  }

  row.submitted_at = row.submitted_at || iso(withTime(toDate(`${row.issue_date}T09:00:00Z`)));
  const delivered = days(`${row.issue_date}T12:00:00Z`, -between(0, 7));
  Object.assign(row, units(row.nature, row.amount_excl_vat), {
    delivery_date: isoDate(delivered),
    // What is billed is for the month it was delivered or done.
    description: row.description
      .replace(/, \S+ \d{4}$/, '')
      .concat(`, ${MOIS[delivered.getUTCMonth()]} ${delivered.getUTCFullYear()}`),
  });
  ctx.rows.invoices.push(row);

  return row;
}

function match(ctx, invoice, tx, status, reason) {
  const row = {
    id: uuid(),
    invoice_id: invoice.id,
    transaction_id: tx.id,
    amount: tx.amount,
    match_status: status,
    match_reason: reason,
    matched_by: status === 'SUGGESTED' ? null : 'system',
    matched_at: tx.booked_at,
  };
  ctx.rows.invoice_payments.push(row);

  return row;
}

/** The life of an invoice up to its current status. */
function invoiceHistory(ctx, inv, dates) {
  const by = inv.direction === 'ISSUED' ? 'customer' : inv.other_party_name;
  const submitted = toDate(inv.submitted_at);
  const steps = [['SUBMITTED', submitted, by]];

  if (inv.status === 'REJECTED') {
    steps.push(['REJECTED', at(submitted, 0.02), 'platform', inv.status_reason]);
  } else {
    steps.push(['ISSUED', at(submitted, 0.02), 'platform']);
    steps.push(['RECEIVED', at(submitted, 0.05), 'platform']);
  }

  const reached = name => dates[name] && steps.push([name, dates[name], dates.by, dates.why]);
  ['APPROVED', 'DISPUTED', 'REFUSED'].forEach(reached);

  if (dates.PAYMENT_SENT) {
    steps.push(['PAYMENT_SENT', dates.PAYMENT_SENT, 'platform', 'Payment matched']);
  }

  if (dates.CASHED) {
    steps.push(['CASHED', dates.CASHED, 'platform', 'Payment matched on the account']);
  }

  trail(ctx.rows, 'INVOICES', inv, steps);
  inv.updated_at = ctx.rows.status_changes[ctx.rows.status_changes.length - 1].changed_at;
}

const FACT = /FACT (\d{5})\b/;

/** A supplier paid by transfer since the reform had sent its invoice through the platform. */
function receivedPaid(ctx, reg, tx) {
  const out = ctx.outOf.get(tx.id);
  const payee = out && ctx.payees.get(out.beneficiary_id);
  const number = tx.description.match(FACT)?.[1];
  if (!payee || !number) return;
  const paid = toDate(tx.booked_at || tx.created_at);
  const issued = withTime(new Date(paid.getTime() - between(8, 35) * DAY));
  if (issued < REFORM) return;
  const [what, nature, rate] = supplyFor(ctx, reg);
  const inv = invoiceRow(ctx, reg, {
    invoice_number: number,
    direction: 'RECEIVED',
    counterparty_id: tx.counterparty_id,
    ...otherParty(ctx, tx.counterparty_id),
    description: billed(what, issued),
    nature,
    ...amounts(Number(tx.amount), rate),
    issue_date: isoDate(issued),
    due_date: isoDate(days(issued, 30)),
    status: 'PAYMENT_SENT',
    payee_iban: payee.iban,
    iban_check: payee.added_at && toDate(payee.added_at) < issued ? 'KNOWN' : 'NEW_SUPPLIER',
    amount_paid: tx.amount,
    paid_at: iso(paid),
  });
  match(ctx, inv, tx, 'AUTO_MATCHED', 'Reference and amount');
  const approved = earlierOf(at(issued, between(24, 96)), at(paid, -1));
  invoiceHistory(ctx, inv, { APPROVED: approved, by: 'customer', PAYMENT_SENT: paid });
  ctx.suppliersOf.get(reg.id).push({ payee, counterparty: tx.counterparty_id, amount: tx.amount });
}

/** A supplier invoice not paid yet: waiting, approved, or the customer disagrees with it. */
function receivedOpen(ctx, reg, supplier, fields = {}) {
  const issued = past(withTime(daysAgo(between(1, 20))));
  const [what, nature, rate] = supplyFor(ctx, reg);
  const inv = invoiceRow(ctx, reg, {
    invoice_number: digits(5),
    direction: 'RECEIVED',
    counterparty_id: supplier.counterparty,
    ...otherParty(ctx, supplier.counterparty),
    description: billed(what, issued),
    nature,
    ...amounts(round2(Number(supplier.amount) * (0.6 + between(0, 80) / 100)), rate),
    issue_date: isoDate(issued),
    due_date: isoDate(days(issued, 30)),
    status: ago(issued) > 3 ? 'APPROVED' : 'RECEIVED',
    payee_iban: supplier.payee.iban,
    iban_check: 'KNOWN',
    ...fields,
  });
  const dates = { by: 'customer', why: fields.status_reason || null };
  if (inv.status !== 'RECEIVED') dates[inv.status] = past(at(issued, between(20, 60)));
  invoiceHistory(ctx, inv, dates);

  return inv;
}

/** A client who paid "FACTURE 56457" after the customer started sending e-invoices. */
function issuedPaid(ctx, reg, tx, twist) {
  const incoming = ctx.inOf.get(tx.id);
  const number = incoming?.remittance_info?.match(/^FACTURE (\d{5})$/)?.[1];
  if (!number) return false;
  const paid = toDate(tx.booked_at || tx.created_at);
  const issued = withTime(new Date(paid.getTime() - between(10, 40) * DAY));
  if (issued < toDate(`${reg.voluntary_since}T00:00:00Z`)) return false;
  const business = ctx.businesses.get(reg.business_id);
  const swapped = `${number.slice(0, 3)}${number[4]}${number[3]}`;
  if (twist === 'TYPO' && swapped === number) return false;
  const total = twist === 'PARTIAL' ? round2(Number(tx.amount) * 1.25) : Number(tx.amount);
  const typo = twist === 'TYPO' ? swapped : number;
  const inv = invoiceRow(ctx, reg, {
    invoice_number: typo,
    direction: 'ISSUED',
    counterparty_id: tx.counterparty_id,
    ...otherParty(ctx, tx.counterparty_id),
    description: billed(pick(WHAT[business.industry] || ['Prestation de services']), issued),
    ...amounts(total, VAT_RATES[business.industry] ?? 20),
    issue_date: isoDate(issued),
    due_date: isoDate(days(issued, 30)),
    status: twist ? 'APPROVED' : 'CASHED',
    amount_paid: twist ? null : tx.amount,
    paid_at: twist ? null : iso(paid),
  });
  const approved = earlierOf(at(issued, between(24, 120)), at(paid, -2));
  const dates = { APPROVED: approved, by: inv.other_party_name };

  if (!twist) {
    match(ctx, inv, tx, 'AUTO_MATCHED', 'Reference and amount');
    dates.CASHED = paid;
  } else if (twist === 'TYPO') {
    match(
      ctx,
      inv,
      tx,
      'SUGGESTED',
      `The transfer says FACTURE ${number}, the invoice is ${typo}: same client, same amount`,
    );
  } else {
    const due = Number(inv.amount_incl_vat).toFixed(2);
    match(
      ctx,
      inv,
      tx,
      'SUGGESTED',
      `Partial payment: ${Number(tx.amount).toFixed(2)} of ${due} EUR`,
    );
  }

  invoiceHistory(ctx, inv, dates);
  ctx.clientsOf.get(reg.id).push(tx.counterparty_id);

  return true;
}

const REJECTIONS = [
  [
    'Buyer SIREN missing: mandatory on every invoice since September 2026.',
    { other_party_siren: null },
  ],
  ['Buyer not found in the directory: no routing address for this SIREN.', {}],
  ['Nature of the operation (goods, services or both) missing.', { nature: null }],
];

/** An invoice the customer is sending: on its way, approved, overdue, or rejected by the platform. */
function issuedOpen(ctx, reg, client, rejection) {
  const business = ctx.businesses.get(reg.business_id);
  const since = toDate(`${reg.voluntary_since}T08:00:00Z`);
  const issued = past(later(withTime(daysAgo(rejection ? between(0, 4) : between(1, 45))), since));
  const typical = Number(ctx.customers.get(reg.customer_id).expected_monthly_in || 20000) / 8;
  const [reason, broken] = rejection || [null, {}];
  const inv = invoiceRow(ctx, reg, {
    invoice_number: digits(5),
    direction: 'ISSUED',
    counterparty_id: client,
    ...otherParty(ctx, client),
    description: billed(pick(WHAT[business.industry] || ['Prestation de services']), issued),
    ...amounts(round2(typical * (0.5 + between(0, 100) / 100)), VAT_RATES[business.industry] ?? 20),
    issue_date: isoDate(issued),
    due_date: isoDate(days(issued, 30)),
    status: 'RECEIVED',
    status_reason: reason,
    ...broken,
  });
  const dates = { by: inv.other_party_name };

  if (rejection) {
    inv.status = 'REJECTED';
  } else if (ago(issued) > 4) {
    inv.status = 'APPROVED';
    dates.APPROVED = past(at(issued, between(24, 90)));
  }

  invoiceHistory(ctx, inv, dates);
}

function receivedInvoices(ctx, reg) {
  const accounts = new Set((ctx.accountsOf.get(reg.customer_id) || []).map(a => a.id));
  ctx.rows.transactions
    .filter(
      tx =>
        accounts.has(tx.account_id) &&
        tx.rail === 'TRANSFER' &&
        tx.direction === 'DEBIT' &&
        tx.status === 'BOOKED' &&
        toDate(tx.created_at) > REFORM,
    )
    .forEach(tx => receivedPaid(ctx, reg, tx));
  const suppliers = ctx.suppliersOf.get(reg.id);

  for (let k = 0; k < between(0, 2) && suppliers.length; k += 1) {
    receivedOpen(ctx, reg, pick(suppliers));
  }
}

function issuedInvoices(ctx, reg) {
  const accounts = new Set((ctx.accountsOf.get(reg.customer_id) || []).map(a => a.id));
  ctx.rows.transactions
    .filter(
      tx =>
        accounts.has(tx.account_id) &&
        tx.rail === 'TRANSFER' &&
        tx.direction === 'CREDIT' &&
        tx.status === 'BOOKED',
    )
    .forEach(tx => {
      // Two payments that do not match cleanly, for someone to confirm.
      const twist = ctx.twists.length && chance(0.3) ? ctx.twists[0] : null;
      if (issuedPaid(ctx, reg, tx, twist) && twist) ctx.twists.shift();
    });
  const clients = ctx.clientsOf.get(reg.id);
  for (let k = 0; k < between(1, 3) && clients.length; k += 1) issuedOpen(ctx, reg, pick(clients));
}

// ---- a changed supplier IBAN: checked before anything is paid ------------------------------------

const IBAN_CASES = [
  {
    outcome: 'OPEN',
    status: 'RECEIVED',
    reason: 'Payment on hold: the IBAN differs from the one we know for this supplier.',
    account: () => otherBankAccount(),
  },
  {
    outcome: 'CLEARED',
    status: 'APPROVED',
    note: 'Supplier called on the number in our records: it moved to another bank, change letter on file.',
    account: () => otherBankAccount(),
  },
  {
    outcome: 'ESCALATED',
    status: 'REFUSED',
    reason: 'Fake invoice: the supplier never changed its bank details.',
    account: () => foreignBankAccount('LT'),
  },
];
const FAKE_INVOICE =
  'Invoice sent from a known supplier’s account on its e-invoicing platform, which had been hijacked, asking to be paid to an account in Lithuania. Called on the number in our records, the supplier never changed bank: a fake invoice. Nothing was paid; the customer, the supplier and its platform were warned.';

function ibanCase(ctx, reg, supplier, spec) {
  const account = spec.account();
  const inv = receivedOpen(ctx, reg, supplier, {
    status: spec.status,
    status_reason: spec.reason || null,
    payee_iban: account.iban,
    iban_check: 'CHANGED',
  });
  const triggered = at(toDate(inv.submitted_at), 0.1);
  const signal = alert(ctx, {
    type: 'INVOICE_IBAN_CHANGE',
    customer: ctx.customers.get(reg.customer_id),
    triggered,
    lines: [],
    outcome: spec.outcome,
    clearance: 'VERIFIED_WITH_COUNTERPARTY',
    note: spec.note,
    score: 81,
  });
  inv.alert_id = signal.id;
  if (spec.outcome !== 'ESCALATED') return;
  const inv2 = investigation(ctx, {
    customer: ctx.customers.get(reg.customer_id),
    type: 'FRAUD',
    origin: 'ALERTS',
    opened: toDate(signal.escalated_at),
    status: 'IN_PROGRESS',
    decision: 'NO_SAR',
    lines: [],
    summary: FAKE_INVOICE,
    priority: 'HIGH',
    amount: inv.amount_incl_vat,
    quiet: true,
  });
  signal.investigation_id = inv2.id;
}

function ibanChanges(ctx) {
  const regs = ctx.rows.einvoicing_registrations.filter(r => ctx.suppliersOf.get(r.id)?.length);
  IBAN_CASES.forEach((spec, k) => {
    const reg = regs[(k * 7) % regs.length];
    if (reg) ibanCase(ctx, reg, pick(ctx.suppliersOf.get(reg.id)), spec);
  });
}

/** One supplier invoice the customer disputes, one it refuses. */
function disagreements(ctx) {
  const open = ctx.rows.invoices.filter(
    i => i.direction === 'RECEIVED' && i.status === 'APPROVED' && i.iban_check !== 'CHANGED',
  );
  const counted = open.filter(i => i.quantity >= 4);
  [
    [
      'DISPUTED',
      i =>
        `Quantity delivered lower than invoiced: ${
          i.quantity - Math.ceil(i.quantity / 5)
        } received, ${i.quantity} billed.`,
      counted[0],
    ],
    ['REFUSED', () => 'No order matches this invoice.', open.find(i => i !== counted[0])],
  ].forEach(([status, explain, inv]) => {
    if (!inv) return;
    const reason = explain(inv);
    const when = past(at(toDate(inv.updated_at), between(4, 30)));
    Object.assign(inv, { status, status_reason: reason, updated_at: iso(when) });
    ctx.rows.status_changes.push({
      id: uuid(),
      record_type: 'INVOICES',
      record_id: inv.id,
      field: 'status',
      old_value: 'APPROVED',
      new_value: status,
      changed_by: 'customer',
      changed_at: iso(when),
      reason,
    });
  });
}

// ---- e-reporting -------------------------------------------------------------------------------------

const utc = (year, month, date) => new Date(Date.UTC(year, month, date));
const monthEnd = d => utc(d.getUTCFullYear(), d.getUTCMonth() + 1, 0);

/** The 10-day period (1-10, 11-20, 21-end) that `d` falls in. */
function decadeOf(d) {
  const first = [21, 11, 1].find(n => d.getUTCDate() >= n);
  const start = utc(d.getUTCFullYear(), d.getUTCMonth(), first);

  return [start, first === 21 ? monthEnd(d) : new Date(start.getTime() + 9 * DAY)];
}

/** The periods from the one holding `from` to the last one ended before today. */
function periods(from, periodOf) {
  const list = [];

  for (let p = periodOf(from); p[1] < NOW; p = periodOf(new Date(p[1].getTime() + DAY))) {
    list.push(p);
  }

  return list;
}

const monthOf = d => [utc(d.getUTCFullYear(), d.getUTCMonth(), 1), monthEnd(d)];

const inPeriod = (date, [start, end]) => {
  const d = String(date).slice(0, 10);

  return d >= isoDate(start) && d <= isoDate(end);
};

function submission(ctx, reg, flow, period, due, lines, rate) {
  const total = lines.reduce((sum, x) => sum + Number(x.amount), 0);
  const row = {
    id: uuid(),
    reference: null,
    registration_id: reg.id,
    customer_id: reg.customer_id,
    business_id: reg.business_id,
    flow,
    period_start: isoDate(period[0]),
    period_end: isoDate(period[1]),
    due_date: isoDate(due),
    status: 'TO_SUBMIT',
    record_count: lines.length,
    amount_excl_vat: amounts(total, rate).amount_excl_vat,
    vat_amount: amounts(total, rate).vat_amount,
    submitted_at: null,
    answered_at: null,
    rejection_reason: null,
    replaces_id: null,
    created_at: iso(withTime(new Date(period[1].getTime() + DAY))),
  };
  ctx.rows.ereporting_submissions.push(row);

  return row;
}

/** Sent before the due date and accepted, rejected (then corrected), late, or still to send. */
function settleSubmission(ctx, row, fate) {
  const due = toDate(`${row.due_date}T18:00:00Z`);
  const steps = [['TO_SUBMIT', toDate(row.created_at), 'system']];

  if (fate === 'LATE' || due > NOW) {
    trail(ctx.rows, 'EREPORTING_SUBMISSIONS', row, steps);

    return;
  }

  const sent = withTime(new Date(due.getTime() - between(1, 6) * DAY));
  const answered = at(sent, between(1, 20));
  Object.assign(row, {
    status: fate === 'REJECTED' ? 'REJECTED' : 'ACCEPTED',
    submitted_at: iso(sent),
    answered_at: iso(answered),
    rejection_reason: fate === 'REJECTED' ? 'VAT total does not match the sum of the lines.' : null,
  });
  steps.push(['SUBMITTED', sent, 'platform']);
  steps.push([row.status, answered, 'DGFiP', row.rejection_reason]);
  trail(ctx.rows, 'EREPORTING_SUBMISSIONS', row, steps);
  if (fate !== 'REJECTED') return;
  const fixed = {
    ...row,
    id: uuid(),
    replaces_id: row.id,
    status: 'ACCEPTED',
    rejection_reason: null,
  };
  Object.assign(fixed, {
    created_at: iso(at(answered, 2)),
    submitted_at: iso(at(answered, 5)),
    answered_at: iso(at(answered, 9)),
  });
  ctx.rows.ereporting_submissions.push(fixed);
  trail(ctx.rows, 'EREPORTING_SUBMISSIONS', fixed, [
    ['TO_SUBMIT', toDate(fixed.created_at), op('support'), 'Correction of a rejected submission'],
    ['SUBMITTED', toDate(fixed.submitted_at), 'platform'],
    ['ACCEPTED', toDate(fixed.answered_at), 'DGFiP'],
  ]);
}

const CARD_SALES = /REMISE CB/;

/** One submission rejected then corrected, one late (due in the last 11 days): the desk's work. */
function fateOf(fates, due) {
  if (due >= NOW || !fates.length) return null;
  if (fates[0] === 'REJECTED' && chance(0.5)) return fates.shift();
  // Due dates come every 10 days (the 10th, 20th, 30th): within 11 days there is always one.
  if (fates[0] === 'LATE' && ago(due) < 11) return fates.shift();

  return null;
}

function ereporting(ctx) {
  const fates = ['REJECTED', 'LATE'];
  ctx.rows.einvoicing_registrations
    .filter(r => r.sends_einvoices)
    .forEach(reg => {
      const business = ctx.businesses.get(reg.business_id);
      const rate = VAT_RATES[business.industry] ?? 20;
      const since = toDate(`${reg.voluntary_since}T00:00:00Z`);
      const accounts = new Set((ctx.accountsOf.get(reg.customer_id) || []).map(a => a.id));
      const sales = ctx.rows.transactions.filter(
        tx =>
          accounts.has(tx.account_id) && tx.status === 'BOOKED' && CARD_SALES.test(tx.description),
      );
      // Sales to consumers (card takings): every 10 days, due 10 days after the period.
      periods(since, decadeOf).forEach(period => {
        const lines = sales.filter(tx => inPeriod(tx.booked_at, period));
        if (!lines.length) return;
        const due = days(period[1], 10);
        const row = submission(ctx, reg, 'TRANSACTIONS', period, due, lines, rate);
        settleSubmission(ctx, row, fateOf(fates, due));
      });
      // Cash received on services sold to consumers (VAT due on payment): monthly, by the 10th.
      // Domestic B2B e-invoices report theirs through the CASHED status instead.
      const cashed = natureOf(business.industry) === 'SERVICES' ? sales : [];
      periods(since, monthOf).forEach(period => {
        const lines = cashed.filter(tx => inPeriod(tx.booked_at, period));
        if (!lines.length) return;
        const due = new Date(Date.UTC(period[1].getUTCFullYear(), period[1].getUTCMonth() + 1, 10));
        settleSubmission(ctx, submission(ctx, reg, 'PAYMENTS', period, due, lines, rate), null);
      });
    });
}

/** The next number after `number`, with its last two digits swapped: a typo in a transfer. */
const typoOf = number => {
  const [a, b] = number.slice(-2);

  return a === b
    ? `${number.slice(0, -1)}${(Number(b) + 1) % 10}`
    : `${number.slice(0, -2)}${b}${a}`;
};

/** Rewrite the invoice number a payment quotes, in its statement line and its remittance. */
function quote(ctx, txId, number) {
  const tx = ctx.txById.get(txId);
  const swap = text => text && text.replace(/(FACT(?:URE)?) [A-Z0-9-]+/, `$1 ${number}`);
  tx.description = swap(tx.description);
  tx.reference = swap(tx.reference);
  const incoming = ctx.inOf.get(txId);
  if (incoming) incoming.remittance_info = swap(incoming.remittance_info);
}

/**
 * One continuous sequence per seller, in issue order (French tax code): our customers number every
 * invoice they send; a supplier's numbers jump, it bills other clients too. Payments quote them.
 */
function renumber(ctx) {
  const bySeller = new Map();
  ctx.rows.invoices.forEach(inv => {
    const seller = inv.direction === 'ISSUED' ? inv.business_id : inv.counterparty_id;
    if (!bySeller.has(seller)) bySeller.set(seller, []);
    bySeller.get(seller).push(inv);
  });
  ctx.txById = new Map(ctx.rows.transactions.map(t => [t.id, t]));
  bySeller.forEach(list => {
    let n = between(40, 900);
    list
      .sort((a, b) =>
        `${a.issue_date}${a.submitted_at}` < `${b.issue_date}${b.submitted_at}` ? -1 : 1,
      )
      .forEach(inv => {
        n += inv.direction === 'ISSUED' ? 1 : between(3, 40);
        const number = `FA${inv.issue_date.slice(0, 4)}-${String(n).padStart(4, '0')}`;
        inv.invoice_number = number;
        ctx.rows.invoice_payments
          .filter(p => p.invoice_id === inv.id)
          .forEach(p => {
            const typo = p.match_reason.startsWith('The transfer says');
            quote(ctx, p.transaction_id, typo ? typoOf(number) : number);

            if (typo) {
              p.match_reason = `The transfer says ${typoOf(
                number,
              )}, the invoice is ${number}: same client, same amount`;
            }
          });
      });
  });
}

// ---- putting it together -------------------------------------------------------------------------

function indexes(ctx) {
  const { rows } = ctx;
  const byTx = table => new Map(rows[table].map(r => [r.transaction_id, r]));
  ctx.outOf = byTx('outgoing_transfers');
  ctx.inOf = byTx('incoming_transfers');
  ctx.payees = new Map(rows.sct_beneficiaries.map(b => [b.id, b]));
  ctx.parties = new Map(rows.counterparties.map(c => [c.id, c]));
  ctx.partyCard = new Map();
  ctx.suppliersOf = new Map();
  ctx.clientsOf = new Map();
  ctx.twists = ['TYPO', 'PARTIAL'];
}

function einvoicing(ctx) {
  WAVE_E.forEach(t => {
    ctx.rows[t] = [];
  });
  indexes(ctx);
  registrations(ctx);
  const active = ctx.rows.einvoicing_registrations.filter(
    r => r.status !== 'PENDING' && r.receiving_platform === 'OUR_PLATFORM',
  );
  active.forEach(reg => {
    ctx.suppliersOf.set(reg.id, []);
    ctx.clientsOf.set(reg.id, []);
    receivedInvoices(ctx, reg);
    if (reg.sends_einvoices) issuedInvoices(ctx, reg);
  });
  const senders = active.filter(r => r.sends_einvoices && ctx.clientsOf.get(r.id).length);
  REJECTIONS.forEach((rejection, k) => {
    const reg = senders[k % senders.length];
    if (reg) issuedOpen(ctx, reg, pick(ctx.clientsOf.get(reg.id)), rejection);
  });
  ibanChanges(ctx);
  disagreements(ctx);
  ctx.invoiceById = new Map(ctx.rows.invoices.map(i => [i.id, i]));
  ereporting(ctx);
  renumber(ctx);
  numberReferences(ctx.rows.einvoicing_registrations, 'EIR', 'created_at');
  numberReferences(ctx.rows.invoices, 'FAC', 'submitted_at');
  numberReferences(ctx.rows.ereporting_submissions, 'ERP', 'created_at');
}

module.exports = { einvoicing };

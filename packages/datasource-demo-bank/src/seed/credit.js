/**
 * Wave D, part 1: credit. The bank started lending this year, so every loan was paid out within
 * the six months of statements: each payout and each monthly repayment is a line on the account.
 *
 * - Loan applications for personal loans, car loans, pay-in-3/4 (BNPL) and business term loans:
 *   affordability (declared income and charges, debt-to-income), the external score, the
 *   Banque de France FICP check before any consumer credit, the offer (amount, rate, APR, term).
 *   Some wait in the credit team's inbox, some for the customer's payslips; others were approved,
 *   declined (listed in the FICP, too much debt, score too low) or never signed.
 * - Loans with their repayment schedule. Most are paid on time; when the money is not on the
 *   account, the instalment is missed: a few loans are late, one has defaulted, one caught up,
 *   one was restructured, one was repaid early; pay-in-3 loans are mostly repaid already.
 * - Collection cases for the missed instalments, at the stage their days past due call for.
 * - Guarantees: a director guaranteeing their company's loan, Bpifrance on business loans, a
 *   cash deposit, a parent for a young borrower; one called after a default.
 * - Requests to raise an overdraft, a card limit or a transfer limit.
 */
const { toDate } = require('./banking');
const { NOW, at, informationRequest, numberReferences, op, past, trail } = require('./crime');
const { ledger, post, spendable } = require('./ledger');
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
  withTime,
} = require('./random');
const { MONTHLY_NET } = require('./reference');

const WAVE_D_CREDIT = [
  'loan_applications',
  'loans',
  'repayments',
  'guarantees',
  'collection_cases',
  'limit_requests',
];

const ago = date => (NOW - date) / DAY;

const addMonths = (date, n) => {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + n);

  return d;
};

// ---- products ---------------------------------------------------------------------------------

// [amount range, term range (months), yearly rate range, channels]
const PRODUCTS = {
  PERSONAL_LOAN: [
    [3000, 25000],
    [12, 60],
    [4.5, 8.4],
    ['APP', 'APP', 'WEB'],
  ],
  CAR_LOAN: [
    [8000, 32000],
    [24, 72],
    [3.9, 6.9],
    ['BROKER', 'BROKER', 'APP'],
  ],
  BNPL: [[150, 1200], [3, 4], [0, 0], ['APP']],
  BUSINESS_TERM_LOAN: [
    [20000, 150000],
    [24, 60],
    [4.2, 6.5],
    ['BRANCH', 'APP'],
  ],
};
const PURPOSES = {
  PERSONAL_LOAN: ['Travaux de rénovation', 'Mariage', 'Achat de mobilier', 'Études', 'Voyage'],
  CAR_LOAN: ['Achat d’une voiture d’occasion', 'Achat d’une voiture électrique neuve'],
  BUSINESS_TERM_LOAN: ['Achat de matériel', 'Agrandissement du local', 'Besoin de trésorerie'],
};
const CONSUMER = ['PERSONAL_LOAN', 'CAR_LOAN', 'BNPL'];
const MAX_DTI = 35;

/** The monthly payment that repays `principal` over `months` at `rate` % a year. */
function instalment(principal, rate, months) {
  const r = rate / 1200;
  if (!r) return round2(principal / months);

  return round2((principal * r) / (1 - (1 + r) ** -months));
}

// ---- who borrows --------------------------------------------------------------------------------

/** Active customers with an account open over the whole history, not caught in another story. */
function borrowers(ctx) {
  const busy = new Set(
    [...ctx.rows.alerts, ...ctx.rows.dispute_requests, ...ctx.rows.complaints].map(
      r => r.customer_id,
    ),
  );
  const oldEnough = a => a.status === 'ACTIVE' && ago(toDate(a.opened_at)) > 200;
  const main = c =>
    (ctx.accountsOf.get(c.id) || []).find(a => a.type !== 'SAVINGS' && oldEnough(a));
  const fits = c => c.status === 'ACTIVE' && !busy.has(c.id) && main(c);

  // People in work or retired, under 70: no loan to a job seeker or a student.
  const lendable = c => {
    const p = ctx.holderOf(c);
    const age = (NOW - toDate(`${p.date_of_birth}T00:00:00Z`)) / (365.25 * DAY);

    return ['EMPLOYED', 'SELF_EMPLOYED', 'RETIRED'].includes(p.employment_status) && age < 70;
  };

  return {
    retail: ctx.rows.customers.filter(
      c => c.customer_type === 'RETAIL' && fits(c) && ctx.holderOf(c) && lendable(c),
    ),
    business: ctx.rows.customers.filter(c => c.customer_type === 'BUSINESS' && fits(c)),
    main,
  };
}

function incomeOf(ctx, customer) {
  if (customer.customer_type === 'BUSINESS') return Number(customer.expected_monthly_in);

  return (ctx.membersOf.get(customer.id) || [])
    .map(m => ctx.people.get(m.individual_id))
    .filter(p => p && p.income_band)
    .reduce((sum, p) => sum + MONTHLY_NET[p.income_band], 0);
}

// ---- applications -------------------------------------------------------------------------------

// [product, how it ends, how many days ago it was submitted, how many]. LOAN:<fate> became a loan.
const PLAN = [
  ['PERSONAL_LOAN', 'LOAN:ON_TIME', [20, 165], 6],
  ['PERSONAL_LOAN', 'LOAN:LATE', [100, 160], 2],
  ['PERSONAL_LOAN', 'LOAN:DEFAULT', [165, 175], 1],
  ['PERSONAL_LOAN', 'LOAN:RECOVERED', [110, 160], 1],
  ['PERSONAL_LOAN', 'LOAN:RESTRUCTURED', [150, 170], 1],
  ['PERSONAL_LOAN', 'LOAN:EARLY_REPAID', [120, 165], 1],
  ['PERSONAL_LOAN', 'SUBMITTED', [0, 1], 1],
  ['PERSONAL_LOAN', 'IN_REVIEW', [1, 3], 1],
  ['PERSONAL_LOAN', 'WAITING_DOCUMENTS', [2, 8], 2],
  ['PERSONAL_LOAN', 'OFFER_MADE:GUARANTOR', [3, 9], 1],
  ['PERSONAL_LOAN', 'DECLINED:FICP', [10, 150], 1],
  ['PERSONAL_LOAN', 'DECLINED:DTI', [10, 150], 2],
  ['PERSONAL_LOAN', 'WITHDRAWN', [40, 150], 1],
  ['CAR_LOAN', 'LOAN:ON_TIME', [30, 165], 4],
  ['CAR_LOAN', 'LOAN:LATE', [90, 150], 1],
  ['CAR_LOAN', 'IN_REVIEW', [1, 4], 1],
  ['CAR_LOAN', 'OFFER_MADE', [3, 9], 1],
  ['CAR_LOAN', 'DECLINED:DTI', [20, 150], 1],
  ['BNPL', 'LOAN:REPAID', [100, 170], 6],
  ['BNPL', 'LOAN:ON_TIME', [10, 70], 5],
  ['BNPL', 'LOAN:LATE', [50, 80], 1],
  ['BNPL', 'DECLINED:SCORE', [5, 120], 2],
  ['BUSINESS_TERM_LOAN', 'LOAN:ON_TIME', [40, 165], 4],
  ['BUSINESS_TERM_LOAN', 'LOAN:DEFAULT', [165, 175], 1],
  ['BUSINESS_TERM_LOAN', 'IN_REVIEW', [1, 5], 1],
  ['BUSINESS_TERM_LOAN', 'WAITING_DOCUMENTS', [3, 9], 1],
  ['BUSINESS_TERM_LOAN', 'OFFER_MADE:GUARANTOR', [3, 9], 1],
  ['BUSINESS_TERM_LOAN', 'DECLINED:CASHFLOW', [20, 150], 1],
];

const DECLINES = {
  FICP: 'Listed in the Banque de France FICP file (repayment incidents): consumer credit refused.',
  DTI: 'Debt-to-income above our 35% limit once this loan is added.',
  SCORE: 'Automatic refusal: the score from the account analysis is too low for a split payment.',
  CASHFLOW:
    'Cash flow too thin for this loan: over the last six months the account was often close to zero.',
};

/** What the applicant asks for and can afford; a refusal for too much debt shows it. */
function affordability(ctx, customer, product, end) {
  const [[min, max], [t1, t2], [r1, r2]] = PRODUCTS[product];
  const income = incomeOf(ctx, customer) || 1500;
  const term = product === 'BNPL' ? pick([3, 4]) : between(t1 / 6, t2 / 6) * 6;
  const rate = round2(r1 + (r2 - r1) * (between(0, 100) / 100));
  // Ask for what fits the income: a payment of 4-12% of it, much more when the request is refused.
  const share = end === 'DECLINED:DTI' ? between(30, 45) / 100 : between(4, 12) / 100;
  let amount = Math.round((income * share * term) / (1 + (rate * term) / 2400) / 100) * 100;
  amount = Math.min(max, Math.max(min, amount));
  if (product === 'BNPL') amount = between(min, max);

  if (product === 'BUSINESS_TERM_LOAN') {
    amount = between(min / 1000, max / 1000) * 1000;
    // Unless refused for affordability, a company borrows what 30% of its income can repay.
    const affordable = Math.floor((income * 0.3 * term) / (1 + (rate * term) / 2400) / 1000) * 1000;
    if (end !== 'DECLINED:DTI') amount = Math.max(1000, Math.min(amount, affordable));
  }

  const payment = instalment(amount, rate, term);
  // What the applicant already pays each month (rent, other credits; a company's existing loans),
  // within our 35% limit once this loan is added, unless the request is refused for that.
  const usual = product === 'BUSINESS_TERM_LOAN' ? between(3, 10) : between(15, 28);
  let charges = round2((income * usual) / 100);

  if (end !== 'DECLINED:DTI') {
    charges = round2(Math.max(0, Math.min(charges, income * 0.33 - payment)));
  }

  return {
    amount,
    term,
    rate,
    income: round2(income),
    charges,
    dti: round2(((charges + payment) / income) * 100),
  };
}

function applicationRow(ctx, customer, product, end, submitted) {
  const money = affordability(ctx, customer, product, end);
  const consumer = CONSUMER.includes(product);
  const row = {
    id: uuid(),
    reference: null,
    customer_id: customer.id,
    product,
    amount: money.amount,
    term_months: money.term,
    purpose: PURPOSES[product] ? pick(PURPOSES[product]) : null,
    declared_income: money.income,
    declared_expenses: money.charges,
    debt_to_income: money.dti,
    external_score: end === 'DECLINED:SCORE' ? between(180, 340) : between(520, 910),
    credit_register_checked_at: null,
    credit_register_result: 'NOT_CHECKED',
    offered_amount: null,
    offered_rate: null,
    offered_term_months: null,
    offered_apr: null,
    status: 'SUBMITTED',
    decision_reason: null,
    decided_by: null,
    decided_at: null,
    submitted_at: iso(submitted),
    channel: pick(PRODUCTS[product][3]),
  };

  // Consumer credit: the FICP file is checked before anything is decided (business: no FICP).
  if (consumer && end !== 'SUBMITTED') {
    Object.assign(row, {
      // Pay-in-3 is decided in seconds: the check comes first.
      credit_register_checked_at: iso(past(at(submitted, product === 'BNPL' ? 0.004 : 0.05))),
      credit_register_result: end === 'DECLINED:FICP' ? 'LISTED' : 'NOT_LISTED',
    });
  }

  ctx.rows.loan_applications.push(row);

  return { row, money };
}

/** The offer: what we lend (sometimes less than asked), at which rate and APR. */
function offer(app, money) {
  const less = app.product !== 'BNPL' && chance(0.25);
  Object.assign(app, {
    offered_amount: less ? Math.round((money.amount * 0.8) / 100) * 100 : money.amount,
    offered_rate: money.rate,
    offered_term_months: money.term,
    // The APR adds the file fees to the rate; a free pay-in-3 stays at 0.
    offered_apr: money.rate ? round2(money.rate + between(15, 45) / 100) : 0,
  });
}

function decide(app, status, when, reason) {
  const automatic = app.product === 'BNPL';
  Object.assign(app, {
    status,
    decided_at: iso(when),
    decided_by: automatic ? 'system' : op('credit'),
    decision_reason: reason,
  });
}

const APPROVED_WHY = money =>
  `Affordable: debt-to-income ${money.dti}% with this loan, under our ${MAX_DTI}% limit.`;

function applicationHistory(ctx, app, dates) {
  const steps = [['SUBMITTED', toDate(app.submitted_at), 'customer']];
  if (dates.review) steps.push(['IN_REVIEW', dates.review, app.decided_by || op('credit')]);

  if (dates.documents) {
    steps.push([
      'WAITING_DOCUMENTS',
      dates.documents,
      op('credit'),
      app.product === 'BUSINESS_TERM_LOAN' ? 'Latest accounts asked' : 'Proof of income asked',
    ]);
  }

  if (dates.offer) steps.push(['OFFER_MADE', dates.offer, app.decided_by || op('credit')]);

  if (app.decided_at && app.status !== 'OFFER_MADE') {
    steps.push([app.status, toDate(app.decided_at), app.decided_by, app.decision_reason]);
  }

  trail(ctx.rows, 'LOAN_APPLICATIONS', app, steps);
}

// ---- loans and repayments -----------------------------------------------------------------------

/** Which instalments are missed for each fate (1 = the first one). */
function missedFor(fate, dues) {
  const due = dues.filter(d => d < NOW).length;
  if (fate === 'LATE') return new Set(chance(0.4) && due > 2 ? [due - 1, due] : [due]);

  if (fate === 'DEFAULT') {
    return new Set(Array.from({ length: due }, (_, i) => i + 1).filter(k => k >= 2));
  }

  if (fate === 'RECOVERED') return new Set([2]);
  if (fate === 'RESTRUCTURED') return new Set([2, 3]);

  return new Set();
}

function repaymentRows(loan, start) {
  const rows = [];
  let left = Number(loan.principal);

  for (let k = 1; k <= loan.term_months; k += 1) {
    const interest = round2((left * loan.rate) / 1200);
    const principal =
      k === loan.term_months ? round2(left) : round2(loan.instalment_amount - interest);
    left = round2(left - principal);
    rows.push({
      id: uuid(),
      loan_id: loan.id,
      transaction_id: null,
      instalment_number: k,
      due_at: iso(withTime(addMonths(start, k))),
      amount_due: round2(principal + interest),
      principal_part: principal,
      interest_part: interest,
      amount_paid: null,
      paid_at: null,
      status: 'SCHEDULED',
    });
  }

  return rows;
}

/** Take an instalment from the account, if the money is there. */
function collect(ctx, loan, account, rep, when, label) {
  if (spendable(ctx, account, when) < Number(rep.amount_due)) return false;
  const tx = post(ctx, account, when, 'DEBIT', rep.amount_due, label, 'LOANS');
  Object.assign(rep, {
    transaction_id: tx.id,
    amount_paid: rep.amount_due,
    paid_at: iso(when),
    status: 'PAID',
  });

  return true;
}

/** Each instalment due so far: paid, missed, or paid late (a missed one caught up). */
function runSchedule(ctx, loan, account, rows, fate) {
  const dues = rows.map(r => toDate(r.due_at));
  const missed = missedFor(fate, dues);
  rows
    .filter(r => toDate(r.due_at) < NOW)
    .forEach(rep => {
      const due = toDate(rep.due_at);
      const label = `ECHEANCE PRET ${loan.contract_number} ${rep.instalment_number}/${loan.term_months}`;

      if (!missed.has(rep.instalment_number) && collect(ctx, loan, account, rep, due, label)) {
        return;
      }

      rep.status = 'MISSED';

      if (fate === 'RECOVERED') {
        const caught = past(new Date(due.getTime() + between(15, 25) * DAY));
        ctx.lateIds.add(rep.id);

        if (collect(ctx, loan, account, rep, caught, `REGULARISATION ${label}`)) {
          loan.recoveredAt = caught;
        }
      }
    });
}

/** The borrower pays everything left a few months in: one last line closes the schedule. */
function repayEarly(ctx, loan, account, rows) {
  const paid = rows.filter(r => r.status === 'PAID');
  if (paid.length < 2) return;
  const when = past(
    new Date(toDate(paid[paid.length - 1].due_at).getTime() + between(5, 20) * DAY),
  );
  const left = round2(
    rows.filter(r => r.status === 'SCHEDULED').reduce((s, r) => s + r.principal_part, 0),
  );
  if (spendable(ctx, account, when) < left) return;
  const kept = rows.filter(r => r.status !== 'SCHEDULED');
  const last = {
    ...rows.find(r => r.status === 'SCHEDULED'),
    id: uuid(),
    instalment_number: kept.length + 1,
    due_at: iso(when),
    amount_due: left,
    principal_part: left,
    interest_part: 0,
  };
  collect(ctx, loan, account, last, when, `REMBOURSEMENT ANTICIPE PRET ${loan.contract_number}`);
  rows.splice(0, rows.length, ...kept, last);
  loan.repaidEarly = when;
}

/** Two instalments missed: the arrears go back into the loan, repaid over 12 more months. */
function restructure(loan, rows) {
  const missedRows = rows.filter(r => r.status === 'MISSED');
  if (!missedRows.length) return;
  const at3 = toDate(missedRows[missedRows.length - 1].due_at);
  const kept = rows.filter(r => toDate(r.due_at) <= at3);
  const left = round2(
    rows.filter(r => r.status !== 'PAID').reduce((s, r) => s + r.principal_part, 0),
  );
  const months = loan.term_months - kept.length + 12;
  const payment = instalment(left, loan.rate, months);
  const tail = repaymentRows(
    { ...loan, principal: left, term_months: months, instalment_amount: payment },
    at3,
  ).map(r => ({ ...r, instalment_number: r.instalment_number + kept.length }));
  rows.splice(0, rows.length, ...kept, ...tail);
  Object.assign(loan, {
    restructuredAt: past(new Date(at3.getTime() + between(8, 15) * DAY)),
    term_months: rows.length,
    instalment_amount: payment,
  });
}

/** Days past due, next due date, what is left to repay, and the loan's status, from its schedule. */
function settle(loan, rows) {
  // After a restructuring, the arrears are part of the new schedule.
  const since = loan.restructuredAt ? iso(loan.restructuredAt) : '';
  const open = rows.filter(r => ['MISSED', 'PARTIAL'].includes(r.status) && r.due_at > since);
  const oldest = open.length ? toDate(open[0].due_at) : null;
  const next = rows.find(r => r.status === 'SCHEDULED');
  const repaid = rows.every(r => r.status === 'PAID');
  const paidPrincipal = rows
    .filter(r => r.status === 'PAID')
    .reduce((s, r) => s + r.principal_part, 0);
  const dpd = oldest ? Math.floor(ago(oldest)) : 0;
  let status = 'CURRENT';
  if (repaid) status = 'REPAID';
  else if (loan.restructuredAt) status = 'RESTRUCTURED';
  else if (dpd >= 90) status = 'DEFAULT';
  else if (dpd > 0) status = 'LATE';
  Object.assign(loan, {
    days_past_due: dpd,
    next_due_at: next ? next.due_at : null,
    outstanding_balance: repaid ? 0 : round2(Number(loan.principal) - paidPrincipal),
    status,
    maturity_date: isoDate(toDate(rows[rows.length - 1].due_at)),
  });
}

function loanRow(ctx, app, customer, account, signed) {
  const consumer = CONSUMER.includes(app.product);
  // Consumer credit: no payout before 7 days after signing; 14 days to withdraw. A pay-in-3
  // splits a purchase already made: settled at signing.
  let hours = consumer ? between(7, 9) * 24 + 2 : between(24, 72);
  if (app.product === 'BNPL') hours = 0.1;
  const disbursed = past(at(signed, hours));
  const principal = Number(app.offered_amount);
  const loan = {
    id: uuid(),
    customer_id: customer.id,
    application_id: app.id,
    account_id: account.id,
    disbursement_transaction_id: null,
    contract_number: null,
    principal,
    rate: Number(app.offered_rate),
    apr: Number(app.offered_apr),
    term_months: Number(app.offered_term_months),
    instalment_amount: instalment(
      principal,
      Number(app.offered_rate),
      Number(app.offered_term_months),
    ),
    signed_at: iso(signed),
    withdrawal_deadline: consumer ? isoDate(new Date(signed.getTime() + 14 * DAY)) : null,
    disbursed_at: iso(disbursed),
  };
  ctx.rows.loans.push(loan);

  return loan;
}

/** The payout on the account: the loan amount, or the purchase a pay-in-3 splits. */
function payOut(ctx, loan, account, app) {
  const label =
    app.product === 'BNPL'
      ? `PAIEMENT EN ${loan.term_months}X ${(app.purpose || 'ACHAT CB').toUpperCase()}`
      : `DEBLOCAGE PRET ${loan.contract_number}`;
  const tx = post(
    ctx,
    account,
    toDate(loan.disbursed_at),
    'CREDIT',
    loan.principal,
    label,
    'LOANS',
  );
  loan.disbursement_transaction_id = tx.id;
}

function makeLoan(ctx, app, customer, account, fate) {
  const signed = past(at(toDate(app.decided_at), app.product === 'BNPL' ? 0.02 : between(24, 96)));
  const loan = loanRow(ctx, app, customer, account, signed);
  loan.contract_number = `LON-${signed.getUTCFullYear()}-${String(between(100000, 999999))}`;
  payOut(ctx, loan, account, app);
  const rows = repaymentRows(loan, toDate(loan.disbursed_at));
  runSchedule(ctx, loan, account, rows, fate);
  if (fate === 'EARLY_REPAID') repayEarly(ctx, loan, account, rows);
  if (fate === 'RESTRUCTURED') restructure(loan, rows);

  // After a restructuring, the new instalments due so far were paid.
  if (loan.restructuredAt) {
    rows
      .filter(r => r.status === 'SCHEDULED' && toDate(r.due_at) < NOW)
      .forEach(rep => {
        const label = `ECHEANCE PRET ${loan.contract_number} ${rep.instalment_number}/${loan.term_months}`;
        if (!collect(ctx, loan, account, rep, toDate(rep.due_at), label)) rep.status = 'MISSED';
      });
  }

  settle(loan, rows);
  ctx.rows.repayments.push(...rows);

  return loan;
}

// ---- guarantees ---------------------------------------------------------------------------------

function guaranteeRow(ctx, fields) {
  const row = {
    id: uuid(),
    loan_application_id: null,
    loan_id: null,
    guarantor_individual_id: null,
    guarantor_business_id: null,
    value: null,
    valued_at: null,
    status: 'ACTIVE',
    signed_at: null,
    expires_at: null,
    called_at: null,
    ...fields,
  };
  ctx.rows.guarantees.push(row);

  return row;
}

/** An older relative with the same family name, outside the borrower's own customer. */
function parentOf(ctx, customer) {
  const holder = ctx.holderOf(customer);
  const born = toDate(`${holder.date_of_birth}T00:00:00Z`);

  return ctx.rows.individuals.find(
    p =>
      p.last_name === holder.last_name &&
      p.id !== holder.id &&
      toDate(`${p.date_of_birth}T00:00:00Z`) < new Date(born.getTime() - 20 * 365 * DAY),
  );
}

function directorOf(ctx, customer) {
  const member = ctx.rows.business_members.find(
    m => m.business_id === customer.business_id && m.individual_id && m.role === 'DIRECTOR',
  );

  return member && ctx.people.get(member.individual_id);
}

/** What stands behind a business loan: the director, Bpifrance, sometimes a cash deposit. */
function businessGuarantees(ctx, customer, link, amount, signed, expires) {
  const director = directorOf(ctx, customer);
  const base = { ...link, signed_at: signed && iso(signed), expires_at: expires && iso(expires) };

  if (director) {
    guaranteeRow(ctx, {
      ...base,
      guarantor_individual_id: director.id,
      type: 'PERSONAL_GUARANTEE',
      amount_guaranteed: round2(amount * 0.5),
    });
  }

  guaranteeRow(ctx, {
    ...base,
    type: 'STATE_GUARANTEE',
    amount_guaranteed: round2(amount * pick([0.4, 0.5, 0.6])),
  });

  // Sometimes a cash deposit too, always on the first signed loan so one shows.
  if ((chance(0.4) || !ctx.depositShown) && signed) {
    ctx.depositShown = true;
    guaranteeRow(ctx, {
      ...base,
      guarantor_business_id: customer.business_id,
      type: 'CASH_DEPOSIT',
      amount_guaranteed: round2(amount * 0.1),
      value: round2(amount * 0.1),
      valued_at: iso(signed),
    });
  }
}

/** Guarantees follow their loan: released once repaid, called after a default. */
function guaranteeFates(ctx) {
  const loans = new Map(ctx.rows.loans.map(l => [l.id, l]));
  ctx.rows.guarantees
    .filter(g => g.loan_id)
    .forEach(g => {
      const loan = loans.get(g.loan_id);
      if (loan.status === 'REPAID') g.status = 'RELEASED';

      if (loan.status === 'DEFAULT' && g.type !== 'CASH_DEPOSIT') {
        Object.assign(g, {
          status: 'CALLED',
          called_at: iso(past(withTime(daysAgo(between(2, 10))))),
        });
      }
    });
}

// ---- collections ----------------------------------------------------------------------------------

function stageOf(dpd) {
  if (dpd >= 90) return 'LEGAL';

  return dpd >= 30 ? 'LATE' : 'EARLY';
}

/** A case for each loan with an instalment missed for more than 10 days. */
function collectionCase(ctx, loan, missed, first) {
  const opened = past(new Date(toDate(first.due_at).getTime() + 10 * DAY));
  const closedAt = loan.recoveredAt || loan.restructuredAt || null;
  const dpd = closedAt ? 0 : loan.days_past_due;
  const reachedDpd = Math.floor(((closedAt || NOW) - toDate(first.due_at)) / DAY);
  const row = {
    id: uuid(),
    reference: null,
    customer_id: loan.customer_id,
    loan_id: loan.id,
    account_id: null,
    insolvency_proceeding_id: null,
    days_past_due: dpd,
    amount_due: closedAt ? 0 : round2(missed.reduce((s, r) => s + r.amount_due, 0)),
    stage: stageOf(reachedDpd),
    assigned_to: op('collections'),
    next_action_at: closedAt ? null : iso(withTime(new Date(NOW.getTime() + between(1, 5) * DAY))),
    promise_to_pay_date: null,
    promise_to_pay_amount: null,
    outcome: null,
    status: closedAt ? 'CLOSED' : 'IN_PROGRESS',
    opened_at: iso(opened),
    last_contact_at: iso(past(at(opened, between(24, 120)))),
    formal_notice_sent_at: null,
    closed_at: closedAt ? iso(closedAt) : null,
  };
  if (loan.recoveredAt) row.outcome = 'PAID';
  if (loan.restructuredAt) row.outcome = 'RESTRUCTURED';

  // Late enough for a formal notice (mise en demeure) before legal action.
  if (reachedDpd >= 45) {
    row.formal_notice_sent_at = iso(past(new Date(toDate(first.due_at).getTime() + 40 * DAY)));
  }

  ctx.rows.collection_cases.push(row);

  return row;
}

function collectionHistory(ctx, row, first) {
  const steps = [
    ['OPEN', toDate(row.opened_at), 'system', `Instalment ${first.instalment_number} missed`],
    ['IN_PROGRESS', toDate(row.last_contact_at), row.assigned_to, 'Customer called'],
  ];

  if (row.closed_at) {
    const why = row.outcome === 'PAID' ? 'Arrears paid' : 'Loan restructured over 12 more months';
    steps.push(['CLOSED', toDate(row.closed_at), row.assigned_to, why]);
  }

  trail(ctx.rows, 'COLLECTION_CASES', row, steps);
}

function collectionCases(ctx) {
  ctx.rows.loans.forEach(loan => {
    const rows = ctx.rows.repayments.filter(r => r.loan_id === loan.id);
    const first = rows.find(r => r.status === 'MISSED' || ctx.lateIds.has(r.id));
    if (!first || toDate(first.due_at).getTime() + 10 * DAY >= NOW.getTime()) return;
    const row = collectionCase(
      ctx,
      loan,
      rows.filter(r => r.status === 'MISSED'),
      first,
    );
    collectionHistory(ctx, row, first);
  });
  // One customer promised to pay at the end of the month.
  const promised = ctx.rows.collection_cases.find(
    c => c.status === 'IN_PROGRESS' && c.stage !== 'LEGAL',
  );

  if (promised) {
    Object.assign(promised, {
      promise_to_pay_date: isoDate(new Date(NOW.getTime() + between(3, 12) * DAY)),
      promise_to_pay_amount: promised.amount_due,
    });
  }
}

// ---- limit requests -----------------------------------------------------------------------------

// Card limits by plan: [payments a month, withdrawals a week].
const CARD_LIMITS = {
  STANDARD: [1500, 500],
  PREMIUM: [3000, 1000],
  METAL: [6000, 2000],
  BUSINESS_PRO: [8000, 2000],
};
const LIMIT_REASONS = {
  OVERDRAFT: ['Salary paid later this month', 'Unexpected car repair', 'Moving costs'],
  CARD_PAYMENT: ['Trip abroad, hotel and car rental', 'Buying a new laptop', 'Wedding expenses'],
  CARD_WITHDRAWAL: ['Trip to Morocco, cash needed', 'Paying a craftsman in cash'],
  TRANSFER: ['Buying a second-hand car from a private seller', 'Deposit for a flat'],
};
// [type, status, days ago, how many]
const LIMIT_PLAN = [
  ['OVERDRAFT', 'PENDING', [0, 2], 2],
  ['OVERDRAFT', 'APPROVED', [5, 150], 4],
  ['OVERDRAFT', 'DECLINED', [5, 150], 2],
  ['CARD_PAYMENT', 'PENDING', [0, 1], 1],
  ['CARD_PAYMENT', 'APPROVED', [5, 150], 4],
  ['CARD_WITHDRAWAL', 'APPROVED', [5, 150], 2],
  ['TRANSFER', 'PENDING', [0, 2], 1],
  ['TRANSFER', 'APPROVED', [5, 150], 2],
  ['TRANSFER', 'DECLINED', [5, 150], 1],
];

/** Today's limit and the raise asked for. */
function limitsOf(account, type) {
  const [payments, withdrawals] = CARD_LIMITS[account.plan] || CARD_LIMITS.STANDARD;
  const current = {
    OVERDRAFT: Number(account.overdraft_limit || 0),
    CARD_PAYMENT: payments,
    CARD_WITHDRAWAL: withdrawals,
    TRANSFER: 10000,
  }[type];
  const raise = {
    OVERDRAFT: between(2, 10) * 100,
    CARD_PAYMENT: between(10, 40) * 100,
    CARD_WITHDRAWAL: between(5, 15) * 100,
    TRANSFER: between(10, 40) * 1000,
  }[type];

  return [current, raise];
}

// Big raises need a second pair of eyes (L2).
const deciderOf = (type, current, raise) =>
  current + raise > 15000 || (type === 'OVERDRAFT' && raise > 600) ? op('l2') : op('support');

function limitRequest(ctx, customer, account, [type, status, [from, to]]) {
  const requested = past(withTime(daysAgo(between(from, to))));
  const onCard = type.startsWith('CARD');
  const card = ctx.rows.cards.find(c => c.account_id === account.id && c.status === 'ACTIVE');
  if (onCard && !card) return;
  const [current, raise] = limitsOf(account, type);
  const holder = ctx.holderOf(customer) || directorOf(ctx, customer);
  const decided = status === 'PENDING' ? null : past(at(requested, between(1, 30)));
  const by = deciderOf(type, current, raise);
  const row = {
    id: uuid(),
    reference: null,
    customer_id: customer.id,
    requested_by_id: holder?.id || null,
    card_id: onCard ? card.id : null,
    account_id: onCard ? null : account.id,
    type,
    current_limit: current,
    requested_limit: current + raise,
    // A card or transfer limit is raised for a while; an overdraft for good.
    temporary_until:
      type === 'OVERDRAFT' ? null : isoDate(new Date(requested.getTime() + between(7, 30) * DAY)),
    reason: pick(LIMIT_REASONS[type]),
    status,
    decided_by: decided && by,
    requested_at: iso(requested),
    decided_at: decided && iso(decided),
    channel: pick(['APP', 'APP', 'APP', 'PHONE']),
  };
  ctx.rows.limit_requests.push(row);
  // An approved overdraft raise is the account's limit from then on.
  if (type === 'OVERDRAFT' && status === 'APPROVED') account.overdraft_limit = row.requested_limit;
  const steps = [['PENDING', requested, 'customer', row.reason]];
  const why = status === 'DECLINED' ? 'Income too irregular for this limit' : null;
  if (decided) steps.push([status, decided, by, why]);
  trail(ctx.rows, 'LIMIT_REQUESTS', row, steps);
}

function limitRequests(ctx, pool, main) {
  const candidates = pool.slice();
  LIMIT_PLAN.forEach(([type, status, days, count]) => {
    for (let k = 0; k < count && candidates.length; k += 1) {
      const customer = candidates.splice(between(0, candidates.length - 1), 1)[0];
      limitRequest(ctx, customer, main(customer), [type, status, days]);
    }
  });
}

// ---- putting it together --------------------------------------------------------------------------

/** A recent card purchase the customer splits in 3 or 4: it sets the amount and what it pays for. */
function splitPurchase(ctx, app, account, money) {
  const since = iso(new Date(toDate(app.submitted_at).getTime() - 5 * DAY));
  const tx = ctx.rows.transactions.find(
    t =>
      t.account_id === account.id &&
      t.rail === 'CARD' &&
      ctx.purchases.has(t.id) &&
      t.direction === 'DEBIT' &&
      t.status === 'BOOKED' &&
      Number(t.amount) >= 100 &&
      t.created_at >= since &&
      t.created_at <= app.submitted_at,
  );
  const merchant = tx && ctx.parties.get(tx.counterparty_id)?.name;
  if (!merchant) return false;
  Object.assign(app, { amount: Number(tx.amount), purpose: merchant });
  Object.assign(money, { amount: Number(tx.amount) });

  return true;
}

/** An offer waiting for its guarantor: a parent, or the company's director, still to sign. */
function pendingGuarantee(ctx, customer, app) {
  if (app.product === 'BUSINESS_TERM_LOAN') {
    businessGuarantees(
      ctx,
      customer,
      { loan_application_id: app.id },
      app.offered_amount,
      null,
      null,
    );
    ctx.rows.guarantees
      .filter(g => g.loan_application_id === app.id)
      .forEach(g => {
        g.status = 'PENDING_SIGNATURE';
      });

    return;
  }

  const parent = parentOf(ctx, customer);
  if (!parent) return;
  const g = guaranteeRow(ctx, {
    loan_application_id: app.id,
    guarantor_individual_id: parent.id,
    type: 'PERSONAL_GUARANTEE',
    amount_guaranteed: app.offered_amount,
    status: 'PENDING_SIGNATURE',
  });
  informationRequest(
    ctx,
    { ...app, id: g.id, assigned_to: op('credit') },
    parent,
    past(at(toDate(app.submitted_at), 30)),
    'SENT',
    'GUARANTOR_DOCUMENTS',
    'GUARANTEE',
  );
}

/** Before deciding, the credit team asks for payslips (a person) or the accounts (a company). */
function askIncome(ctx, customer, app, when) {
  const person = ctx.holderOf(customer) || directorOf(ctx, customer);
  if (!person) return;
  const owner = { ...app, assigned_to: op('credit') };
  const topic = app.product === 'BUSINESS_TERM_LOAN' ? 'BUSINESS_FINANCIALS' : 'PROOF_OF_INCOME';
  informationRequest(ctx, owner, person, when, 'SENT', topic, 'LOAN_APPLICATION');
}

/** How far the application went: reviewed, offer made, then approved, declined or not signed. */
function decideApplication(ctx, app, money, end, dates) {
  if (['SUBMITTED', 'IN_REVIEW', 'WAITING_DOCUMENTS'].includes(end)) return;
  const instant = app.product === 'BNPL';
  const decision = instant
    ? at(toDate(app.submitted_at), 0.01)
    : past(at(dates.review, between(4, 48)));
  if (end.startsWith('DECLINED')) decide(app, 'DECLINED', decision, DECLINES[end.split(':')[1]]);
  if (!(end.startsWith('OFFER_MADE') || end === 'WITHDRAWN' || end.startsWith('LOAN'))) return;
  offer(app, money);
  Object.assign(app, { status: 'OFFER_MADE', decided_by: instant ? 'system' : op('credit') });
  dates.offer = decision;

  if (end === 'WITHDRAWN') {
    const lapsed = past(new Date(decision.getTime() + 30 * DAY));
    decide(app, 'WITHDRAWN', lapsed, 'Offer not signed within 30 days.');
  }

  if (end.startsWith('LOAN')) {
    decide(app, 'APPROVED', past(at(decision, between(2, 72))), APPROVED_WHY(money));
  }
}

function application(ctx, customer, account, [product, end, [from, to]]) {
  const submitted = past(withTime(daysAgo(between(from, to))));
  const { row: app, money } = applicationRow(ctx, customer, product, end, submitted);

  // A pay-in-3 splits a card purchase; with none to split, there is no application.
  if (product === 'BNPL' && !splitPurchase(ctx, app, account, money)) {
    ctx.rows.loan_applications.pop();

    return;
  }

  const dates = { review: past(at(submitted, between(2, 20))) };
  if (end === 'SUBMITTED' || product === 'BNPL') delete dates.review;
  if (end === 'IN_REVIEW') app.status = 'IN_REVIEW';

  if (end === 'WAITING_DOCUMENTS') {
    app.status = 'WAITING_DOCUMENTS';
    dates.documents = past(at(dates.review, 2));
    askIncome(ctx, customer, app, dates.documents);
  }

  decideApplication(ctx, app, money, end, dates);
  applicationHistory(ctx, app, dates);
  if (end === 'OFFER_MADE:GUARANTOR') pendingGuarantee(ctx, customer, app);
  if (!end.startsWith('LOAN')) return;
  const loan = makeLoan(ctx, app, customer, account, end.split(':')[1]);
  if (product !== 'BUSINESS_TERM_LOAN') return;
  const link = { loan_id: loan.id, loan_application_id: app.id };
  const expires = new Date(toDate(loan.maturity_date).getTime() + 365 * DAY);
  businessGuarantees(ctx, customer, link, loan.principal, toDate(loan.signed_at), expires);
}

function credit(ctx) {
  WAVE_D_CREDIT.forEach(t => {
    ctx.rows[t] = [];
  });
  ledger(ctx);
  ctx.lateIds = new Set();
  ctx.parties = new Map(ctx.rows.counterparties.map(c => [c.id, c]));
  ctx.purchases = new Set(
    ctx.rows.card_transactions.filter(c => c.type === 'PURCHASE').map(c => c.transaction_id),
  );
  const { retail, business, main } = borrowers(ctx);
  const pools = { retail: retail.slice(), business: business.slice() };
  PLAN.forEach(([product, end, days, count]) => {
    const pool = product === 'BUSINESS_TERM_LOAN' ? pools.business : pools.retail;
    // Missed instalments go to the customers with the least money on their account.
    const struggles = ['LATE', 'DEFAULT', 'RECOVERED', 'RESTRUCTURED'].some(f => end.endsWith(f));
    if (struggles) pool.sort((a, b) => Number(main(a).balance) - Number(main(b).balance));

    for (let k = 0; k < count && pool.length; k += 1) {
      const at0 = struggles ? 0 : between(0, pool.length - 1);
      const customer = pool.splice(at0, 1)[0];
      application(ctx, customer, main(customer), [product, end, days]);
    }
  });
  guaranteeFates(ctx);
  collectionCases(ctx);
  limitRequests(ctx, pools.retail, main);
  // What the generator noted on the loans along the way is not a column.
  ctx.rows.loans.forEach(loan => {
    delete loan.recoveredAt;
    delete loan.restructuredAt;
    delete loan.repaidEarly;
  });
  numberReferences(ctx.rows.loan_applications, 'APP', 'submitted_at');
  numberReferences(ctx.rows.collection_cases, 'COL', 'opened_at');
  numberReferences(ctx.rows.limit_requests, 'LIM', 'requested_at');
}

module.exports = { credit };

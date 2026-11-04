/**
 * The data model (schema.json): tables, typed fields, dropdown values, links. Everything
 * structural in this package comes from here; the generators in seed/ only decide what goes in the
 * rows.
 */
const schema = require('./schema.json');

const { tables } = schema;

// The name of a link seen from the parent, where the child's table name would hide what it means
// (the key is child.foreignKey). Every other one-to-many link is named after the child table.
const LINK_NAMES = {
  'business_members.business_id': 'structure',
  'business_members.owner_business_id': 'stakes_in_other_companies',
  'cards.replaces_card_id': 'replaced_by',
  'cards.holder_id': 'cards_held',
  'fees.transaction_id': 'fee',
  'fees.triggered_by_transaction_id': 'fees_caused',
  'fees.refund_transaction_id': 'refunded_fees',
  'chargebacks.transaction_id': 'chargebacks',
  'chargebacks.provisional_credit_transaction_id': 'provisional_credit_for_chargebacks',
  'complaints.transaction_id': 'complaints',
  'complaints.compensation_transaction_id': 'compensation_for_complaints',
  'sepa_disputes.transaction_id': 'sepa_disputes',
  'sepa_disputes.return_transaction_id': 'returns_for_sepa_disputes',
  'closures.payout_transaction_id': 'closing_payout_for',
  'closures.payout_beneficiary_id': 'closing_payouts_received',
  'loans.disbursement_transaction_id': 'loan_disbursed',
  'wallet_transfers.peer_account_id': 'wallet_transfers_as_peer',
  'investigations.origin_authority_request_id': 'investigations_opened',
  'investigations.origin_kyc_case_id': 'investigations_opened',
  'customer_change_requests.requested_from_device_id': 'change_requests_made',
  'sct_beneficiaries.added_from_device_id': 'beneficiaries_added',
  'customer_members.proof_document_id': 'proves_role_of',
  'guarantees.guarantor_individual_id': 'guarantees_given',
  'guarantees.guarantor_business_id': 'guarantees_given',
  'information_requests.addressed_to_id': 'information_requests_received',
  'limit_requests.requested_by_id': 'limit_requests_made',
  'transactions.initiated_by_id': 'payments_initiated',
  'ereporting_submissions.replaces_id': 'corrected_by',
};

// Join tables read from one side only: a dispute lists its movements and an invoice its payments,
// while a transaction already lists the join rows (with their role or amount).
const ONE_WAY = ['dispute_transactions', 'invoice_payments'];

// The name of a link seen from the child, where the foreign key's name reads badly.
const PARENT_LINK_NAMES = { 'fees.triggered_by_transaction_id': 'caused_by_payment' };

const singular = table =>
  table
    .replace(/ies$/, 'y')
    .replace(/(ss|sh|ch|x)es$/, '$1')
    .replace(/s$/, '');

/** Relation names, decided once so the agent and the layout agree. */
function relationNames() {
  const used = Object.fromEntries(
    Object.entries(tables).map(([table, { fields }]) => [table, new Set(fields.map(f => f.name))]),
  );

  const claim = (table, preferred, fallback) => {
    const name = used[table].has(preferred) ? fallback : preferred;
    used[table].add(name);

    return name;
  };

  const links = [];
  const fromSameChild = {};
  schema.relations.forEach(r => {
    const key = `${r.parent}<${r.child}`;
    fromSameChild[key] = (fromSameChild[key] || 0) + 1;
  });

  schema.relations.forEach(r => {
    const base = r.foreignKey.replace(/_id$/, '');
    links.push({
      kind: 'ManyToOne',
      table: r.child,
      name: claim(
        r.child,
        PARENT_LINK_NAMES[`${r.child}.${r.foreignKey}`] || base,
        `${base}_record`,
      ),
      target: r.parent,
      foreignKey: r.foreignKey,
    });
    const named = LINK_NAMES[`${r.child}.${r.foreignKey}`];
    const shared = fromSameChild[`${r.parent}<${r.child}`] > 1 || r.parent === r.child;
    let inverse = r.oneToOne ? singular(r.child) : r.child;
    if (named) inverse = named;
    else if (shared) inverse = `${r.child}_by_${base}`; // a clash: give it a name above
    links.push({
      kind: r.oneToOne ? 'OneToOne' : 'OneToMany',
      table: r.parent,
      name: claim(r.parent, inverse, `${r.child}_by_${base}`),
      target: r.child,
      originKey: r.foreignKey,
    });
  });

  schema.manyToMany.forEach(mm => {
    links.push({
      kind: 'ManyToMany',
      table: mm.from,
      name: claim(mm.from, mm.to, `${mm.to}_via_${mm.through}`),
      target: mm.to,
      through: mm.through,
      originKey: mm.originKey,
      foreignKey: mm.foreignKey,
    });
    if (ONE_WAY.includes(mm.through)) return;
    links.push({
      kind: 'ManyToMany',
      table: mm.to,
      name: claim(mm.to, mm.from, `${mm.from}_via_${mm.through}`),
      target: mm.from,
      through: mm.through,
      originKey: mm.foreignKey,
      foreignKey: mm.originKey,
    });
  });

  // Every case table (it has a reference) gets its status history.
  Object.entries(tables)
    .filter(([, t]) => t.fields.some(f => f.name === 'reference'))
    .forEach(([table]) =>
      links.push({
        kind: 'OneToMany',
        table,
        name: claim(table, 'history', 'status_history'),
        target: schema.history.table,
        originKey: schema.history.key,
      }),
    );

  return links;
}

module.exports = { LINK_NAMES, PARENT_LINK_NAMES, schema, tables, relationNames };

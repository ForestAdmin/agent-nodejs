/**
 * Readable names for records that have none of their own, so a link never shows a bare id.
 */
import * as render from './render';

// Payment details hold no name: the counterparty does. They show it, so a link reads "Fnac".
const NAMED_BY_COUNTERPARTY = [
  'card_merchants',
  'sct_emitters',
  'sct_beneficiaries',
  'sdd_creditors',
  'wero_contacts',
];
const title = code =>
  code
    ? (code.charAt(0) + code.slice(1).toLowerCase().replace(/_/g, ' ')).replace(/\batm\b/, 'ATM')
    : '';
const { euros } = render;
// Records without a name or a reference: a short label, so a link never shows a bare id.
// The details of a transaction (card payment, transfers, direct debit, fee) show their id: no
// label rebuilt on every list. Only records with no other name get one.
const LABELS: Record<string, [string[], (record) => string]> = {
  guarantees: [
    ['type', 'amount_guaranteed'],
    r => `${title(r.type)}, ${euros(r.amount_guaranteed)}`,
  ],
};

function addReadableNames(customizer) {
  NAMED_BY_COUNTERPARTY.forEach(table =>
    customizer.customizeCollection(table, collection =>
      collection.addField('name', {
        columnType: 'String',
        dependencies: ['counterparty:name'],
        getValues: records => records.map(r => r.counterparty?.name || null),
      }),
    ),
  );
  Object.entries(LABELS).forEach(([table, [dependencies, label]]) =>
    customizer.customizeCollection(table, collection =>
      collection.addField('label', {
        columnType: 'String',
        dependencies,
        // Asked through a link that is empty (a transaction with no card payment): no label.
        getValues: records =>
          records.map(r =>
            Object.values(r).some(v => v !== null && v !== undefined) ? label(r) : null,
          ),
      }),
    ),
  );
}

export { LABELS, addReadableNames };

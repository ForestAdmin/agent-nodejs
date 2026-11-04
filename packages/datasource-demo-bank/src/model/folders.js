/**
 * The domains of the bank: tables grouped the way an operator thinks about the work, as the demo
 * layout's left panel shows them. Read by the Data model chart and the feature explainers.
 */

// [folder, icon, tables]. A table name starting with '-' is in the folder but hidden.
const GROUPS = [
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

module.exports = { GROUPS };

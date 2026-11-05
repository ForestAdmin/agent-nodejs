/**
 * The records a case points to, also listed under its Related Data (Forest only lists the records
 * pointing to it there), and the lists that skip a level.
 */
import { relationNames } from '../../seed/schema';

// Forest lists only the records pointing to this one under Related Data; the record this one points
// to is a field. Case tables also list their parents there, as a list of one: [link, label].
const PARENT_LISTS = {
  documents: [
    ['customer', 'Customer'],
    ['individual', 'Person'],
    ['business', 'Company'],
    ['kyc_case', 'KYC case'],
    ['information_request', 'Request for information'],
  ],
  customer_change_requests: [
    ['customer', 'Customer'],
    ['individual', 'Person'],
  ],
  sar_reports: [
    ['customer', 'Customer'],
    ['investigation', 'Investigation'],
  ],
  information_requests: [
    ['customer', 'Customer'],
    ['addressed_to', 'Addressed to'],
    ['kyc_case', 'KYC case'],
    ['investigation', 'Investigation'],
    ['change_request', 'Change request'],
    ['dispute_request', 'Dispute request'],
    ['chargeback', 'Chargeback'],
    ['sepa_dispute', 'SEPA dispute'],
    ['complaint', 'Complaint'],
    ['loan_application', 'Loan application'],
    ['collection_case', 'Collection case'],
    ['guarantee', 'Guarantee'],
  ],
  alerts: [
    ['customer', 'Customer'],
    ['investigation', 'Investigation'],
    ['rule', 'Rule'],
  ],
  investigations: [
    ['customer', 'Customer'],
    ['origin_kyc_case', 'Origin KYC case'],
    ['origin_authority_request', 'Origin authority request'],
  ],
  screening_hits: [
    ['individual', 'Person'],
    ['business', 'Company'],
    ['counterparty', 'Counterparty'],
    ['watchlist_entry', 'List entry'],
    ['investigation', 'Investigation'],
    ['transaction', 'Transaction'],
  ],
  kyc_cases: [
    ['customer', 'Customer'],
    ['investigation', 'Investigation'],
  ],
  dispute_requests: [
    ['customer', 'Customer'],
    ['transaction', 'Transaction'],
    ['card_transaction', 'Card payment'],
    ['direct_debit', 'Direct debit'],
    ['outgoing_transfer', 'Transfer sent'],
    ['investigation', 'Investigation'],
    ['alert', 'Alert'],
  ],
  chargebacks: [
    ['customer', 'Customer'],
    ['transaction', 'Transaction'],
    ['card_transaction', 'Card payment'],
    ['dispute_request', 'Dispute request'],
    ['alert', 'Alert'],
    ['provisional_credit_transaction', 'Provisional credit'],
  ],
  sepa_disputes: [
    ['customer', 'Customer'],
    ['transaction', 'Transaction'],
    ['direct_debit', 'Direct debit'],
    ['incoming_transfer', 'Transfer received'],
    ['outgoing_transfer', 'Transfer sent'],
    ['dispute_request', 'Dispute request'],
    ['alert', 'Alert'],
    ['return_transaction', 'Money sent back'],
  ],
  dispute_transactions: [
    ['transaction', 'Transaction'],
    ['dispute_request', 'Dispute request'],
    ['chargeback', 'Chargeback'],
    ['sepa_dispute', 'SEPA dispute'],
  ],
  holds: [
    ['account', 'Account'],
    ['investigation', 'Investigation'],
    ['alert', 'Alert'],
    ['screening_hit', 'Screening hit'],
    ['chargeback', 'Chargeback'],
    ['sepa_dispute', 'SEPA dispute'],
    ['authority_request', 'Authority request'],
    ['insolvency_proceeding', 'Insolvency'],
  ],
  complaints: [
    ['customer', 'Customer'],
    ['individual', 'Person'],
    ['transaction', 'Transaction'],
    ['fee', 'Fee'],
    ['chargeback', 'Chargeback'],
    ['dispute_request', 'Dispute request'],
    ['sepa_dispute', 'SEPA dispute'],
    ['collection_case', 'Collection case'],
    ['compensation_transaction', 'Compensation'],
  ],
  einvoicing_registrations: [
    ['customer', 'Customer'],
    ['business', 'Company'],
  ],
  invoices: [
    ['customer', 'Customer'],
    ['business', 'Company'],
    ['registration', 'Directory entry'],
    ['counterparty', 'Counterparty'],
    ['alert', 'Alert'],
  ],
  invoice_payments: [
    ['invoice', 'Invoice'],
    ['transaction', 'Transaction'],
  ],
  loan_applications: [['customer', 'Customer']],
  loans: [
    ['customer', 'Customer'],
    ['application', 'Application'],
    ['account', 'Account'],
    ['disbursement_transaction', 'Payout'],
  ],
  repayments: [
    ['loan', 'Loan'],
    ['transaction', 'Transaction'],
  ],
  guarantees: [
    ['loan_application', 'Application'],
    ['loan', 'Loan'],
    ['guarantor_individual', 'Guarantor (person)'],
    ['guarantor_business', 'Guarantor (company)'],
  ],
  collection_cases: [
    ['customer', 'Customer'],
    ['loan', 'Loan'],
    ['account', 'Account'],
    ['insolvency_proceeding', 'Insolvency'],
  ],
  limit_requests: [
    ['customer', 'Customer'],
    ['requested_by', 'Requested by'],
    ['card', 'Card'],
    ['account', 'Account'],
  ],
  ereporting_submissions: [
    ['customer', 'Customer'],
    ['business', 'Company'],
    ['registration', 'Directory entry'],
    ['replaces', 'Replaces'],
  ],
  closures: [
    ['customer', 'Customer'],
    ['account', 'Account'],
    ['investigation', 'Investigation'],
    ['deceased_case', 'Deceased case'],
    ['insolvency_proceeding', 'Insolvency'],
    ['payout_beneficiary', 'Paid to'],
    ['payout_transaction', 'Payout'],
  ],
  authority_requests: [
    ['customer', 'Customer'],
    ['individual', 'Person'],
    ['business', 'Company'],
  ],
  business_events: [
    ['business', 'Company'],
    ['kyc_case', 'KYC case'],
  ],
  insolvency_proceedings: [
    ['customer', 'Customer'],
    ['business', 'Company'],
    ['individual', 'Person'],
  ],
  deceased_cases: [['individual', 'Person']],
  qa_reviews: [
    ['kyc_case', 'KYC case'],
    ['alert', 'Alert'],
    ['investigation', 'Investigation'],
    ['chargeback', 'Chargeback'],
    ['complaint', 'Complaint'],
  ],
};
// Lists that skip a level: a SAR's alerts are its investigation's alerts.
const SHARED_LISTS = {
  sar_reports: [['alerts', 'alerts', 'investigation_id', 'Alerts']],
};
const parentListName = link => `${link}_list`;

function addParentLists(customizer) {
  const links = relationNames();
  Object.entries(PARENT_LISTS).forEach(([table, parents]) =>
    customizer.customizeCollection(table, collection => {
      parents.forEach(([name]) => {
        const link = links.find(l => l.table === table && l.name === name);
        collection.addOneToManyRelation(parentListName(name), link.target, {
          originKey: 'id',
          originKeyTarget: link.foreignKey,
        });
      });
      (SHARED_LISTS[table] || []).forEach(([name, target, key]) =>
        collection.addOneToManyRelation(name, target, { originKey: key, originKeyTarget: key }),
      );
    }),
  );
}

// eslint-disable-next-line import/prefer-default-export
export { addParentLists };

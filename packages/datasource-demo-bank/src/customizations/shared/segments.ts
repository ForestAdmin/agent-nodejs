/**
 * The work queues: for each key, a table, a name and the condition tree that selects the records
 * waiting in it (`hub_counts` and `feature_facts` count them). Each tree stays one level deep (one
 * condition, or an And of conditions), so it reads as a flat list of conditions.
 *
 * - KYC: retail onboardings for a person, those pre-scored LOW for the onboarding robot (and what
 *   it was given), the senior's sign-offs, the demo's own cases, business onboardings, cases
 *   parked for a screening hit, and the other reviews;
 * - financial crime: AML and fraud alerts, open screening hits, investigations, the MLRO's
 *   sign-offs, SARs to file and SARs waiting for TRACFIN;
 * - payments and disputes: transfers to validate, SEPA recalls received, new disputes,
 *   chargebacks to file or answered by the merchant, requests waiting on the client.
 */
const is = (field, value) => ({ field, operator: 'Equal', value });
const isNot = (field, value) => ({ field, operator: 'NotEqual', value });
const anyOf = (field, values) => ({ field, operator: 'In', value: values });
const has = (field, text) => ({ field, operator: 'Contains', value: text });
const hasNot = (field, text) => ({ field, operator: 'NotContains', value: text });
const and = (...conditions) => ({ aggregator: 'And', conditions });

// The demo's own cases (showcase.ts): KYC-DEMO-… references, kept out of every queue but theirs,
// so a self-service visitor always finds them waiting.
const SHOWCASE_MARK = 'DEMO';
const notShowcase = hasNot('reference', SHOWCASE_MARK);

// key: [table, name, condition tree]
const SEGMENTS = {
  // Not the applications the app pre-scored LOW: those are the onboarding robot's (below). "Is not"
  // keeps an empty pre-score (SQL NotEqual keeps NULLs), so the seeded backlog stays here.
  kyc_retail: [
    'kyc_cases',
    'Retail onboarding',
    and(
      is('type', 'ONBOARDING'),
      is('customer:customer_type', 'RETAIL'),
      anyOf('status', ['OPEN', 'IN_REVIEW']),
      isNot('risk_before', 'LOW'),
      notShowcase,
    ),
  ],
  // The onboarding robot's queue: a new application the app pre-scored LOW (risk_before, set by the
  // app at application time; seeded cases leave it empty). The robot's first step moves the case to
  // IN_REVIEW, so the record leaves this queue as soon as the robot starts on it.
  kyc_retail_auto: [
    'kyc_cases',
    'Retail onboarding: automatic',
    and(
      is('type', 'ONBOARDING'),
      is('customer:customer_type', 'RETAIL'),
      is('status', 'OPEN'),
      is('risk_before', 'LOW'),
      notShowcase,
    ),
  ],
  // What the robot was given, whatever happened next: approved by it, or with a person.
  kyc_retail_auto_runs: [
    'kyc_cases',
    'Automatic onboarding: results',
    and(
      is('type', 'ONBOARDING'),
      is('customer:customer_type', 'RETAIL'),
      is('risk_before', 'LOW'),
      notShowcase,
    ),
  ],
  // Retail onboardings sent for a senior's sign-off (a medium or high risk): the senior officer's
  // queue, demo cases included (KYC-DEMO-0003 and -0004 wait there from boot, showcase.ts).
  kyc_senior: [
    'kyc_cases',
    'Senior sign-off',
    and(
      is('type', 'ONBOARDING'),
      is('customer:customer_type', 'RETAIL'),
      is('status', 'PENDING_APPROVAL'),
    ),
  ],
  // The demo's own cases (showcase.ts), whatever their status.
  kyc_showcase: [
    'kyc_cases',
    'Demo KYC cases',
    and(is('type', 'ONBOARDING'), has('reference', SHOWCASE_MARK)),
  ],
  kyc_business: [
    'kyc_cases',
    'Business onboarding',
    and(
      is('type', 'ONBOARDING'),
      is('customer:customer_type', 'BUSINESS'),
      anyOf('status', ['OPEN', 'IN_REVIEW']),
    ),
  ],
  // Parked for a screening hit only: an onboarding escalated for identity fraud is the
  // investigations team's.
  kyc_parked: [
    'kyc_cases',
    'Parked for screening',
    and(is('status', 'ESCALATED'), is('escalation_reason', 'Screening hit to review')),
  ],
  // The fallback queue: reviews no workflow picks up.
  kyc_other: [
    'kyc_cases',
    'Other KYC reviews',
    and(isNot('type', 'ONBOARDING'), anyOf('status', ['OPEN', 'IN_REVIEW'])),
  ],
  alerts_aml: [
    'alerts',
    'AML alerts to review',
    and(is('category', 'AML'), anyOf('status', ['OPEN', 'IN_REVIEW'])),
  ],
  alerts_fraud: [
    'alerts',
    'Fraud and takeover alerts',
    and(anyOf('category', ['FRAUD', 'ACCOUNT_TAKEOVER']), anyOf('status', ['OPEN', 'IN_REVIEW'])),
  ],
  hits_open: ['screening_hits', 'Open hits', is('status', 'OPEN')],
  // Not the cases waiting on the customer or with the MLRO: those are someone else's turn.
  inv_open: ['investigations', 'Open investigations', anyOf('status', ['OPEN', 'IN_PROGRESS'])],
  mlro_signoff: ['investigations', 'Waiting for MLRO', is('status', 'PENDING_MLRO')],
  sar_draft: ['sar_reports', 'SARs to file', is('status', 'DRAFT')],
  // The rule: filed SARs keep the customer's accounts frozen until TRACFIN's answer is recorded.
  sar_tracfin: [
    'sar_reports',
    'Waiting for TRACFIN',
    anyOf('status', ['SUBMITTED', 'ACKNOWLEDGED']),
  ],
  transfers_validate: [
    'outgoing_transfers',
    'Transfers to validate',
    is('validation_status', 'PENDING'),
  ],
  recalls_in: [
    'sepa_disputes',
    'Recalls we received',
    and(is('side', 'WE_ARE_ASKED'), is('status', 'OPEN')),
  ],
  disputes_new: ['dispute_requests', 'New disputes', is('status', 'NEW')],
  // PRESENTED and PRE_ARBITRATION wait on the merchant's bank, WAITING_CARDHOLDER on the
  // cardholder: only our turns are queues.
  cb_open: ['chargebacks', 'Chargebacks to file', is('status', 'INITIATED')],
  cb_contested: ['chargebacks', 'Merchant answered', is('status', 'REPRESENTED')],
  rfi_waiting: [
    'information_requests',
    'Waiting on the client',
    anyOf('status', ['SENT', 'OVERDUE']),
  ],
};

export { SEGMENTS, SHOWCASE_MARK };

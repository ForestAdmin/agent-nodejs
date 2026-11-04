/**
 * The work queues the inboxes, workflows and desk counters hang on. The demo layout carries them
 * as manual segments: Forest fills an inbox from a layout segment only, a coded one is ignored
 * there. The editor reads one flat list of
 * conditions, so each tree below stays one level deep (layoutFilter).
 */
const crypto = require('crypto');

const is = (field, value) => ({ field, operator: 'Equal', value });
const isNot = (field, value) => ({ field, operator: 'NotEqual', value });
const anyOf = (field, values) => ({ field, operator: 'In', value: values });
const has = (field, text) => ({ field, operator: 'Contains', value: text });
const hasNot = (field, text) => ({ field, operator: 'NotContains', value: text });
const and = (...conditions) => ({ aggregator: 'And', conditions });

// The demo's own cases (showcase.js): KYC-DEMO-… references, kept out of every queue but theirs,
// so a self-service visitor always finds them waiting.
const SHOWCASE_MARK = 'DEMO';
const notShowcase = hasNot('reference', SHOWCASE_MARK);

// key: [table, name, condition tree]
const SEGMENTS = {
  // Not the applications the app pre-scored LOW: those go to the automated inbox below. "Is not"
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
  // The automated inbox: a new application the app pre-scored LOW (risk_before, set by the app at
  // application time; seeded cases leave it empty). Its first step moves the case to IN_REVIEW,
  // so the record leaves this segment as soon as the robot starts on it.
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
  // queue, demo cases included (KYC-DEMO-0003 and -0004 wait there from boot, showcase.js).
  kyc_senior: [
    'kyc_cases',
    'Senior sign-off',
    and(
      is('type', 'ONBOARDING'),
      is('customer:customer_type', 'RETAIL'),
      is('status', 'PENDING_APPROVAL'),
    ),
  ],
  // The demo's two cases (showcase.js), whatever their status: the KYC case desk's own list.
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
  // Escalated runs wait in the "KYC: senior sign-off" workflow inbox, not here.
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

/** Same id on every run (build.py computes the same one for the workflow specs). */
const segmentId = key => {
  const h = crypto.createHash('md5').update(`forest-lab-segment:${key}`).digest('hex');

  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(
    20,
    32,
  )}`;
};

const condition = (field, operator, value) => {
  const [fieldName, subFieldName = null] = field.split(':');

  return { fieldName, subFieldName, embeddedFieldName: null, operator, value };
};

// The operator names Forest's editor stores (read from a segment built in the editor).
// "is in" takes its values as one comma-separated text.
const LAYOUT_OPERATORS = {
  Equal: value => ['is', value],
  NotEqual: value => ['is not', value],
  In: value => ['is in', value.join(',')],
  Contains: value => ['contains', value],
  NotContains: value => ['not contains', value],
};

/** The tree as the layout editor writes it: one flat list of conditions, all to be met. */
function layoutFilter(key) {
  const [, , tree] = SEGMENTS[key];

  return {
    type: 'and',
    conditions: (tree.conditions || [tree]).map(({ field, operator, value }) => {
      if (!LAYOUT_OPERATORS[operator]) {
        throw new Error(`${key}: no layout operator for ${operator}`);
      }

      return condition(field, ...LAYOUT_OPERATORS[operator](value));
    }),
  };
}

module.exports = { SEGMENTS, SHOWCASE_MARK, layoutFilter, segmentId };

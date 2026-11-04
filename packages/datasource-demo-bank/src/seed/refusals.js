/**
 * Why an onboarding ends without approval, in one wording per reason, for the seed (crime.js,
 * onboarding-funnel.js) and the Reject KYC action alike. The code is kyc_cases.rejection_code.
 *
 * Refused (the customer becomes DECLINED): the selfie is not the ID holder, a forged paper, a
 * synthetic identity, owners unlike the register, the bank's risk appetite. A blurry photo or a
 * name difference is asked again, never refused. Closed (back to PROSPECT): no answer.
 */
const REFUSAL = {
  IDENTITY_FAILED: 'Selfie does not match the ID photo',
  DOCUMENT_FORGED: 'Altered document: layout and amounts differ from the issuer’s',
  SYNTHETIC_IDENTITY: 'Same photo and template as other applications (synthetic identity)',
  UBO_MISMATCH: 'INPI register: beneficial owners differ from the declaration',
  RISK_APPETITE: 'Outside the bank’s risk appetite',
  NO_RESPONSE: 'Closed: no answer from the applicant',
};
// What a selfie taken off a screen reads, on a synthetic application.
const LIVENESS = 'Liveness check failed: the selfie is a photo of a screen';

const lowerFirst = text => text.charAt(0).toLowerCase() + text.slice(1);

/** The rejection_reason of a code; `detail` says what put an applicant outside the risk appetite. */
function refusalReason(code, detail) {
  if (code === 'NO_RESPONSE') return `${REFUSAL.NO_RESPONSE}.`;
  if (code === 'RISK_APPETITE') return `${REFUSAL.RISK_APPETITE}${detail ? `: ${detail}` : ''}.`;

  return `Rejected after review: ${lowerFirst(REFUSAL[code])}.`;
}

/** The code a failed paper gives, or null when it is no ground for a refusal (ask again). */
function refusalOfPaper(failureReason) {
  const reason = failureReason || '';
  if (/synthetic|template/i.test(reason)) return 'SYNTHETIC_IDENTITY';
  if (/altered|forg/i.test(reason)) return 'DOCUMENT_FORGED';
  if (/beneficial owners differ/i.test(reason)) return 'UBO_MISMATCH';
  if (/selfie|liveness/i.test(reason)) return 'IDENTITY_FAILED';

  return null;
}

/** A refused applicant is DECLINED; one who stopped answering is a prospect again. */
const customerStatusAfter = code => (code === 'NO_RESPONSE' ? 'PROSPECT' : 'DECLINED');

module.exports = { LIVENESS, REFUSAL, customerStatusAfter, refusalOfPaper, refusalReason };

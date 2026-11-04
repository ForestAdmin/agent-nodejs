/**
 * The outside services the Smart Actions stand in for. Nothing is called: each action answers from
 * the demo's own data, then says which service a real bank would have asked, marked as simulated.
 */
const { createHash } = require('crypto');

const PROVIDERS = {
  register: 'INPI · Registre national des entreprises',
  idCheck: 'Onfido',
  screening: 'ComplyAdvantage',
  phone: 'Aircall',
  payeeCheck: 'STET · SEPA Verification of Payee',
  deviceIntel: 'SEON',
  cardProcessor: 'Marqeta',
  sepa: 'STET · SEPA interbank network',
  tracfin: 'TRACFIN · ERMES portal',
  dgTresor: 'DG Trésor · gel des avoirs',
};

/** The eyebrow of a result card: where the answer comes from. */
const resultsFrom = (provider, what) =>
  `Results from ${provider}${what ? ` · ${what}` : ''} (simulated)`;

/** The number the DG Trésor gives an asset-freeze report: fixed per screening hit. */
const freezeReport = (hitId, year) =>
  `DGT-${year}-${String(
    parseInt(createHash('md5').update(String(hitId)).digest('hex').slice(0, 8), 16) % 1e6,
  ).padStart(6, '0')}`;

module.exports = { PROVIDERS, freezeReport, resultsFrom };

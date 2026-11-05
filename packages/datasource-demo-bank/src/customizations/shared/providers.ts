/**
 * The outside services the Smart Actions stand in for, by their role. Nothing is called: each
 * action answers from the demo's own data, then says which kind of service a real bank would have
 * asked, marked as simulated.
 */
import { createHash } from 'crypto';

const PROVIDERS = {
  register: 'INPI · Registre national des entreprises',
  idCheck: 'ID verification provider',
  screening: 'Sanctions screening provider',
  phone: 'Phone provider',
  payeeCheck: 'Payment network · SEPA Verification of Payee',
  deviceIntel: 'Fraud scoring provider',
  cardProcessor: 'Card processor',
  sepa: 'SEPA payment network',
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

export { PROVIDERS, freezeReport, resultsFrom };

import { customizeScreeningHits as addActions } from './actions/onboarding';
import { addScreeningEvidence } from './evidence/screening';

/** Screening hits: the reviewer's actions, then the hit against the customer. */
export default function customizeScreeningHits(collection) {
  addActions(collection);
  addScreeningEvidence(collection);
}

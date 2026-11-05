import { customizeSepaDisputes as addActions } from './actions/cases';
import { addSepaEvidence } from './evidence/sepa';

/** SEPA disputes: the answering actions, then the evidence. */
export default function customizeSepaDisputes(collection) {
  addActions(collection);
  addSepaEvidence(collection);
}

import { customizeInvestigations as addActions } from './actions/cases';
import { addInvestigationEvidence } from './evidence/investigations';

/** Investigations: the investigator's actions, then the case file. */
export default function customizeInvestigations(collection) {
  addActions(collection);
  addInvestigationEvidence(collection);
}

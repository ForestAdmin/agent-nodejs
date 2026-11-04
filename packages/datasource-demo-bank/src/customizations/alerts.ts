import { customizeAlerts as addActions } from './actions/onboarding';
import { addAlertEvidence } from './evidence/alerts';

/** Alerts: the analyst's actions, then the evidence they read. */
export default function customizeAlerts(collection) {
  addActions(collection);
  addAlertEvidence(collection);
}

const { customizeAlerts: addActions } = require('./actions/onboarding');
const { addAlertEvidence } = require('./evidence/alerts');

/** Alerts: the analyst's actions, then the evidence they read. */
function customizeAlerts(collection) {
  addActions(collection);
  addAlertEvidence(collection);
}

module.exports = customizeAlerts;

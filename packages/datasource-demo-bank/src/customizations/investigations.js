const { customizeInvestigations: addActions } = require('./actions/cases');
const { addInvestigationEvidence } = require('./evidence/investigations');

/** Investigations: the investigator's actions, then the case file. */
function customizeInvestigations(collection) {
  addActions(collection);
  addInvestigationEvidence(collection);
}

module.exports = customizeInvestigations;

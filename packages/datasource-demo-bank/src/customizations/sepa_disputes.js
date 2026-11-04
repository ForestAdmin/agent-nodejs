const { customizeSepaDisputes: addActions } = require('./actions/cases');
const { addSepaEvidence } = require('./evidence/sepa');

/** SEPA disputes: the answering actions, then the evidence. */
function customizeSepaDisputes(collection) {
  addActions(collection);
  addSepaEvidence(collection);
}

module.exports = customizeSepaDisputes;

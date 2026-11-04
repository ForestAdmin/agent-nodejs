const { customizeScreeningHits: addActions } = require('./actions/onboarding');
const { addScreeningEvidence } = require('./evidence/screening');

/** Screening hits: the reviewer's actions, then the hit against the customer. */
function customizeScreeningHits(collection) {
  addActions(collection);
  addScreeningEvidence(collection);
}

module.exports = customizeScreeningHits;

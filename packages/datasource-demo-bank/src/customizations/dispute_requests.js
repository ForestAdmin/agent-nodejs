const { customizeDisputeRequests: addActions } = require('./actions/cases');
const { addDisputeEvidence } = require('./evidence/disputes');

/** Dispute requests: the routing actions, then the evidence. */
function customizeDisputeRequests(collection) {
  addActions(collection);
  addDisputeEvidence(collection);
}

module.exports = customizeDisputeRequests;

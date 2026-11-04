const { customizeOutgoingTransfers: addActions } = require('./actions/cases');
const { addTransferEvidence } = require('./evidence/transfers');

/** Transfers sent: the validation actions, then the evidence. */
function customizeOutgoingTransfers(collection) {
  addActions(collection);
  addTransferEvidence(collection);
}

module.exports = customizeOutgoingTransfers;

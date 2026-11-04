const { recordTracfinAnswer } = require('./actions/cases');

/** SARs: recording TRACFIN's answer. */
function customizeSarReports(collection) {
  recordTracfinAnswer(collection);
}

module.exports = customizeSarReports;

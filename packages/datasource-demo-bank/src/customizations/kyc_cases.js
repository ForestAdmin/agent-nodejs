const { addDemoFeed } = require('./actions/demo-feed');
const {
  addLanguageOnCase,
  customizeKycCases: addOnboardingActions,
} = require('./actions/onboarding');
const { addPartnerActions } = require('./actions/partner');
const { addRobotResults } = require('./actions/robot-results');
const { addShowcaseReset } = require('./actions/showcase');
const { addCaseFile } = require('./shared/case-file');

/**
 * KYC cases, in this order (the agent numbers Smart Actions by their order on a table, and the
 * layout's buttons call those numbers): the onboarding workflow's actions, "Change preferred
 * language", the partner app's actions, the case file a reviewer reads, the robot's results,
 * "Send new applications", "Reset the demo cases".
 */
function customizeKycCases(collection) {
  addOnboardingActions(collection);
  addLanguageOnCase(collection);
  addPartnerActions(collection);
  addCaseFile(collection);
  addRobotResults(collection);
  addDemoFeed(collection);
  addShowcaseReset(collection);
}

module.exports = customizeKycCases;

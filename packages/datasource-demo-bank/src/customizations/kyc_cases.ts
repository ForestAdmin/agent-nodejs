import { addDemoFeed } from './actions/demo-feed';
import { addLanguageOnCase, customizeKycCases as addOnboardingActions } from './actions/onboarding';
import { addPartnerActions } from './actions/partner';
import { addRobotResults } from './actions/robot-results';
import { addShowcaseReset } from './actions/showcase';
import { addCaseFile } from './shared/case-file';

/**
 * KYC cases, in this order (the agent numbers Smart Actions by their order on a table): the
 * onboarding actions, "Change preferred language", the partner app's actions, the case file a
 * reviewer reads, the robot's results, "Send new applications", "Reset the demo cases".
 * `partnerPortalOrigins`: the portal addresses "Upload document" fetches files from.
 */
export default function customizeKycCases(
  collection,
  { partnerPortalOrigins }: { partnerPortalOrigins: string[] },
) {
  addOnboardingActions(collection);
  addLanguageOnCase(collection);
  addPartnerActions(collection, { partnerPortalOrigins });
  addCaseFile(collection);
  addRobotResults(collection);
  addDemoFeed(collection);
  addShowcaseReset(collection);
}

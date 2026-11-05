import { recordTracfinAnswer } from './actions/cases';

/** SARs: recording TRACFIN's answer. */
export default function customizeSarReports(collection) {
  recordTracfinAnswer(collection);
}

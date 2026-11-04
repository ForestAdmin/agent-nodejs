import { customizeDisputeRequests as addActions } from './actions/cases';
import { addDisputeEvidence } from './evidence/disputes';

/** Dispute requests: the routing actions, then the evidence. */
export default function customizeDisputeRequests(collection) {
  addActions(collection);
  addDisputeEvidence(collection);
}

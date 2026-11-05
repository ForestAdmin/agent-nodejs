import { customizeOutgoingTransfers as addActions } from './actions/cases';
import { addTransferEvidence } from './evidence/transfers';

/** Transfers sent: the validation actions, then the evidence. */
export default function customizeOutgoingTransfers(collection) {
  addActions(collection);
  addTransferEvidence(collection);
}

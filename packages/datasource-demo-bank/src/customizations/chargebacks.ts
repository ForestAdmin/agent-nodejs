import { customizeChargebacks as addChargebackActions } from './actions/cases';
import { addChargebackEvidence } from './evidence/chargebacks';
import * as render from './shared/render';

/** Chargebacks: the file sent to the network, the disputes agent's actions, the evidence. */
export default function customizeChargebacks(collection) {
  collection.addField('file', {
    columnType: 'String',
    dependencies: render.CHARGEBACK_DEPENDENCIES,
    getValues: records => records.map(r => (r.filed_at ? render.chargebackUri(r) : null)),
  });
  addChargebackActions(collection);
  addChargebackEvidence(collection);
}

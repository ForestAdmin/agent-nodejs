const { customizeChargebacks: addChargebackActions } = require('./actions/cases');
const { addChargebackEvidence } = require('./evidence/chargebacks');
const render = require('./shared/render');

/** Chargebacks: the file sent to the network, the disputes agent's actions, the evidence. */
function customizeChargebacks(collection) {
  collection.addField('file', {
    columnType: 'String',
    dependencies: render.CHARGEBACK_DEPENDENCIES,
    getValues: records => records.map(r => (r.filed_at ? render.chargebackUri(r) : null)),
  });
  addChargebackActions(collection);
  addChargebackEvidence(collection);
}

module.exports = customizeChargebacks;

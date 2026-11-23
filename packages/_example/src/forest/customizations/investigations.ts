import type { InvestigationsCustomizer } from '../typings';

export default (collection: InvestigationsCustomizer) =>
  collection
    .removeField('origin_authority_request_id')
    .addManyToOneRelation('customer', 'customers', { foreignKey: 'customer_id' })
    .addManyToOneRelation('origin_kyc_case', 'kyc_cases', { foreignKey: 'origin_kyc_case_id' })
    .addOneToManyRelation('alerts', 'alerts', { originKey: 'investigation_id' })
    .addOneToManyRelation('sar_reports', 'sar_reports', { originKey: 'investigation_id' });

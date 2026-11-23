import type { CustomersCustomizer } from '../typings';

export default (collection: CustomersCustomizer) =>
  collection
    .addOneToManyRelation('cards', 'cards', { originKey: 'customer_id' })
    .addOneToManyRelation('alerts', 'alerts', { originKey: 'customer_id' })
    .addOneToManyRelation('kyc_cases', 'kyc_cases', { originKey: 'customer_id' })
    .addOneToManyRelation('chargebacks', 'chargebacks', { originKey: 'customer_id' });

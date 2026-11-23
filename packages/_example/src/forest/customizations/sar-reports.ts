import type { SarReportsCustomizer } from '../typings';

export default (collection: SarReportsCustomizer) =>
  collection
    .addManyToOneRelation('customer', 'customers', { foreignKey: 'customer_id' })
    .addManyToOneRelation('investigation', 'investigations', { foreignKey: 'investigation_id' });

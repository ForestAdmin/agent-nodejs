import type { SalesCustomizer } from '../typings';

export default (collection: SalesCustomizer) =>
  collection.addManyToOneRelation('customerAccount', 'account', {
    foreignKey: 'customer@@@accountNumber',
  });

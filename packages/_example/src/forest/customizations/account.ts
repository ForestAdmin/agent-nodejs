import type { AccountCustomizer } from '../typings';

export default (collection: AccountCustomizer) =>
  collection.addManyToOneRelation('store', 'store', { foreignKey: 'storeId' });

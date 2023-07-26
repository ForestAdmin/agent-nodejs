import { ReviewCustomizer } from '../typings';

export default (collection: ReviewCustomizer) =>
  collection.addManyToOneRelation('store', 'store', { foreignKey: 'storeId' });

import { CardCustomizer } from '../typings';

export default (collection: CardCustomizer) =>
  collection.addManyToOneRelation('customer', 'customer', { foreignKey: 'customer_id' });

import { CollectionCustomizer } from '@forestadmin/agent';
import { Schema } from '../typings';

export default (collection: CollectionCustomizer<Schema, 'card'>) =>
  collection.addManyToOneRelation('customer', 'customer', { foreignKey: 'customer_id' });

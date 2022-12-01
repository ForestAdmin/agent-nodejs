import { CollectionCustomizer } from '@forestadmin/agent';

import { Schema } from '../typings';

export default (collection: CollectionCustomizer<Schema, 'account'>) =>
  collection.addManyToOneRelation('store', 'store', { foreignKey: 'storeId' });

import { Collection } from '@forestadmin/agent';

import { Schema } from '../typings';

export default (collection: Collection<Schema, 'review'>) =>
  collection.addManyToOne('store', 'store', { foreignKey: 'storeId' });

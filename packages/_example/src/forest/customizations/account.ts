import { CollectionCustomizer } from '@forestadmin/agent';
import { flattenRelation } from '@forestadmin/plugin-flattener';

import { Schema } from '../typings';

export default (collection: CollectionCustomizer<Schema, 'account'>) => {
  collection.addManyToOneRelation('store', 'store', { foreignKey: 'storeId' });
  collection.use(flattenRelation, { relationName: 'address', withRelations: true });
};

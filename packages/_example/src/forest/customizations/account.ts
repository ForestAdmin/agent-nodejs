import { CollectionCustomizer } from '@forestadmin/agent';

import { Schema } from '../typings';

export default (collection: CollectionCustomizer<Schema, 'account'>) =>
  collection
    .addManyToOneRelation('store', 'store', { foreignKey: 'storeId' })
    .addSegment('Store with empty in', {
      field: 'firstname',
      operator: 'In',
      value: [1, 2],
    });

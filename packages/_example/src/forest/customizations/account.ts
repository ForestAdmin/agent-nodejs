import { CollectionCustomizer } from '@forestadmin/agent';

import { Schema } from '../typings';

export default (collection: CollectionCustomizer<Schema, 'account'>) => {
  collection.importField('address_city', { path: 'address:city' });
  collection.importField('address_country', { path: 'address:country' });

  collection.addManyToOneRelation('store', 'store', { foreignKey: 'storeId' });
};

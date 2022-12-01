import { CollectionCustomizer } from '@forestadmin/agent';
import { importFields } from '@forestadmin/plugin-flattener'; // eslint-disable-line import/no-extraneous-dependencies

import { Schema } from '../typings';

export default (collection: CollectionCustomizer<Schema, 'account'>) => {
  // collection.importField('address_city', { path: 'address:city' });
  // collection.importField('address_country', { path: 'address:country' });
  // collection.importField('address_sub_title', { path: 'address:sub:title' });
  collection.use(importFields, { relationName: 'address' });
  collection.use(importFields, { relationName: 'address:sub' });

  collection.addManyToOneRelation('store', 'store', { foreignKey: 'storeId' });
};

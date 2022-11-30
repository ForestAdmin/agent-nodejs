import { CollectionCustomizer } from '@forestadmin/agent';
import { flattenField, importFields } from '@forestadmin/plugin-import-fields'; // eslint-disable-line import/no-extraneous-dependencies

import { Schema } from '../typings';

export default (collection: CollectionCustomizer<Schema, 'account'>) => {
  // collection.importField('address_city', { path: 'address:city' });
  // collection.importField('address_country', { path: 'address:country' });
  // collection.importField('address_sub_title', { path: 'address:sub:title' });
  // collection.use(importFields, { relationName: 'address' });
  // collection.use(importFields, { relationName: 'address:sub' });

  collection.use(flattenField, { field: 'address', level: 99 });

  // for (const field of ['city', 'country'] as ['city', 'country']) {
  //   collection.addField(`address_${field}`, {
  //     columnType: 'String',
  //     dependencies: ['address'],
  //     getValues: records => records.map(r => r.address?.[field]),
  //   });

  //   collection.replaceFieldWriting(`address_${field}`, value => {
  //     return { address: { [field]: value } };
  //   });
  // }

  // collection.importField('address@@@city', { path: 'address.city' });

  collection.addManyToOneRelation('store', 'store', { foreignKey: 'storeId' });
};

import { CollectionCustomizer } from '@forestadmin/agent';

import { Schema } from '../typings';

export default (collection: CollectionCustomizer<Schema, 'customer'>) => {
  collection.customizeField('firstName', field => {
    field.addValidation('Present');
    field.addValidation('LongerThan', 2);
    field.addValidation('ShorterThan', 15);
    field.addValidation('ShorterThan', 13);
    field.addValidation('Contains', 'Romain');
  });

  collection.addOneToManyRelation('rentals', 'rental', { originKey: 'customerId' });
  collection.removeField('deletedAt');
};

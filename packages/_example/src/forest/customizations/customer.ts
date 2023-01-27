import { CollectionCustomizer } from '@forestadmin/agent';

import { Schema } from '../typings';

export default (collection: CollectionCustomizer<Schema, 'customer'>) => {
  // avant
  collection.addFieldValidation('firstName', 'Present');
  collection.addFieldValidation('firstName', 'LongerThan', 2);
  collection.addFieldValidation('firstName', 'ShorterThan', 15);
  collection.addFieldValidation('firstName', 'ShorterThan', 13);
  collection.addFieldValidation('firstName', 'Contains', 'Romain');

  // apres
  collection.customizeField('firstName', field => {
    field.define({});

    field.addValidation('Present');
    field.addValidation('LongerThan', 2);
    field.addValidation('ShorterThan', 15);
    field.addValidation('ShorterThan', 13);
    field.addValidation('Contains', 'Romain');
  });

  collection.addOneToManyRelation('rentals', 'rental', { originKey: 'customerId' });
  collection.removeField('deletedAt');
};

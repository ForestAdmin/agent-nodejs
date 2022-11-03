import { CollectionCustomizer } from '@forestadmin/agent';

import { Schema } from '../typings';

export default (collection: CollectionCustomizer<Schema, 'customer'>) =>
  collection
    .addFieldValidation('firstName', 'Present')
    .addFieldValidation('firstName', 'LongerThan', 2)
    .addFieldValidation('firstName', 'ShorterThan', 15)
    .addFieldValidation('firstName', 'ShorterThan', 13)
    .addFieldValidation('firstName', 'Contains', 'Romain')

    .addOneToManyRelation('rentals', 'rental', { originKey: 'customerId' })
    .removeField('deletedAt');

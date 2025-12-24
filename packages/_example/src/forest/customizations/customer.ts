import type { CustomerCustomizer } from '../typings';

export default (collection: CustomerCustomizer) =>
  collection
    .addFieldValidation('firstName', 'Present')
    .addFieldValidation('firstName', 'LongerThan', 2)
    .addFieldValidation('firstName', 'ShorterThan', 15)
    .addFieldValidation('firstName', 'ShorterThan', 13)
    .addFieldValidation('firstName', 'Contains', 'Romain')

    .addOneToManyRelation('rentals', 'rental', { originKey: 'customerId' })
    .removeField('deletedAt');

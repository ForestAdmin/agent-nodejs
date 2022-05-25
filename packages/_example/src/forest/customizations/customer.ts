import { Collection } from '@forestadmin/agent';
import { Schema } from '../typings';

export default (collection: Collection<Schema, 'customer'>) =>
  collection
    .addValidation('firstName', 'Present')
    .addValidation('firstName', 'LongerThan', 2)
    .addValidation('firstName', 'ShorterThan', 15)

    .addOneToManyRelation('rentals', 'rental', { originKey: 'customerId' })
    .removeField('deletedAt');

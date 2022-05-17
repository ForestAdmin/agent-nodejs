import { Collection } from '@forestadmin/agent';
import { Schema } from '../typings';

export default (collection: Collection<Schema, 'customer'>) =>
  collection
    .addOneToMany('rentals', 'rental', { originKey: 'customerId' })
    .removeField('deletedAt');

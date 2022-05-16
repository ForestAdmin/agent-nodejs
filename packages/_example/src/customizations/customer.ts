import { Collection } from '@forestadmin/agent';

export default (collection: Collection) =>
  collection
    .addOneToMany('rentals', 'rental', { originKey: 'customerId' })
    .removeField('deletedAt');

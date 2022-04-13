import { Collection } from '@forestadmin/agent';

export default (collection: Collection) =>
  collection
    .addRelation('rentals', {
      type: 'OneToMany',
      foreignCollection: 'rental',
      originKey: 'customerId',
      originKeyTarget: 'id',
    })
    .removeField('deletedAt');

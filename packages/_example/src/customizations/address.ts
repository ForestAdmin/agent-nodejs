import { Collection } from '@forestadmin/agent';

export default (collection: Collection) =>
  collection
    .addRelation('store', {
      type: 'OneToOne',
      foreignCollection: 'store',
      originKey: 'id',
      originKeyTarget: 'storeId',
    })
    .removeField('updatedAt', 'createdAt');

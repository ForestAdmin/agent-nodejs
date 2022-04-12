import { Collection } from '@forestadmin/agent';

export default (collection: Collection) =>
  collection
    .addRelation('store', {
      type: 'ManyToOne',
      foreignCollection: 'store',
      foreignKey: 'storeId',
      foreignKeyTarget: 'id',
    })
    .removeField('updatedAt', 'createdAt');

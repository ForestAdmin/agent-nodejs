import { Collection } from '@forestadmin/agent';

export default (collection: Collection) =>
  collection.addRelation('store', {
    type: 'ManyToOne',
    foreignKey: 'storeId',
    foreignCollection: 'store',
  });

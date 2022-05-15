import { Collection } from '@forestadmin/agent';

export default (collection: Collection) =>
  collection
    .addManyToOne('store', 'store', { foreignKey: 'storeId' })
    .removeField('updatedAt', 'createdAt');

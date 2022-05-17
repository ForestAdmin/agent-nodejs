import { Collection } from '@forestadmin/agent';
import { Schema } from '../typings';

export default (collection: Collection<Schema, 'address'>) =>
  collection
    .addManyToOne('store', 'store', { foreignKey: 'storeId' })
    .removeField('updatedAt', 'createdAt');

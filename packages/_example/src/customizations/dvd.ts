import { Collection } from '@forestadmin/agent';
import { FieldTypes } from '@forestadmin/datasource-toolkit';

export default (collection: Collection) =>
  collection.registerJointure('store', {
    type: FieldTypes.ManyToOne,
    foreignKey: 'storeId',
    foreignKeyTarget: 'id',
    foreignCollection: 'store',
  });

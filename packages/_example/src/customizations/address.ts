import { Collection } from '@forestadmin/agent';
import { FieldTypes } from '@forestadmin/datasource-toolkit';

export default (collection: Collection) =>
  collection
    .addRelation('store', {
      type: FieldTypes.OneToOne,
      foreignCollection: 'store',
      originKey: 'id',
      originKeyTarget: 'storeId',
    })
    .removeField('updatedAt', 'createdAt');

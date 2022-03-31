import { Collection } from '@forestadmin/agent';
import { FieldTypes } from '@forestadmin/datasource-toolkit';

export default (collection: Collection) =>
  collection.registerJointure('store', {
    type: FieldTypes.OneToMany,
    foreignCollection: 'store',
    originKey: 'id',
    originKeyTarget: 'id',
  });

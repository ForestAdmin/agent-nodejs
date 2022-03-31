import { Collection } from '@forestadmin/agent';
import { FieldTypes } from '@forestadmin/datasource-toolkit';

export default (collection: Collection) =>
  collection
    .registerJointure('owner', {
      type: FieldTypes.ManyToOne,
      foreignKey: 'ownerId',
      foreignKeyTarget: 'id',
      foreignCollection: 'owner',
    })
    .registerJointure('address', {
      type: FieldTypes.OneToOne,
      foreignCollection: 'address',
      originKey: 'storeId',
      originKeyTarget: 'id',
    })
    .registerJointure('dvd', {
      type: FieldTypes.OneToMany,
      foreignCollection: 'dvd',
      originKey: 'storeId',
      originKeyTarget: 'id',
    });

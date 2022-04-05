import { Collection } from '@forestadmin/agent';
import { FieldTypes } from '@forestadmin/datasource-toolkit';

export default (collection: Collection) =>
  collection
    .addRelation('owner', {
      type: FieldTypes.ManyToOne,
      foreignKey: 'ownerId',
      foreignKeyTarget: 'id',
      foreignCollection: 'owner',
    })
    .addRelation('address', {
      type: FieldTypes.OneToOne,
      foreignCollection: 'address',
      originKey: 'storeId',
      originKeyTarget: 'id',
    })
    .addRelation('dvd', {
      type: FieldTypes.OneToMany,
      foreignCollection: 'dvd',
      originKey: 'storeId',
      originKeyTarget: 'id',
    })
    .importField('ownerFullName', { path: 'owner:fullName' })
    .replaceFieldWriting('ownerFullName', ({ action, patch: fullName }) => {
      if (action === 'update') {
        return { owner: { fullName } };
      }
    });

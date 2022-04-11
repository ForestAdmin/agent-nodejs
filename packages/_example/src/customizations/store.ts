import { Collection } from '@forestadmin/agent';

export default (collection: Collection) =>
  collection
    .addRelation('owner', {
      type: 'ManyToOne',
      foreignKey: 'ownerId',
      foreignKeyTarget: 'id',
      foreignCollection: 'owner',
    })
    .addRelation('address', {
      type: 'OneToOne',
      foreignCollection: 'address',
      originKey: 'storeId',
      originKeyTarget: 'id',
    })
    .addRelation('dvd', {
      type: 'OneToMany',
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

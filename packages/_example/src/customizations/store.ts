import { Collection } from '@forestadmin/agent';

export default (collection: Collection) =>
  collection
    .addManyToOne('owner', 'owner', { foreignKey: 'ownerId' })
    .addOneToOne('address', 'address', { originKey: 'storeId' })
    .addOneToMany('dvd', 'dvd', { originKey: 'storeId' })
    .importField('ownerFullName', { path: 'owner:fullName' })
    .replaceFieldWriting('ownerFullName', (fullName, { action }) => {
      if (action === 'update') {
        return { owner: { fullName } };
      }
    });

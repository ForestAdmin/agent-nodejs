import { Collection } from '@forestadmin/agent';
import { Schema } from '../typings';

export default (collection: Collection<Schema, 'store'>) =>
  collection
    .addManyToOne('owner', 'owner', { foreignKey: 'ownerId' })
    .addOneToOne('address', 'address', { originKey: 'storeId' })
    .addOneToMany('dvds', 'dvd', { originKey: 'storeId' })
    .importField('ownerFullName', { path: 'owner:fullName' })
    .replaceFieldWriting('ownerFullName', (fullName, { action }) => {
      if (action === 'update') {
        return { owner: { fullName } };
      }
    });

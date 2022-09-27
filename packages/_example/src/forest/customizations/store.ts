import { CollectionCustomizer } from '@forestadmin/agent';
import { Schema } from '../typings';

export default (collection: CollectionCustomizer<Schema, 'store'>) =>
  collection
    .addManyToOneRelation('owner', 'owner', { foreignKey: 'ownerId' })
    .addOneToManyRelation('dvds', 'dvd', { originKey: 'storeId' })
    .addOneToManyRelation('accounts', 'account', { originKey: 'storeId' })

    .importField('ownerFullName', { path: 'owner:fullName' });

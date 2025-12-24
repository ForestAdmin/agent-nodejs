import type { StoreCustomizer } from '../typings';

export default (collection: StoreCustomizer) =>
  collection
    .addManyToOneRelation('owner', 'owner', { foreignKey: 'ownerId' })
    .addOneToManyRelation('dvds', 'dvd', { originKey: 'storeId' })
    .addOneToManyRelation('accounts', 'account', { originKey: 'storeId' })

    .importField('ownerFullName', { path: 'owner:fullName' });

import { Collection } from '@forestadmin/agent';
import { Schema } from '../typings';

export default (collection: Collection<Schema, 'store'>) =>
  collection
    .addManyToOneRelation('owner', 'owner', { foreignKey: 'ownerId' })
    .addOneToOneRelation('address', 'renamedAddress', { originKey: 'storeId' })
    .addOneToManyRelation('dvds', 'dvd', { originKey: 'storeId' })
    .importField('ownerFullName', { path: 'owner:fullName' })
    .replaceFieldWriting('ownerFullName', (fullName, { action }) => {
      if (action === 'update') {
        return { owner: { fullName } };
      }
    })
    .addField('allAddress', {
      columnType: 'String',
      dependencies: ['address:address'],
      getValues: records => records.map(record => record.address),
    });

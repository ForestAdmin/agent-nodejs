import { Collection } from '@forestadmin/agent';
import { Schema } from '../typings';

export default (collection: Collection<Schema, 'owner'>) =>
  collection
    .addOneToMany('stores', 'store', { originKey: 'ownerId' })
    .addOneToMany('posts', 'post', { originKey: 'userId' })
    .addField('fullName', {
      columnType: 'String',
      dependencies: ['firstName', 'lastName'],
      getValues: records => records.map(record => `${record.firstName} ${record.lastName}`),
    })
    .replaceFieldWriting('fullName', fullName => {
      const [firstName, lastName] = (fullName as string).split(' ');

      return { firstName, lastName };
    })
    .replaceFieldSorting('fullName', [
      { field: 'firstName', ascending: true },
      { field: 'lastName', ascending: true },
    ]);

import { Collection } from '@forestadmin/agent';

export default (collection: Collection) =>
  collection
    .addRelation('store', {
      type: 'OneToMany',
      foreignCollection: 'store',
      originKey: 'ownerId',
      originKeyTarget: 'id',
    })
    .addRelation('posts', {
      type: 'OneToMany',
      foreignCollection: 'post',
      originKey: 'userId',
    })
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

import type { OwnerCustomizer } from '../typings';

export default (collection: OwnerCustomizer) =>
  collection
    .addOneToManyRelation('stores', 'store', { originKey: 'ownerId' })
    .addOneToManyRelation('posts', 'post', { originKey: 'userId' })
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

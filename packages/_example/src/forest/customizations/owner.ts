import type { OwnerCustomizer } from '../typings';

export default (collection: OwnerCustomizer) =>
  collection
    .addOneToManyRelation('stores', 'store', { originKey: 'ownerId' })
    .addOneToManyRelation('posts', 'post', { originKey: 'userId' })
    .addField('fullName', {
      columnType: 'String',
      // createSqlDataSource uses raw column names (snake_case)
      dependencies: ['first_name', 'last_name'],
      getValues: records =>
        records.map(record => `${record.first_name} ${record.last_name}`),
    })
    .replaceFieldWriting('fullName', fullName => {
      const [firstName, lastName] = (fullName as string).split(' ');

      return { first_name: firstName, last_name: lastName };
    })
    .replaceFieldSorting('fullName', [
      { field: 'first_name', ascending: true },
      { field: 'last_name', ascending: true },
    ]);

import { Collection } from '@forestadmin/agent';
import { Projection } from '@forestadmin/datasource-toolkit';

export default (collection: Collection) =>
  collection
    .addRelation('store', {
      type: 'OneToMany',
      foreignCollection: 'store',
      originKey: 'ownerId',
      originKeyTarget: 'id',
    })
    .addField('fullName', {
      columnType: 'String',
      dependencies: new Projection('firstName', 'lastName'),
      getValues: records => records.map(record => `${record.firstName} ${record.lastName}`),
    })
    .replaceFieldWriting('fullName', ({ patch: fullName }) => {
      const [firstName, lastName] = (fullName as string).split(' ');

      return { firstName, lastName };
    })
    .replaceFieldSorting('fullName', [
      { field: 'firstName', ascending: true },
      { field: 'lastName', ascending: true },
    ]);

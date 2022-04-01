import { Collection } from '@forestadmin/agent';
import { FieldTypes, PrimitiveTypes } from '@forestadmin/datasource-toolkit';

export default (collection: Collection) =>
  collection
    .registerJointure('store', {
      type: FieldTypes.OneToMany,
      foreignCollection: 'store',
      originKey: 'id',
      originKeyTarget: 'id',
    })
    .registerField('fullName', {
      columnType: PrimitiveTypes.String,
      dependencies: ['firstName', 'lastName'],
      getValues: records => records.map(record => `${record.firstName} ${record.lastName}`),
    })
    .implementWrite('fullName', async (fullName: string) => {
      const [firstName, lastName] = fullName.split(' ');

      return { firstName, lastName };
    });

import { Collection } from '@forestadmin/agent';
import { PrimitiveTypes } from '@forestadmin/datasource-toolkit';

export default (collection: Collection) =>
  collection
    .registerField('emailDomain', {
      columnType: PrimitiveTypes.String,
      dependencies: ['email'],
      getValues: records => records.map(record => (record.email as string).split('@')[1]),
      sortBy: 'emulate',
    })
    .registerField('emailPrefix', {
      columnType: PrimitiveTypes.String,
      dependencies: ['email'],
      getValues: records => records.map(record => (record.email as string).split('@')[0]),
      sortBy: 'emulate',
    })
    .unpublishFields(['email']);

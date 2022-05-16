import { Collection } from '@forestadmin/agent';
import { Schema } from '../typings';

export default (collection: Collection<Schema, 'rental'>) =>
  collection
    .addField('numberOfDays', {
      columnType: 'Number',
      dependencies: ['startDate', 'endDate'],
      getValues: records =>
        records.map(record => {
          // Datasource is sending dates, typing is expecting strings
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          const timeDifference = record.endDate.getTime() - record.startDate.getTime();

          return Math.trunc(timeDifference / (1000 * 60 * 60 * 24));
        }),
    })
    .emulateFieldSorting('numberOfDays')
    .removeField('startDate', 'endDate')
    .emulateFieldOperator('numberOfDays', 'GreaterThan')
    .addSegment('More than 50 Days', { field: 'numberOfDays', operator: 'GreaterThan', value: 50 })
    .addManyToOne('customer', 'customer', { foreignKey: 'customerId' });

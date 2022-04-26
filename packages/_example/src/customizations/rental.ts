import { Collection } from '@forestadmin/agent';

export default (collection: Collection) =>
  collection
    .addField('numberOfDays', {
      columnType: 'Number',
      dependencies: ['startDate', 'endDate'],
      getValues: records =>
        records.map((record: { startDate: Date; endDate: Date }) => {
          const timeDifference = record.endDate.getTime() - record.startDate.getTime();

          return Math.trunc(timeDifference / (1000 * 60 * 60 * 24));
        }),
    })
    .emulateFieldSorting('numberOfDays')
    .removeField('startDate', 'endDate')
    .emulateFieldOperator('numberOfDays', 'GreaterThan')
    .addSegment('More than 50 Days', { field: 'numberOfDays', operator: 'GreaterThan', value: 50 })
    .addRelation('customer', {
      type: 'ManyToOne',
      foreignCollection: 'customer',
      foreignKey: 'customerId',
      foreignKeyTarget: 'id',
    });

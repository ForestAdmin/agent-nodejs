import { CollectionCustomizer } from '@forestadmin/agent';

import { Schema } from '../typings';

export default (collection: CollectionCustomizer<Schema, 'rental'>) =>
  collection
    .addField('numberOfDays', {
      columnType: 'Number',
      dependencies: ['startDate', 'endDate'],
      getValues: records =>
        records.map(record => {
          const timeDifference =
            new Date(record.endDate).getTime() - new Date(record.startDate).getTime();

          return Math.trunc(timeDifference / (1000 * 60 * 60 * 24));
        }),
    })
    .emulateFieldSorting('numberOfDays')
    .removeField('startDate', 'endDate')
    .emulateFieldOperator('numberOfDays', 'GreaterThan')
    .addSegment('More than 50 Days', { field: 'numberOfDays', operator: 'GreaterThan', value: 50 })
    .addManyToOneRelation('customer', 'customer', { foreignKey: 'customerId' });

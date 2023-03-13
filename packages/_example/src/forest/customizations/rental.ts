import { CollectionCustomizer } from '@forestadmin/agent';

import { Schema } from '../typings';

export default (collection: CollectionCustomizer<Schema, 'rental'>) =>
  collection
    .customizeField('numberOfDays', field =>
      field
        .add({
          columnType: 'Number',
          dependencies: ['startDate', 'endDate'],
          getValues: records =>
            records.map(record => {
              const timeDifference =
                new Date(record.endDate).getTime() - new Date(record.startDate).getTime();

              return Math.trunc(timeDifference / (1000 * 60 * 60 * 24));
            }),
        })
        .emulateSorting()
        .emulateOperator('GreaterThan'),
    )
    .removeField('startDate', 'endDate')

    .addSegment('More than 50 Days', { field: 'numberOfDays', operator: 'GreaterThan', value: 50 })
    .addManyToOneRelation('customer', 'customer', { foreignKey: 'customerId' });

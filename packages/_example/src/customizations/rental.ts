import { Collection } from '@forestadmin/agent';
import {
  ConditionTreeLeaf,
  Operator,
  PrimitiveTypes,
  Projection,
} from '@forestadmin/datasource-toolkit';

export default (collection: Collection) =>
  collection
    .addField('numberOfDays', {
      columnType: PrimitiveTypes.Number,
      dependencies: new Projection('startDate', 'endDate'),
      getValues: records =>
        records.map((record: { startDate: Date; endDate: Date }) => {
          const timeDifference = record.endDate.getTime() - record.startDate.getTime();

          return Math.trunc(timeDifference / (1000 * 60 * 60 * 24));
        }),
    })
    .emulateFieldSorting('numberOfDays')
    .removeField('startDate', 'endDate')
    .emulateFieldOperator('numberOfDays', Operator.GreaterThan)
    .addSegment(
      'More than 50 Days',
      new ConditionTreeLeaf('numberOfDays', Operator.GreaterThan, 50),
    );

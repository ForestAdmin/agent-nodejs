import { Collection } from '@forestadmin/agent';
import { ConditionTreeLeaf, Operator, PrimitiveTypes } from '@forestadmin/datasource-toolkit';

export default (collection: Collection) =>
  collection
    .registerField('numberOfDays', {
      columnType: PrimitiveTypes.Number,
      dependencies: ['startDate', 'endDate'],
      getValues: records =>
        records.map((record: { startDate: Date; endDate: Date }) => {
          const timeDifference = record.endDate.getTime() - record.startDate.getTime();

          return Math.trunc(timeDifference / (1000 * 60 * 60 * 24));
        }),
    })
    .emulateSort('numberOfDays')
    .unpublishFields(['startDate', 'endDate'])
    .emulateOperator('numberOfDays', Operator.GreaterThan)
    .registerSegment(
      'moreThan9Days',
      async () => new ConditionTreeLeaf('numberOfDays', Operator.GreaterThan, 9),
    );

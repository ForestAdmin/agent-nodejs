import { Operator, allOperators } from '../../../src';
import ConditionTreeValidator from '../../../src/validation/condition-tree';
import * as factories from '../../__factories__';

describe('when the field is a date', () => {
  it('should not throw an error when it using the BeforeXHoursAgo operator', () => {
    const conditionTree = factories.conditionTreeLeaf.build({
      operator: 'BeforeXHoursAgo',
      value: 10,
      field: 'aDateField',
    });
    const collection = factories.collection.build({
      schema: factories.collectionSchema.build({
        fields: {
          aDateField: factories.columnSchema.build({
            columnType: 'Date',
            filterOperators: new Set(['BeforeXHoursAgo']),
          }),
        },
      }),
    });

    expect(() => ConditionTreeValidator.validate(conditionTree, collection)).not.toThrow();
  });

  it('should not throw an error when it using the AfterXHoursAgo operator', () => {
    const conditionTree = factories.conditionTreeLeaf.build({
      operator: 'AfterXHoursAgo',
      value: 10,
      field: 'aDateField',
    });
    const collection = factories.collection.build({
      schema: factories.collectionSchema.build({
        fields: {
          aDateField: factories.columnSchema.build({
            columnType: 'Date',
            filterOperators: new Set(['AfterXHoursAgo']),
          }),
        },
      }),
    });

    expect(() => ConditionTreeValidator.validate(conditionTree, collection)).not.toThrow();
  });

  it('should not throw an error when it using the PreviousXDaysToDate operator', () => {
    const conditionTree = factories.conditionTreeLeaf.build({
      operator: 'PreviousXDaysToDate',
      value: 10,
      field: 'aDateField',
    });
    const collection = factories.collection.build({
      schema: factories.collectionSchema.build({
        fields: {
          aDateField: factories.columnSchema.build({
            columnType: 'Date',
            filterOperators: new Set(['PreviousXDaysToDate']),
          }),
        },
      }),
    });

    expect(() => ConditionTreeValidator.validate(conditionTree, collection)).not.toThrow();
  });

  it('should not throw an error when it using the PreviousXDays operator', () => {
    const conditionTree = factories.conditionTreeLeaf.build({
      operator: 'PreviousXDays',
      value: 10,
      field: 'aDateField',
    });
    const collection = factories.collection.build({
      schema: factories.collectionSchema.build({
        fields: {
          aDateField: factories.columnSchema.build({
            columnType: 'Date',
            filterOperators: new Set(['PreviousXDays']),
          }),
        },
      }),
    });

    expect(() => ConditionTreeValidator.validate(conditionTree, collection)).not.toThrow();
  });

  describe('date operators', () => {
    const setupCollectionWithDateColumn = () => {
      return factories.collection.build({
        schema: factories.collectionSchema.build({
          fields: {
            dateField: factories.columnSchema.build({
              columnType: 'Date',
              filterOperators: new Set(allOperators),
            }),
          },
        }),
      });
    };

    describe('when it does not support a value', () => {
      const operators = [
        'Blank',
        'Missing',
        'Present',
        'Yesterday',
        'Today',
        'PreviousQuarter',
        'PreviousYear',
        'PreviousMonth',
        'PreviousWeek',
        'Past',
        'Future',
        'PreviousWeekToDate',
        'PreviousMonthToDate',
        'PreviousQuarterToDate',
        'PreviousYearToDate',
      ];

      test.each(operators)('[%s] should throw an error when a date is given', operator => {
        const collection = setupCollectionWithDateColumn();
        const conditionTree = factories.conditionTreeLeaf.build({
          operator: operator as Operator,
          value: new Date(),
          field: 'dateField',
        });

        expect(() => ConditionTreeValidator.validate(conditionTree, collection)).toThrow();
      });

      test.each(operators)('[%s] should not throw an error when the value is empty', operator => {
        const collection = setupCollectionWithDateColumn();
        const conditionTree = factories.conditionTreeLeaf.build({
          operator: operator as Operator,
          value: null,
          field: 'dateField',
        });

        expect(() => ConditionTreeValidator.validate(conditionTree, collection)).not.toThrow();
      });
    });

    describe('when it support only a number', () => {
      const operators = [
        'PreviousXDays',
        'BeforeXHoursAgo',
        'AfterXHoursAgo',
        'PreviousXDaysToDate',
      ];

      test.each(operators)('[%s] should throw an error when a date is given', operator => {
        const collection = setupCollectionWithDateColumn();
        const conditionTree = factories.conditionTreeLeaf.build({
          operator: operator as Operator,
          value: new Date(),
          field: 'dateField',
        });

        expect(() => ConditionTreeValidator.validate(conditionTree, collection)).toThrow();
      });

      test.each(operators)(
        '[%s] should not throw an error when the value is a number',
        operator => {
          const collection = setupCollectionWithDateColumn();
          const conditionTree = factories.conditionTreeLeaf.build({
            operator: operator as Operator,
            value: 10,
            field: 'dateField',
          });

          expect(() => ConditionTreeValidator.validate(conditionTree, collection)).not.toThrow();
        },
      );
    });
  });
});

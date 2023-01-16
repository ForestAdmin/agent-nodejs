import ConditionTreeValidator from '../../../src/validation/condition-tree';
import * as factories from '../../__factories__';

describe('when the field is a Point', () => {
  const collectionWithEqualOperator = factories.collection.build({
    schema: factories.collectionSchema.build({
      fields: {
        pointField: factories.columnSchema.build({
          columnType: 'Point',
          filterOperators: new Set(['Equal']),
        }),
      },
    }),
  });

  it('should not throw an error when the filter value is well formatted', () => {
    const conditionTree = factories.conditionTreeLeaf.build({
      operator: 'Equal',
      value: '-80,20',
      field: 'pointField',
    });

    expect(() =>
      ConditionTreeValidator.validate(conditionTree, collectionWithEqualOperator),
    ).not.toThrow();
  });

  describe('when the field value is not well formatted', () => {
    it('should throw an error', () => {
      const conditionTree = factories.conditionTreeLeaf.build({
        operator: 'Equal',
        value: '-80, 20, 90',
        field: 'pointField',
      });

      expect(() =>
        ConditionTreeValidator.validate(conditionTree, collectionWithEqualOperator),
      ).toThrow();
    });
  });
});

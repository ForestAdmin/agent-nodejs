import ConditionTreeValidator from '../../../src/validation/condition-tree';
import * as factories from '../../__factories__';

describe('when the field is a JSON', () => {
  const collectionWithInOperator = factories.collection.build({
    schema: factories.collectionSchema.build({
      fields: {
        jsonField: factories.columnSchema.build({
          columnType: 'Json',
          filterOperators: new Set(['In']),
        }),
      },
    }),
  });

  it('should not throw an error when a list of json is given', () => {
    const conditionTree = factories.conditionTreeLeaf.build({
      operator: 'In',
      value: ['item1', 'item2'],
      field: 'jsonField',
    });

    expect(() =>
      ConditionTreeValidator.validate(conditionTree, collectionWithInOperator),
    ).not.toThrow();
  });

  it('should not throw an error when an empty list of json is given', () => {
    const conditionTree = factories.conditionTreeLeaf.build({
      operator: 'In',
      value: [],
      field: 'jsonField',
    });

    expect(() =>
      ConditionTreeValidator.validate(conditionTree, collectionWithInOperator),
    ).not.toThrow();
  });
});

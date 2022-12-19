import ConditionTreeValidator from '../../../src/validation/condition-tree';
import * as factories from '../../__factories__';

describe('when the field is a boolean', () => {
  it('should not throw an error when it using the In operator with an empty array', () => {
    const conditionTree = factories.conditionTreeLeaf.build({
      operator: 'In',
      value: [],
      field: 'aBooleanField',
    });
    const collection = factories.collection.build({
      schema: factories.collectionSchema.build({
        fields: {
          aBooleanField: factories.columnSchema.build({
            columnType: 'Boolean',
            filterOperators: new Set(['In']),
          }),
        },
      }),
    });

    expect(() => ConditionTreeValidator.validate(conditionTree, collection)).not.toThrow();
  });
});

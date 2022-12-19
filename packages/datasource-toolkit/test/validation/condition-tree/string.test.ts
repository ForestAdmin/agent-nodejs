import ConditionTreeValidator from '../../../src/validation/condition-tree';
import * as factories from '../../__factories__';

describe('when the field is a string', () => {
  it('should not throw an error when it using the ShorterThan operator', () => {
    const conditionTree = factories.conditionTreeLeaf.build({
      operator: 'ShorterThan',
      value: 10,
      field: 'aStringField',
    });
    const collection = factories.collection.build({
      schema: factories.collectionSchema.build({
        fields: {
          aStringField: factories.columnSchema.build({
            columnType: 'String',
            filterOperators: new Set(['ShorterThan']),
          }),
        },
      }),
    });

    expect(() => ConditionTreeValidator.validate(conditionTree, collection)).not.toThrow();
  });

  it('should not throw an error when it using the LongerThan operator', () => {
    const conditionTree = factories.conditionTreeLeaf.build({
      operator: 'LongerThan',
      value: 10,
      field: 'aStringField',
    });
    const collection = factories.collection.build({
      schema: factories.collectionSchema.build({
        fields: {
          aStringField: factories.columnSchema.build({
            columnType: 'String',
            filterOperators: new Set(['LongerThan']),
          }),
        },
      }),
    });

    expect(() => ConditionTreeValidator.validate(conditionTree, collection)).not.toThrow();
  });

  it('should not throw an error when it using the In operator with an empty array', () => {
    const conditionTree = factories.conditionTreeLeaf.build({
      operator: 'In',
      value: [],
      field: 'aStringField',
    });
    const collection = factories.collection.build({
      schema: factories.collectionSchema.build({
        fields: {
          aStringField: factories.columnSchema.build({
            columnType: 'String',
            filterOperators: new Set(['In']),
          }),
        },
      }),
    });

    expect(() => ConditionTreeValidator.validate(conditionTree, collection)).not.toThrow();
  });
});

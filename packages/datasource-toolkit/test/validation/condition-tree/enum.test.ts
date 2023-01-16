import ConditionTreeValidator from '../../../src/validation/condition-tree';
import * as factories from '../../__factories__';

describe('when the field is an enum', () => {
  it('should throw an error when the field value is not a valid enum', () => {
    const conditionTree = factories.conditionTreeLeaf.build({
      operator: 'Equal',
      value: 'aRandomValue',
      field: 'enumField',
    });
    const collection = factories.collection.build({
      schema: factories.collectionSchema.build({
        fields: {
          enumField: factories.columnSchema.build({
            columnType: 'Enum',
            enumValues: ['anAllowedValue'],
            filterOperators: new Set(['Equal']),
          }),
        },
      }),
    });

    expect(() => ConditionTreeValidator.validate(conditionTree, collection)).toThrow(
      'The given enum value(s) aRandomValue is not listed in [anAllowedValue]',
    );
  });

  it('should throw an error when the at least one field value is not a valid enum', () => {
    const conditionTree = factories.conditionTreeLeaf.build({
      operator: 'In',
      value: ['allowedValue', 'aRandomValue'],
      field: 'enumField',
    });
    const collection = factories.collection.build({
      schema: factories.collectionSchema.build({
        fields: {
          enumField: factories.columnSchema.build({
            columnType: 'Enum',
            enumValues: ['allowedValue'],
            filterOperators: new Set(['In']),
          }),
        },
      }),
    });

    expect(() => ConditionTreeValidator.validate(conditionTree, collection)).toThrow(
      'The given enum value(s) aRandomValue is not listed in [allowedValue]',
    );
  });

  it('should not throw an error when all enum values are allowed', () => {
    const conditionTree = factories.conditionTreeLeaf.build({
      operator: 'In',
      value: ['allowedValue', 'otherAllowedValue'],
      field: 'enumField',
    });
    const collection = factories.collection.build({
      schema: factories.collectionSchema.build({
        fields: {
          enumField: factories.columnSchema.build({
            columnType: 'Enum',
            enumValues: ['allowedValue', 'otherAllowedValue'],
            filterOperators: new Set(['In']),
          }),
        },
      }),
    });

    expect(() => ConditionTreeValidator.validate(conditionTree, collection)).not.toThrow();
  });

  it('should not throw an error when enum must be present', () => {
    const conditionTree = factories.conditionTreeLeaf.build({
      operator: 'Present',
      field: 'enumField',
    });
    const collection = factories.collection.build({
      schema: factories.collectionSchema.build({
        fields: {
          enumField: factories.columnSchema.build({
            columnType: 'Enum',
            enumValues: ['allowedValue', 'otherAllowedValue'],
            filterOperators: new Set(['Present']),
          }),
        },
      }),
    });

    expect(() => ConditionTreeValidator.validate(conditionTree, collection)).not.toThrow();
  });
});

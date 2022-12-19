import ConditionTreeValidator from '../../../src/validation/condition-tree';
import * as factories from '../../__factories__';

describe('when the field is an UUID', () => {
  const collectionWithInOperator = factories.collection.build({
    schema: factories.collectionSchema.build({
      fields: {
        uuidField: factories.columnSchema.build({
          columnType: 'Uuid',
          filterOperators: new Set(['In']),
        }),
      },
    }),
  });

  it('should not throw an error when a list of uuid is given', () => {
    const conditionTree = factories.conditionTreeLeaf.build({
      operator: 'In',
      value: ['2d162303-78bf-599e-b197-93590ac3d315', '2d162303-78bf-599e-b197-93590ac3d315'],
      field: 'uuidField',
    });

    expect(() =>
      ConditionTreeValidator.validate(conditionTree, collectionWithInOperator),
    ).not.toThrow();
  });

  it('should not throw an error when an empty list of uuid is given', () => {
    const conditionTree = factories.conditionTreeLeaf.build({
      operator: 'In',
      value: [],
      field: 'uuidField',
    });

    expect(() =>
      ConditionTreeValidator.validate(conditionTree, collectionWithInOperator),
    ).not.toThrow();
  });

  it('should throw an error when at least one uuid is malformed', () => {
    const conditionTree = factories.conditionTreeLeaf.build({
      operator: 'In',
      value: [
        '2d162303-78bf-599e-b197-93590ac3d315',
        'malformed-2d162303-78bf-599e-b197-93590ac3d315',
      ],
      field: 'uuidField',
    });

    expect(() =>
      ConditionTreeValidator.validate(conditionTree, collectionWithInOperator),
    ).toThrow();
  });
});

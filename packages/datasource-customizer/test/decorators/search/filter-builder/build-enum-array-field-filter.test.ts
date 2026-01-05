import type { ColumnSchema } from '@forestadmin/datasource-toolkit';

import { ConditionTreeFactory, ConditionTreeLeaf } from '@forestadmin/datasource-toolkit';

import buildBasicArrayFieldFilter from '../../../../src/decorators/search/filter-builder/build-basic-array-field-filter';
import buildEnumArrayFieldFilter from '../../../../src/decorators/search/filter-builder/build-enum-array-field-filter';

jest.mock('../../../../src/decorators/search/filter-builder/build-basic-array-field-filter');

describe('buildEnumArrayFieldFilter', () => {
  const schema: ColumnSchema = {
    columnType: ['Enum'],
    enumValues: ['foo', 'bar'],
    filterOperators: new Set(['In']),
    type: 'Column',
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('when the value can be mapped to an enum value', () => {
    it.each(['foo', 'FOO', ' foo '])(
      'should delegate to the basic array builder for the value "%s"',
      value => {
        const expectedResult = new ConditionTreeLeaf('field', 'In', 'foo');

        jest.mocked(buildBasicArrayFieldFilter).mockReturnValue(expectedResult);

        const result = buildEnumArrayFieldFilter('field', schema, value, false);

        expect(buildBasicArrayFieldFilter).toHaveBeenCalledWith(
          'field',
          schema.filterOperators,
          'foo',
          false,
        );
        expect(result).toBe(expectedResult);
      },
    );
  });

  describe('when the value cannot be mapped to an enum value', () => {
    describe('when not negated', () => {
      it('should return a match none condition tree', () => {
        const result = buildEnumArrayFieldFilter('field', schema, 'baz', false);

        expect(result).toEqual(ConditionTreeFactory.MatchNone);
      });
    });

    describe('when negated', () => {
      it('should return a match all condition tree', () => {
        const result = buildEnumArrayFieldFilter('field', schema, 'baz', true);

        expect(result).toEqual(ConditionTreeFactory.MatchAll);
      });
    });
  });
});

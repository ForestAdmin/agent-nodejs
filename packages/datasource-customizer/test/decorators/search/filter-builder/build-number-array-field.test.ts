import type { Operator } from '@forestadmin/datasource-toolkit';

import { ConditionTreeFactory, ConditionTreeLeaf } from '@forestadmin/datasource-toolkit';

import buildBasicArrayFieldFilter from '../../../../src/decorators/search/filter-builder/build-basic-array-field-filter';
import buildNumberArrayFieldFilter from '../../../../src/decorators/search/filter-builder/build-number-array-field-filter';

jest.mock('../../../../src/decorators/search/filter-builder/build-basic-array-field-filter');

describe('buildNumberArrayFieldFilter', () => {
  const operators = new Set<Operator>(['In']);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('when the value is a valid number', () => {
    const searchValue = '42';

    it('should delegate to the basic array builder', () => {
      const expectedResult = new ConditionTreeLeaf('field', 'In', 42);

      jest.mocked(buildBasicArrayFieldFilter).mockReturnValue(expectedResult);

      const result = buildNumberArrayFieldFilter('field', operators, searchValue, false);

      expect(buildBasicArrayFieldFilter).toHaveBeenCalledWith('field', operators, 42, false);
      expect(result).toBe(expectedResult);
    });
  });

  describe('when the value is not a number', () => {
    const searchValue = 'not a number';

    describe('when not negated', () => {
      it('should return a match none condition tree', () => {
        const result = buildNumberArrayFieldFilter('field', operators, searchValue, false);

        expect(result).toEqual(ConditionTreeFactory.MatchNone);
      });
    });

    describe('when negated', () => {
      it('should return a match all condition tree', () => {
        const result = buildNumberArrayFieldFilter('field', operators, searchValue, true);

        expect(result).toEqual(ConditionTreeFactory.MatchAll);
      });
    });
  });
});

import type { Operator } from '@forestadmin/datasource-toolkit';

import { ConditionTreeFactory, ConditionTreeLeaf } from '@forestadmin/datasource-toolkit';

import buildBasicArrayFieldFilter from '../../../../src/decorators/search/filter-builder/build-basic-array-field-filter';

describe('buildBasicArrayFieldFilter', () => {
  describe('when not negated', () => {
    const isNegated = false;

    it('should return a ConditionTreeLeaf with IncludesAll operator', () => {
      const expectedResult = new ConditionTreeLeaf('field', 'IncludesAll', 'value');

      const result = buildBasicArrayFieldFilter(
        'field',
        new Set(['IncludesAll']),
        'value',
        isNegated,
      );

      expect(result).toEqual(expectedResult);
    });

    it('should return match-none if no IncludesAll operator', () => {
      const result = buildBasicArrayFieldFilter('field', new Set(), 'value', isNegated);

      expect(result).toEqual(ConditionTreeFactory.MatchNone);
    });
  });

  describe('when negated', () => {
    const isNegated = true;

    describe('when all operators are present', () => {
      const operators = new Set<Operator>(['IncludesNone', 'Missing']);

      it('should return a ConditionTreeLeaf with IncludesNone operator', () => {
        const result = buildBasicArrayFieldFilter('field', operators, 'value', isNegated);

        expect(result).toEqual(
          ConditionTreeFactory.union(
            new ConditionTreeLeaf('field', 'IncludesNone', 'value'),
            new ConditionTreeLeaf('field', 'Missing'),
          ),
        );
      });
    });

    describe('when only the IncludesNone operator is present', () => {
      const operators = new Set<Operator>(['IncludesNone']);

      it('should return a ConditionTreeLeaf with IncludesNone operator', () => {
        const expectedResult = new ConditionTreeLeaf('field', 'IncludesNone', 'value');

        const result = buildBasicArrayFieldFilter('field', operators, 'value', isNegated);

        expect(result).toEqual(expectedResult);
      });
    });

    describe('when IncludesNone operator is not present', () => {
      const operators = new Set<Operator>(['Missing']);

      it('should return match-all', () => {
        const result = buildBasicArrayFieldFilter('field', operators, 'value', isNegated);

        expect(result).toEqual(ConditionTreeFactory.MatchAll);
      });
    });
  });
});

import {
  ConditionTreeBranch,
  ConditionTreeFactory,
  ConditionTreeLeaf,
} from '@forestadmin/datasource-toolkit';

import buildBooleanFieldFilter from '../../../../src/decorators/search/filter-builder/build-boolean-field-filter';

describe('buildBooleanFieldFilter', () => {
  describe('if the field has the needed operator(s)', () => {
    describe('When isNegated is false', () => {
      it.each([
        ['true', true],
        ['1', true],
        ['TRUE', true],
        ['false', false],
        ['0', false],
        ['FALSE', false],
      ])(
        'should return a condition for the search string %s with the value %s',
        (searchString, expectedValue) => {
          const result = buildBooleanFieldFilter(
            'fieldName',
            new Set(['Equal']),
            searchString,
            false,
          );

          expect(result).toEqual(new ConditionTreeLeaf('fieldName', 'Equal', expectedValue));
        },
      );

      it('should return a match-none if the value is not recognized', () => {
        const result = buildBooleanFieldFilter('fieldName', new Set(['Equal']), 'FOO', false);

        expect(result).toEqual(ConditionTreeFactory.MatchNone);
      });
    });

    describe('When isNegated is true', () => {
      it.each([
        ['true', true],
        ['1', true],
        ['TRUE', true],
        ['false', false],
        ['0', false],
        ['FALSE', false],
      ])(
        'should construct the right condition for the search string %s',
        (searchString, expectedValue) => {
          const result = buildBooleanFieldFilter(
            'fieldName',
            new Set(['NotEqual', 'Missing']),
            searchString,
            true,
          );

          expect(result).toBeInstanceOf(ConditionTreeBranch);
          expect((result as ConditionTreeBranch).aggregator).toBe('Or');
          expect((result as ConditionTreeBranch).conditions).toEqual([
            new ConditionTreeLeaf('fieldName', 'NotEqual', expectedValue),
            new ConditionTreeLeaf('fieldName', 'Missing', null),
          ]);
        },
      );
    });

    it('should return a match-all if the value is not recognized', () => {
      const result = buildBooleanFieldFilter('fieldName', new Set(['Equal']), 'FOO', true);

      expect(result).toEqual(ConditionTreeFactory.MatchAll);
    });
  });

  describe('if the field does not have the needed operator(s)', () => {
    describe('when isNegated = false', () => {
      it('should return a match-none', () => {
        const result = buildBooleanFieldFilter('fieldName', new Set([]), 'true', false);

        expect(result).toEqual(ConditionTreeFactory.MatchNone);
      });
    });

    describe('when isNegated = true', () => {
      it('should return a match-all if the field does not have the Equal operator', () => {
        const result = buildBooleanFieldFilter('fieldName', new Set(['Missing']), 'true', true);

        expect(result).toEqual(ConditionTreeFactory.MatchAll);
      });

      it('should return a match-all if the field does not have the Missing operator', () => {
        const result = buildBooleanFieldFilter('fieldName', new Set(['Equal']), 'true', true);

        expect(result).toEqual(ConditionTreeFactory.MatchAll);
      });
    });
  });
});

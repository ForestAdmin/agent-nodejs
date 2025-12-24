import type { Operator } from '@forestadmin/datasource-toolkit';

import { ConditionTreeFactory, ConditionTreeLeaf } from '@forestadmin/datasource-toolkit';

import buildUuidFieldFilter from '../../../../src/decorators/search/filter-builder/build-uuid-field-filter';

describe('buildUuidfieldFilter', () => {
  describe('when the value is a valid uuid', () => {
    const value = '123e4567-e89b-12d3-a456-426614174000';
    const allOperators = new Set<Operator>(['Equal', 'NotEqual', 'Missing']);

    describe('when not negated', () => {
      const isNegated = false;

      it('should return a condition tree with Equal if the operator is present', () => {
        const result = buildUuidFieldFilter('fieldName', allOperators, value, isNegated);

        expect(result).toEqual(new ConditionTreeLeaf('fieldName', 'Equal', value));
      });

      it('should return match-none if the operator is not present', () => {
        const result = buildUuidFieldFilter('fieldName', new Set(), value, isNegated);

        expect(result).toEqual(ConditionTreeFactory.MatchNone);
      });
    });

    describe('when negated', () => {
      const isNegated = true;

      describe('when all operators are present', () => {
        it('should return a condition tree with NotEqual and Missing', () => {
          const result = buildUuidFieldFilter('fieldName', allOperators, value, isNegated);

          expect(result).toEqual(
            ConditionTreeFactory.union(
              new ConditionTreeLeaf('fieldName', 'NotEqual', value),
              new ConditionTreeLeaf('fieldName', 'Missing'),
            ),
          );
        });
      });

      describe('when missing is not present', () => {
        it('should return a condition tree with NotEqual', () => {
          const result = buildUuidFieldFilter(
            'fieldName',
            new Set(['Equal', 'NotEqual']),
            value,
            isNegated,
          );

          expect(result).toEqual(new ConditionTreeLeaf('fieldName', 'NotEqual', value));
        });
      });

      describe('when not equal is not present', () => {
        it('should return a match all', () => {
          const result = buildUuidFieldFilter(
            'fieldName',
            new Set(['Equal', 'Missing']),
            value,
            isNegated,
          );

          expect(result).toEqual(ConditionTreeFactory.MatchAll);
        });
      });
    });
  });

  describe('when the value is not a valid uuid', () => {
    const value = 'not-a-uuid';
    const allOperators = new Set<Operator>(['Equal', 'NotEqual', 'Missing']);

    describe('when not negated', () => {
      const isNegated = false;

      it('should return match-none', () => {
        const result = buildUuidFieldFilter('fieldName', allOperators, value, isNegated);

        expect(result).toEqual(ConditionTreeFactory.MatchNone);
      });
    });

    describe('when negated', () => {
      const isNegated = true;

      it('should return match-all', () => {
        const result = buildUuidFieldFilter('fieldName', allOperators, value, isNegated);

        expect(result).toEqual(ConditionTreeFactory.MatchAll);
      });
    });
  });
});

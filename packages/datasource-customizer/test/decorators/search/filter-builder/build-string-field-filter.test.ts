import type { Operator } from '@forestadmin/datasource-toolkit';

import { ConditionTreeFactory, ConditionTreeLeaf } from '@forestadmin/datasource-toolkit';

import buildStringFieldFilter from '../../../../src/decorators/search/filter-builder/build-string-field-filter';

describe('buildStringFieldFilter', () => {
  describe('when all major operators are supported', () => {
    const operators = new Set<Operator>([
      'IContains',
      'NotIContains',
      'Contains',
      'NotContains',
      'Equal',
      'NotEqual',
      'Missing',
    ]);

    describe('when not negated', () => {
      const isNegated = false;

      it('should return a condition tree with IContains', () => {
        const result = buildStringFieldFilter('fieldName', operators, 'Foo', isNegated);

        expect(result).toEqual(new ConditionTreeLeaf('fieldName', 'IContains', 'Foo'));
      });

      it('should generate a Equal condition tree when the search string is empty', () => {
        const result = buildStringFieldFilter('fieldName', operators, '', isNegated);

        expect(result).toEqual(new ConditionTreeLeaf('fieldName', 'Equal', ''));
      });
    });

    describe('when negated', () => {
      const isNegated = true;

      describe('when Missing is supported', () => {
        it('should return a condition tree with NotIContains and Missing', () => {
          const result = buildStringFieldFilter('fieldName', operators, 'Foo', isNegated);

          expect(result).toEqual(
            ConditionTreeFactory.union(
              new ConditionTreeLeaf('fieldName', 'NotIContains', 'Foo'),
              new ConditionTreeLeaf('fieldName', 'Missing'),
            ),
          );
        });

        it('should generate a NotEqual condition tree when the search string is empty', () => {
          const result = buildStringFieldFilter('fieldName', operators, '', isNegated);

          expect(result).toEqual(
            ConditionTreeFactory.union(
              new ConditionTreeLeaf('fieldName', 'NotEqual', ''),
              new ConditionTreeLeaf('fieldName', 'Missing'),
            ),
          );
        });
      });

      describe('when Missing is not supported', () => {
        it('should return a condition tree with only NotIContains', () => {
          const result = buildStringFieldFilter(
            'fieldName',
            new Set(Array.from(operators).filter(o => o !== 'Missing')),
            'Foo',
            isNegated,
          );

          expect(result).toEqual(new ConditionTreeLeaf('fieldName', 'NotIContains', 'Foo'));
        });

        it('should generate a NotEqual condition tree when the search string is empty', () => {
          const result = buildStringFieldFilter(
            'fieldName',
            new Set(Array.from(operators).filter(o => o !== 'Missing')),
            '',
            isNegated,
          );

          expect(result).toEqual(new ConditionTreeLeaf('fieldName', 'NotEqual', ''));
        });
      });
    });
  });

  describe('when IContains/NotIContains are not supported but the others are', () => {
    const operators = new Set<Operator>([
      'Contains',
      'NotContains',
      'Equal',
      'NotEqual',
      'Missing',
    ]);

    describe('when not negated', () => {
      const isNegated = false;

      it('should return a condition tree with Contains', () => {
        const result = buildStringFieldFilter('fieldName', operators, 'Foo', isNegated);

        expect(result).toEqual(new ConditionTreeLeaf('fieldName', 'Contains', 'Foo'));
      });
    });

    describe('when negated', () => {
      const isNegated = true;

      describe('when Missing is supported', () => {
        it('should return a condition tree with NotContains and Missing', () => {
          const result = buildStringFieldFilter('fieldName', operators, 'Foo', isNegated);

          expect(result).toEqual(
            ConditionTreeFactory.union(
              new ConditionTreeLeaf('fieldName', 'NotContains', 'Foo'),
              new ConditionTreeLeaf('fieldName', 'Missing'),
            ),
          );
        });
      });

      describe('when Missing is not supported', () => {
        it('should return a condition tree with only NotContains', () => {
          const result = buildStringFieldFilter(
            'fieldName',
            new Set(Array.from(operators).filter(o => o !== 'Missing')),
            'Foo',
            isNegated,
          );

          expect(result).toEqual(new ConditionTreeLeaf('fieldName', 'NotContains', 'Foo'));
        });
      });
    });
  });

  describe('when only Equal/NotEqual are supported', () => {
    const operators = new Set<Operator>(['Equal', 'NotEqual', 'Missing']);

    describe('when not negated', () => {
      const isNegated = false;

      it('should return a condition tree with Equal', () => {
        const result = buildStringFieldFilter('fieldName', operators, 'Foo', isNegated);

        expect(result).toEqual(new ConditionTreeLeaf('fieldName', 'Equal', 'Foo'));
      });
    });

    describe('when negated', () => {
      const isNegated = true;

      describe('when Missing is supported', () => {
        it('should return a condition tree with NotEqual and Missing', () => {
          const result = buildStringFieldFilter('fieldName', operators, 'Foo', isNegated);

          expect(result).toEqual(
            ConditionTreeFactory.union(
              new ConditionTreeLeaf('fieldName', 'NotEqual', 'Foo'),
              new ConditionTreeLeaf('fieldName', 'Missing'),
            ),
          );
        });
      });

      describe('when Missing is not supported', () => {
        it('should return a condition tree with only NotEqual', () => {
          const result = buildStringFieldFilter(
            'fieldName',
            new Set(Array.from(operators).filter(o => o !== 'Missing')),
            'Foo',
            isNegated,
          );

          expect(result).toEqual(new ConditionTreeLeaf('fieldName', 'NotEqual', 'Foo'));
        });
      });
    });
  });

  describe('when operators are not supported', () => {
    const operators: Set<Operator> = new Set();

    describe('when not negated', () => {
      const isNegated = false;

      it('should generate a match-none', () => {
        const result = buildStringFieldFilter('fieldName', operators, 'Foo', isNegated);

        expect(result).toEqual(ConditionTreeFactory.MatchNone);
      });

      it('should generate a match-none when the search string is empty', () => {
        const result = buildStringFieldFilter('fieldName', operators, '', isNegated);

        expect(result).toEqual(ConditionTreeFactory.MatchNone);
      });
    });

    describe('when negated', () => {
      const isNegated = true;

      it('should generate a match-all', () => {
        const result = buildStringFieldFilter('fieldName', operators, 'Foo', isNegated);

        expect(result).toEqual(ConditionTreeFactory.MatchAll);
      });

      it('should generate a match-all when the search string is empty', () => {
        const result = buildStringFieldFilter('fieldName', operators, '', isNegated);

        expect(result).toEqual(ConditionTreeFactory.MatchAll);
      });
    });
  });
});

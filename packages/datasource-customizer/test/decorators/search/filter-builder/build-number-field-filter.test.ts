import type { Operator } from '@forestadmin/datasource-toolkit';

import {
  ConditionTreeFactory,
  ConditionTreeLeaf,
  allOperators,
} from '@forestadmin/datasource-toolkit';

import buildNumberFieldFilter from '../../../../src/decorators/search/filter-builder/build-number-field-filter';

describe('buildNumberFieldFilter', () => {
  describe('when the search string is valid', () => {
    describe.each(['', '='])('Equal with prefix "%s"', prefix => {
      const searchString = `${prefix}42`;

      describe('when not negated', () => {
        const isNegated = false;

        describe('when the operator Equal is present', () => {
          const operators = new Set<Operator>(['Equal']);

          it('should return a valid condition tree', () => {
            const result = buildNumberFieldFilter('fieldName', operators, searchString, isNegated);

            expect(result).toEqual(new ConditionTreeLeaf('fieldName', 'Equal', 42));
          });
        });

        describe('when the operator Equal is not present', () => {
          const operators = new Set<Operator>([]);

          it('should return a match-none', () => {
            const result = buildNumberFieldFilter('fieldName', operators, searchString, isNegated);

            expect(result).toEqual(ConditionTreeFactory.MatchNone);
          });
        });
      });

      describe('when negated', () => {
        const isNegated = true;

        describe('when operators NotEqual and Missing are present', () => {
          const operators = new Set<Operator>(['NotEqual', 'Missing']);

          it('should return a valid condition tree', () => {
            const result = buildNumberFieldFilter('fieldName', operators, searchString, isNegated);

            expect(result).toEqual(
              ConditionTreeFactory.union(
                new ConditionTreeLeaf('fieldName', 'NotEqual', 42),
                new ConditionTreeLeaf('fieldName', 'Missing'),
              ),
            );
          });
        });

        describe('when only the operator NotEqual is present', () => {
          const operators = new Set<Operator>(['NotEqual']);

          it('should return a valid condition tree', () => {
            const result = buildNumberFieldFilter('fieldName', operators, searchString, isNegated);

            expect(result).toEqual(new ConditionTreeLeaf('fieldName', 'NotEqual', 42));
          });
        });

        describe('when operators are absent', () => {
          const operators = new Set<Operator>([]);

          it('should return a match-all', () => {
            const result = buildNumberFieldFilter('fieldName', operators, searchString, isNegated);

            expect(result).toEqual(ConditionTreeFactory.MatchAll);
          });
        });
      });
    });

    describe('LessThan', () => {
      const searchString = `<42`;

      describe('when not negated', () => {
        const isNegated = false;

        describe('when the operator LessThan is present', () => {
          const operators = new Set<Operator>(['LessThan']);

          it('should return a valid condition tree', () => {
            const result = buildNumberFieldFilter('fieldName', operators, searchString, isNegated);

            expect(result).toEqual(new ConditionTreeLeaf('fieldName', 'LessThan', 42));
          });
        });

        describe('when the operator LessThan is not present', () => {
          const operators = new Set<Operator>([]);

          it('should return a match-none', () => {
            const result = buildNumberFieldFilter('fieldName', operators, searchString, isNegated);

            expect(result).toEqual(ConditionTreeFactory.MatchNone);
          });
        });
      });

      describe('when negated', () => {
        const isNegated = true;

        describe('when operators GreaterThan, Equal and Missing are present', () => {
          const operators = new Set<Operator>(['GreaterThan', 'Equal', 'Missing']);

          it('should return a valid condition tree', () => {
            const result = buildNumberFieldFilter('fieldName', operators, searchString, isNegated);

            expect(result).toEqual(
              ConditionTreeFactory.union(
                new ConditionTreeLeaf('fieldName', 'GreaterThan', 42),
                new ConditionTreeLeaf('fieldName', 'Equal', 42),
                new ConditionTreeLeaf('fieldName', 'Missing'),
              ),
            );
          });
        });

        describe('when only the operator GreaterThan and Equal are present', () => {
          const operators = new Set<Operator>(['GreaterThan', 'Equal']);

          it('should return a valid condition tree', () => {
            const result = buildNumberFieldFilter('fieldName', operators, searchString, isNegated);

            expect(result).toEqual(
              ConditionTreeFactory.union(
                new ConditionTreeLeaf('fieldName', 'GreaterThan', 42),
                new ConditionTreeLeaf('fieldName', 'Equal', 42),
              ),
            );
          });
        });

        describe.each(['Equal', 'GreaterThan'])(
          'when the operator %s is absent',
          missingOperator => {
            const operators = new Set<Operator>(
              (['Equal', 'GreaterThan', 'Missing'] as Operator[]).filter(
                o => o !== missingOperator,
              ),
            );

            it('should return a match-all', () => {
              const result = buildNumberFieldFilter(
                'fieldName',
                operators,
                searchString,
                isNegated,
              );

              expect(result).toEqual(ConditionTreeFactory.MatchAll);
            });
          },
        );
      });
    });

    describe('GreaterThan', () => {
      const searchString = `>42`;

      describe('when not negated', () => {
        const isNegated = false;

        describe('when the operator GreaterThan is present', () => {
          const operators = new Set<Operator>(['GreaterThan']);

          it('should return a valid condition tree', () => {
            const result = buildNumberFieldFilter('fieldName', operators, searchString, isNegated);

            expect(result).toEqual(new ConditionTreeLeaf('fieldName', 'GreaterThan', 42));
          });
        });

        describe('when the operator GreaterThan is not present', () => {
          const operators = new Set<Operator>([]);

          it('should return a match-none', () => {
            const result = buildNumberFieldFilter('fieldName', operators, searchString, isNegated);

            expect(result).toEqual(ConditionTreeFactory.MatchNone);
          });
        });
      });

      describe('when negated', () => {
        const isNegated = true;

        describe('when operators LessThan, Equal and Missing are present', () => {
          const operators = new Set<Operator>(['LessThan', 'Equal', 'Missing']);

          it('should return a valid condition tree', () => {
            const result = buildNumberFieldFilter('fieldName', operators, searchString, isNegated);

            expect(result).toEqual(
              ConditionTreeFactory.union(
                new ConditionTreeLeaf('fieldName', 'LessThan', 42),
                new ConditionTreeLeaf('fieldName', 'Equal', 42),
                new ConditionTreeLeaf('fieldName', 'Missing'),
              ),
            );
          });
        });

        describe('when only the operator LessThan and Equal are present', () => {
          const operators = new Set<Operator>(['LessThan', 'Equal']);

          it('should return a valid condition tree', () => {
            const result = buildNumberFieldFilter('fieldName', operators, searchString, isNegated);

            expect(result).toEqual(
              ConditionTreeFactory.union(
                new ConditionTreeLeaf('fieldName', 'LessThan', 42),
                new ConditionTreeLeaf('fieldName', 'Equal', 42),
              ),
            );
          });
        });

        describe.each(['Equal', 'LessThan'])('when the operator %s is absent', missingOperator => {
          const operators = new Set<Operator>(
            (['Equal', 'LessThan', 'Missing'] as Operator[]).filter(o => o !== missingOperator),
          );

          it('should return a match-all', () => {
            const result = buildNumberFieldFilter('fieldName', operators, searchString, isNegated);

            expect(result).toEqual(ConditionTreeFactory.MatchAll);
          });
        });
      });
    });

    describe.each(['<=', '≤'])('LessThanOrEqual with prefix "%s"', prefix => {
      const searchString = `${prefix}42`;

      describe('when not negated', () => {
        const isNegated = false;

        describe('when the operators LessThan and Equal are present', () => {
          const operators = new Set<Operator>(['LessThan', 'Equal']);

          it('should return a valid condition tree', () => {
            const result = buildNumberFieldFilter('fieldName', operators, searchString, isNegated);

            expect(result).toEqual(
              ConditionTreeFactory.union(
                new ConditionTreeLeaf('fieldName', 'LessThan', 42),
                new ConditionTreeLeaf('fieldName', 'Equal', 42),
              ),
            );
          });
        });

        describe.each(['LessThan', 'Equal'])(
          'when the operator %s is not present',
          missingOperator => {
            const operators = new Set<Operator>(
              ['LessThan', 'Equal'].filter(o => o !== missingOperator) as Operator[],
            );

            it('should return a match-none', () => {
              const result = buildNumberFieldFilter(
                'fieldName',
                operators,
                searchString,
                isNegated,
              );

              expect(result).toEqual(ConditionTreeFactory.MatchNone);
            });
          },
        );
      });

      describe('when negated', () => {
        const isNegated = true;

        describe('when operators GreaterThan and Missing are present', () => {
          const operators = new Set<Operator>(['GreaterThan', 'Missing']);

          it('should return a valid condition tree', () => {
            const result = buildNumberFieldFilter('fieldName', operators, searchString, isNegated);

            expect(result).toEqual(
              ConditionTreeFactory.union(
                new ConditionTreeLeaf('fieldName', 'GreaterThan', 42),
                new ConditionTreeLeaf('fieldName', 'Missing'),
              ),
            );
          });
        });

        describe('when only the operator GreaterThan is present', () => {
          const operators = new Set<Operator>(['GreaterThan']);

          it('should return a valid condition tree', () => {
            const result = buildNumberFieldFilter('fieldName', operators, searchString, isNegated);

            expect(result).toEqual(new ConditionTreeLeaf('fieldName', 'GreaterThan', 42));
          });
        });

        describe('when GreaterThan is absent', () => {
          const operators = new Set<Operator>(['Missing']);

          it('should return a match-all', () => {
            const result = buildNumberFieldFilter('fieldName', operators, searchString, isNegated);

            expect(result).toEqual(ConditionTreeFactory.MatchAll);
          });
        });
      });
    });

    describe.each(['>=', '≥'])('GreaterThanOrEqual with prefix "%s"', prefix => {
      const searchString = `${prefix}42`;

      describe('when not negated', () => {
        const isNegated = false;

        describe('when the operators GreaterThan and Equal are present', () => {
          const operators = new Set<Operator>(['GreaterThan', 'Equal']);

          it('should return a valid condition tree', () => {
            const result = buildNumberFieldFilter('fieldName', operators, searchString, isNegated);

            expect(result).toEqual(
              ConditionTreeFactory.union(
                new ConditionTreeLeaf('fieldName', 'GreaterThan', 42),
                new ConditionTreeLeaf('fieldName', 'Equal', 42),
              ),
            );
          });
        });

        describe.each(['LessThan', 'Equal'])(
          'when the operator %s is not present',
          missingOperator => {
            const operators = new Set<Operator>(
              ['LessThan', 'Equal'].filter(o => o !== missingOperator) as Operator[],
            );

            it('should return a match-none', () => {
              const result = buildNumberFieldFilter(
                'fieldName',
                operators,
                searchString,
                isNegated,
              );

              expect(result).toEqual(ConditionTreeFactory.MatchNone);
            });
          },
        );
      });

      describe('when negated', () => {
        const isNegated = true;

        describe('when operators LessThan and Missing are present', () => {
          const operators = new Set<Operator>(['LessThan', 'Missing']);

          it('should return a valid condition tree', () => {
            const result = buildNumberFieldFilter('fieldName', operators, searchString, isNegated);

            expect(result).toEqual(
              ConditionTreeFactory.union(
                new ConditionTreeLeaf('fieldName', 'LessThan', 42),
                new ConditionTreeLeaf('fieldName', 'Missing'),
              ),
            );
          });
        });

        describe('when only the operator LessThan is present', () => {
          const operators = new Set<Operator>(['LessThan']);

          it('should return a valid condition tree', () => {
            const result = buildNumberFieldFilter('fieldName', operators, searchString, isNegated);

            expect(result).toEqual(new ConditionTreeLeaf('fieldName', 'LessThan', 42));
          });
        });

        describe('when LessThan is absent', () => {
          const operators = new Set<Operator>(['Missing']);

          it('should return a match-all', () => {
            const result = buildNumberFieldFilter('fieldName', operators, searchString, isNegated);

            expect(result).toEqual(ConditionTreeFactory.MatchAll);
          });
        });
      });
    });
  });

  describe('when the search string is invalid', () => {
    const searchString = 'Not a number';

    describe('when negated', () => {
      const isNegated = true;

      it('should return match-all', () => {
        const result = buildNumberFieldFilter(
          'fieldName',
          new Set(allOperators),
          searchString,
          isNegated,
        );

        expect(result).toEqual(ConditionTreeFactory.MatchAll);
      });
    });

    describe('when not negated', () => {
      const isNegated = false;

      it('should return match-none', () => {
        const result = buildNumberFieldFilter(
          'fieldName',
          new Set(allOperators),
          searchString,
          isNegated,
        );

        expect(result).toEqual(ConditionTreeFactory.MatchNone);
      });
    });
  });
});

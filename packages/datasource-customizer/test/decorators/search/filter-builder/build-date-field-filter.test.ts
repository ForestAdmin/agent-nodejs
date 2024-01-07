import {
  ConditionTreeFactory,
  ConditionTreeLeaf,
  Operator,
  allOperators,
} from '@forestadmin/datasource-toolkit';

import buildDateFieldFilter from '../../../../src/decorators/search/filter-builder/build-date-field-filter';

describe('buildDateFieldFilter', () => {
  describe('without an operator', () => {
    describe('when not negated', () => {
      const isNegated = false;
      const operators: Operator[] = ['Equal', 'After', 'Before'];

      describe('when the search string is a date', () => {
        it('should return a valid condition if the date is < 10', () => {
          const result = buildDateFieldFilter(
            'fieldName',
            new Set(operators),
            '2022-05-04',
            isNegated,
          );

          expect(result).toEqual(
            ConditionTreeFactory.intersect(
              ConditionTreeFactory.union(
                new ConditionTreeLeaf('fieldName', 'Equal', '2022-05-04'),
                new ConditionTreeLeaf('fieldName', 'After', '2022-05-04'),
              ),
              new ConditionTreeLeaf('fieldName', 'Before', '2022-05-05'),
            ),
          );
        });

        it('should return a valid condition if the date is >= 10', () => {
          const result = buildDateFieldFilter(
            'fieldName',
            new Set(operators),
            '2022-05-10',
            isNegated,
          );

          expect(result).toEqual(
            ConditionTreeFactory.intersect(
              ConditionTreeFactory.union(
                new ConditionTreeLeaf('fieldName', 'Equal', '2022-05-10'),
                new ConditionTreeLeaf('fieldName', 'After', '2022-05-10'),
              ),
              new ConditionTreeLeaf('fieldName', 'Before', '2022-05-11'),
            ),
          );
        });

        it('should return a valid condition if the date the last day of the year', () => {
          const result = buildDateFieldFilter(
            'fieldName',
            new Set(operators),
            '2022-12-31',
            isNegated,
          );

          expect(result).toEqual(
            ConditionTreeFactory.intersect(
              ConditionTreeFactory.union(
                new ConditionTreeLeaf('fieldName', 'Equal', '2022-12-31'),
                new ConditionTreeLeaf('fieldName', 'After', '2022-12-31'),
              ),
              new ConditionTreeLeaf('fieldName', 'Before', '2023-01-01'),
            ),
          );
        });
      });

      describe('when the search string contains only a year and month', () => {
        it('should return a valid condition when the month is < 10', () => {
          const result = buildDateFieldFilter(
            'fieldName',
            new Set(operators),
            '2022-05',
            isNegated,
          );

          expect(result).toEqual(
            ConditionTreeFactory.intersect(
              ConditionTreeFactory.union(
                new ConditionTreeLeaf('fieldName', 'Equal', '2022-05-01'),
                new ConditionTreeLeaf('fieldName', 'After', '2022-05-01'),
              ),
              new ConditionTreeLeaf('fieldName', 'Before', '2022-06-01'),
            ),
          );
        });

        it('should return a valid condition when the month is >= 10', () => {
          const result = buildDateFieldFilter(
            'fieldName',
            new Set(operators),
            '2022-10',
            isNegated,
          );

          expect(result).toEqual(
            ConditionTreeFactory.intersect(
              ConditionTreeFactory.union(
                new ConditionTreeLeaf('fieldName', 'Equal', '2022-10-01'),
                new ConditionTreeLeaf('fieldName', 'After', '2022-10-01'),
              ),
              new ConditionTreeLeaf('fieldName', 'Before', '2022-11-01'),
            ),
          );
        });

        it('should return a valid condition when the month is december', () => {
          const result = buildDateFieldFilter(
            'fieldName',
            new Set(operators),
            '2022-12',
            isNegated,
          );

          expect(result).toEqual(
            ConditionTreeFactory.intersect(
              ConditionTreeFactory.union(
                new ConditionTreeLeaf('fieldName', 'Equal', '2022-12-01'),
                new ConditionTreeLeaf('fieldName', 'After', '2022-12-01'),
              ),
              new ConditionTreeLeaf('fieldName', 'Before', '2023-01-01'),
            ),
          );
        });
      });

      describe('when the search string contains only a year', () => {
        it('should return a valid condition', () => {
          const result = buildDateFieldFilter('fieldName', new Set(operators), '2022', isNegated);

          expect(result).toEqual(
            ConditionTreeFactory.intersect(
              ConditionTreeFactory.union(
                new ConditionTreeLeaf('fieldName', 'Equal', '2022-01-01'),
                new ConditionTreeLeaf('fieldName', 'After', '2022-01-01'),
              ),
              new ConditionTreeLeaf('fieldName', 'Before', '2023-01-01'),
            ),
          );
        });
      });

      it.each(['123', '1799', 'foo'])(
        'should return match-none when the search string is %s',
        searchString => {
          const result = buildDateFieldFilter(
            'fieldName',
            new Set(operators),
            searchString,
            isNegated,
          );

          expect(result).toEqual(ConditionTreeFactory.MatchNone);
        },
      );

      it.each(operators)('should return match-none if the operator %s is missing', operator => {
        const result = buildDateFieldFilter(
          'fieldName',
          new Set<Operator>(operators.filter(x => x !== operator) as Operator[]),
          '2022-01-01',
          isNegated,
        );

        expect(result).toEqual(ConditionTreeFactory.MatchNone);
      });
    });

    describe('when negated', () => {
      const isNegated = true;
      const operators: Operator[] = ['Equal', 'After', 'Before', 'Missing'];

      describe('when the search string is a date', () => {
        it('should return a valid condition if the date is < 10', () => {
          const result = buildDateFieldFilter(
            'fieldName',
            new Set(operators),
            '2022-05-04',
            isNegated,
          );

          expect(result).toEqual(
            ConditionTreeFactory.union(
              new ConditionTreeLeaf('fieldName', 'Before', '2022-05-04'),
              new ConditionTreeLeaf('fieldName', 'After', '2022-05-05'),
              new ConditionTreeLeaf('fieldName', 'Equal', '2022-05-05'),
              new ConditionTreeLeaf('fieldName', 'Missing'),
            ),
          );
        });

        it('should return a valid condition if the date is >= 10', () => {
          const result = buildDateFieldFilter(
            'fieldName',
            new Set(operators),
            '2022-05-10',
            isNegated,
          );

          expect(result).toEqual(
            ConditionTreeFactory.union(
              new ConditionTreeLeaf('fieldName', 'Before', '2022-05-10'),
              new ConditionTreeLeaf('fieldName', 'After', '2022-05-11'),
              new ConditionTreeLeaf('fieldName', 'Equal', '2022-05-11'),
              new ConditionTreeLeaf('fieldName', 'Missing'),
            ),
          );
        });

        it('should return a valid condition if the date the last day of the year', () => {
          const result = buildDateFieldFilter(
            'fieldName',
            new Set(operators),
            '2022-12-31',
            isNegated,
          );

          expect(result).toEqual(
            ConditionTreeFactory.union(
              new ConditionTreeLeaf('fieldName', 'Before', '2022-12-31'),
              new ConditionTreeLeaf('fieldName', 'After', '2023-01-01'),
              new ConditionTreeLeaf('fieldName', 'Equal', '2023-01-01'),
              new ConditionTreeLeaf('fieldName', 'Missing'),
            ),
          );
        });
      });

      describe('when the search string contains only a year and month', () => {
        it('should return a valid condition when the month is < 10', () => {
          const result = buildDateFieldFilter(
            'fieldName',
            new Set(operators),
            '2022-05',
            isNegated,
          );

          expect(result).toEqual(
            ConditionTreeFactory.union(
              new ConditionTreeLeaf('fieldName', 'Before', '2022-05-01'),
              new ConditionTreeLeaf('fieldName', 'After', '2022-06-01'),
              new ConditionTreeLeaf('fieldName', 'Equal', '2022-06-01'),
              new ConditionTreeLeaf('fieldName', 'Missing'),
            ),
          );
        });

        it('should return a valid condition when the month is >= 10', () => {
          const result = buildDateFieldFilter(
            'fieldName',
            new Set(operators),
            '2022-10',
            isNegated,
          );

          expect(result).toEqual(
            ConditionTreeFactory.union(
              new ConditionTreeLeaf('fieldName', 'Before', '2022-10-01'),
              new ConditionTreeLeaf('fieldName', 'After', '2022-11-01'),
              new ConditionTreeLeaf('fieldName', 'Equal', '2022-11-01'),
              new ConditionTreeLeaf('fieldName', 'Missing'),
            ),
          );
        });

        it('should return a valid condition when the month is december', () => {
          const result = buildDateFieldFilter(
            'fieldName',
            new Set(operators),
            '2022-12',
            isNegated,
          );

          expect(result).toEqual(
            ConditionTreeFactory.union(
              new ConditionTreeLeaf('fieldName', 'Before', '2022-12-01'),
              new ConditionTreeLeaf('fieldName', 'After', '2023-01-01'),
              new ConditionTreeLeaf('fieldName', 'Equal', '2023-01-01'),
              new ConditionTreeLeaf('fieldName', 'Missing'),
            ),
          );
        });
      });

      describe('when the search string contains only a year', () => {
        it('should return a valid condition', () => {
          const result = buildDateFieldFilter('fieldName', new Set(operators), '2022', isNegated);

          expect(result).toEqual(
            ConditionTreeFactory.union(
              new ConditionTreeLeaf('fieldName', 'Before', '2022-01-01'),
              new ConditionTreeLeaf('fieldName', 'After', '2023-01-01'),
              new ConditionTreeLeaf('fieldName', 'Equal', '2023-01-01'),
              new ConditionTreeLeaf('fieldName', 'Missing'),
            ),
          );
        });
      });

      it.each(['123', '1799', 'foo'])(
        'should return match-none when the search string is %s',
        searchString => {
          const result = buildDateFieldFilter(
            'fieldName',
            new Set(operators),
            searchString,
            isNegated,
          );

          expect(result).toEqual(ConditionTreeFactory.MatchAll);
        },
      );

      it.each(operators.filter(o => o !== 'Missing'))(
        'should return match-none if the operator %s is missing',
        operator => {
          const result = buildDateFieldFilter(
            'fieldName',
            new Set<Operator>(operators.filter(x => x !== operator) as Operator[]),
            '2022-01-01',
            isNegated,
          );

          expect(result).toEqual(ConditionTreeFactory.MatchAll);
        },
      );

      it('should generate a condition without the missing operator when not available', () => {
        const result = buildDateFieldFilter(
          'fieldName',
          new Set(operators.filter(o => o !== 'Missing')),
          '2022',
          isNegated,
        );

        expect(result).toEqual(
          ConditionTreeFactory.union(
            new ConditionTreeLeaf('fieldName', 'Before', '2022-01-01'),
            new ConditionTreeLeaf('fieldName', 'After', '2023-01-01'),
            new ConditionTreeLeaf('fieldName', 'Equal', '2023-01-01'),
          ),
        );
      });
    });
  });

  describe('with the operator <', () => {
    describe('when not negated', () => {
      const isNegated = false;
      const operators: Operator[] = ['Before'];

      describe('when the search string is a date', () => {
        it('should generate a valid condition', () => {
          const result = buildDateFieldFilter(
            'fieldName',
            new Set(operators),
            '<2022-04-05',
            isNegated,
          );

          expect(result).toEqual(new ConditionTreeLeaf('fieldName', 'Before', '2022-04-05'));
        });
      });

      describe('when the search string is a month', () => {
        it('should generate a valid condition', () => {
          const result = buildDateFieldFilter(
            'fieldName',
            new Set(operators),
            '<2022-04',
            isNegated,
          );

          expect(result).toEqual(new ConditionTreeLeaf('fieldName', 'Before', '2022-04-01'));
        });
      });

      describe('when the search string is a year', () => {
        it('should generate a valid condition', () => {
          const result = buildDateFieldFilter('fieldName', new Set(operators), '<2022', isNegated);

          expect(result).toEqual(new ConditionTreeLeaf('fieldName', 'Before', '2022-01-01'));
        });
      });

      it.each(operators)('should generate a match-none when %s is missing', operator => {
        const result = buildDateFieldFilter(
          'fieldName',
          new Set(operators.filter(o => o !== operator)),
          '<2022',
          isNegated,
        );

        expect(result).toEqual(ConditionTreeFactory.MatchNone);
      });
    });

    describe('when negated', () => {
      const isNegated = true;
      const operators: Operator[] = ['After', 'Equal', 'Missing'];

      describe('when the search string is a date', () => {
        it('should generate a valid condition', () => {
          const result = buildDateFieldFilter(
            'fieldName',
            new Set(operators),
            '<2022-04-05',
            isNegated,
          );

          expect(result).toEqual(
            ConditionTreeFactory.union(
              new ConditionTreeLeaf('fieldName', 'After', '2022-04-05'),
              new ConditionTreeLeaf('fieldName', 'Equal', '2022-04-05'),
              new ConditionTreeLeaf('fieldName', 'Missing'),
            ),
          );
        });
      });

      describe('when the search string is a month', () => {
        it('should generate a valid condition', () => {
          const result = buildDateFieldFilter(
            'fieldName',
            new Set(operators),
            '<2022-04',
            isNegated,
          );

          expect(result).toEqual(
            ConditionTreeFactory.union(
              new ConditionTreeLeaf('fieldName', 'After', '2022-04-01'),
              new ConditionTreeLeaf('fieldName', 'Equal', '2022-04-01'),
              new ConditionTreeLeaf('fieldName', 'Missing'),
            ),
          );
        });
      });

      describe('when the search string is a year', () => {
        it('should generate a valid condition', () => {
          const result = buildDateFieldFilter('fieldName', new Set(operators), '<2022', isNegated);

          expect(result).toEqual(
            ConditionTreeFactory.union(
              new ConditionTreeLeaf('fieldName', 'After', '2022-01-01'),
              new ConditionTreeLeaf('fieldName', 'Equal', '2022-01-01'),
              new ConditionTreeLeaf('fieldName', 'Missing'),
            ),
          );
        });
      });

      it.each(operators.filter(o => o !== 'Missing'))(
        'should generate a match-all when %s is missing',
        operator => {
          const result = buildDateFieldFilter(
            'fieldName',
            new Set(operators.filter(o => o !== operator)),
            '<2022',
            isNegated,
          );

          expect(result).toEqual(ConditionTreeFactory.MatchAll);
        },
      );

      it('should generate condition without the missing operator when missing', () => {
        const result = buildDateFieldFilter(
          'fieldName',
          new Set(operators.filter(o => o !== 'Missing')),
          '<2022',
          isNegated,
        );

        expect(result).toEqual(
          ConditionTreeFactory.union(
            new ConditionTreeLeaf('fieldName', 'After', '2022-01-01'),
            new ConditionTreeLeaf('fieldName', 'Equal', '2022-01-01'),
          ),
        );
      });
    });
  });

  describe('with the operator >', () => {
    describe('when not negated', () => {
      const isNegated = false;
      const operators: Operator[] = ['After', 'Equal'];

      describe('when the search string is a date', () => {
        it('should generate a valid condition', () => {
          const result = buildDateFieldFilter(
            'fieldName',
            new Set(operators),
            '>2022-04-05',
            isNegated,
          );

          expect(result).toEqual(
            ConditionTreeFactory.union(
              new ConditionTreeLeaf('fieldName', 'After', '2022-04-06'),
              new ConditionTreeLeaf('fieldName', 'Equal', '2022-04-06'),
            ),
          );
        });
      });

      describe('when the search string is a month', () => {
        it('should generate a valid condition', () => {
          const result = buildDateFieldFilter(
            'fieldName',
            new Set(operators),
            '>2022-04',
            isNegated,
          );

          expect(result).toEqual(
            ConditionTreeFactory.union(
              new ConditionTreeLeaf('fieldName', 'After', '2022-05-01'),
              new ConditionTreeLeaf('fieldName', 'Equal', '2022-05-01'),
            ),
          );
        });
      });

      describe('when the search string is a year', () => {
        it('should generate a valid condition', () => {
          const result = buildDateFieldFilter('fieldName', new Set(operators), '>2022', isNegated);

          expect(result).toEqual(
            ConditionTreeFactory.union(
              new ConditionTreeLeaf('fieldName', 'After', '2023-01-01'),
              new ConditionTreeLeaf('fieldName', 'Equal', '2023-01-01'),
            ),
          );
        });
      });

      it.each(operators)('should generate a match-none when %s is missing', operator => {
        const result = buildDateFieldFilter(
          'fieldName',
          new Set(operators.filter(o => o !== operator)),
          '>2022',
          isNegated,
        );

        expect(result).toEqual(ConditionTreeFactory.MatchNone);
      });
    });

    describe('when negated', () => {
      const isNegated = true;
      const operators: Operator[] = ['Before', 'Equal', 'Missing'];

      describe('when the search string is a date', () => {
        it('should generate a valid condition', () => {
          const result = buildDateFieldFilter(
            'fieldName',
            new Set(operators),
            '>2022-04-05',
            isNegated,
          );

          expect(result).toEqual(
            ConditionTreeFactory.union(
              new ConditionTreeLeaf('fieldName', 'Before', '2022-04-05'),
              new ConditionTreeLeaf('fieldName', 'Equal', '2022-04-05'),
              new ConditionTreeLeaf('fieldName', 'Missing'),
            ),
          );
        });
      });

      describe('when the search string is a month', () => {
        it('should generate a valid condition', () => {
          const result = buildDateFieldFilter(
            'fieldName',
            new Set(operators),
            '>2022-04',
            isNegated,
          );

          expect(result).toEqual(
            ConditionTreeFactory.union(
              new ConditionTreeLeaf('fieldName', 'Before', '2022-04-01'),
              new ConditionTreeLeaf('fieldName', 'Equal', '2022-04-01'),
              new ConditionTreeLeaf('fieldName', 'Missing'),
            ),
          );
        });
      });

      describe('when the search string is a year', () => {
        it('should generate a valid condition', () => {
          const result = buildDateFieldFilter('fieldName', new Set(operators), '>2022', isNegated);

          expect(result).toEqual(
            ConditionTreeFactory.union(
              new ConditionTreeLeaf('fieldName', 'Before', '2022-01-01'),
              new ConditionTreeLeaf('fieldName', 'Equal', '2022-01-01'),
              new ConditionTreeLeaf('fieldName', 'Missing'),
            ),
          );
        });
      });

      it.each(operators.filter(o => o !== 'Missing'))(
        'should generate a match-all when %s is missing',
        operator => {
          const result = buildDateFieldFilter(
            'fieldName',
            new Set(operators.filter(o => o !== operator)),
            '>2022',
            isNegated,
          );

          expect(result).toEqual(ConditionTreeFactory.MatchAll);
        },
      );

      it('should generate condition without the missing operator when missing', () => {
        const result = buildDateFieldFilter(
          'fieldName',
          new Set(operators.filter(o => o !== 'Missing')),
          '>2022',
          isNegated,
        );

        expect(result).toEqual(
          ConditionTreeFactory.union(
            new ConditionTreeLeaf('fieldName', 'Before', '2022-01-01'),
            new ConditionTreeLeaf('fieldName', 'Equal', '2022-01-01'),
          ),
        );
      });
    });
  });

  describe.each(['<=', '≤'])('with the operator %s', operator => {
    describe('when not negated', () => {
      const isNegated = false;
      const operators: Operator[] = ['Before'];

      describe('when the search string is a date', () => {
        it('should generate a valid condition', () => {
          const result = buildDateFieldFilter(
            'fieldName',
            new Set(operators),
            `${operator}2022-04-05`,
            isNegated,
          );

          expect(result).toEqual(new ConditionTreeLeaf('fieldName', 'Before', '2022-04-06'));
        });
      });

      describe('when the search string is a month', () => {
        it('should generate a valid condition', () => {
          const result = buildDateFieldFilter(
            'fieldName',
            new Set(operators),
            `${operator}2022-04`,
            isNegated,
          );

          expect(result).toEqual(new ConditionTreeLeaf('fieldName', 'Before', '2022-05-01'));
        });
      });

      describe('when the search string is a year', () => {
        it('should generate a valid condition', () => {
          const result = buildDateFieldFilter(
            'fieldName',
            new Set(operators),
            `${operator}2022`,
            isNegated,
          );

          expect(result).toEqual(new ConditionTreeLeaf('fieldName', 'Before', '2023-01-01'));
        });
      });

      it.each(operators)('should generate a match-none when %s is missing', missingOperator => {
        const result = buildDateFieldFilter(
          'fieldName',
          new Set(operators.filter(o => o !== missingOperator)),
          `${operator}2022`,
          isNegated,
        );

        expect(result).toEqual(ConditionTreeFactory.MatchNone);
      });
    });

    describe('when negated', () => {
      const isNegated = true;
      const operators: Operator[] = ['After', 'Equal', 'Missing'];

      describe('when the search string is a date', () => {
        it('should generate a valid condition', () => {
          const result = buildDateFieldFilter(
            'fieldName',
            new Set(operators),
            `${operator}2022-04-05`,
            isNegated,
          );

          expect(result).toEqual(
            ConditionTreeFactory.union(
              new ConditionTreeLeaf('fieldName', 'After', '2022-04-06'),
              new ConditionTreeLeaf('fieldName', 'Equal', '2022-04-06'),
              new ConditionTreeLeaf('fieldName', 'Missing'),
            ),
          );
        });
      });

      describe('when the search string is a month', () => {
        it('should generate a valid condition', () => {
          const result = buildDateFieldFilter(
            'fieldName',
            new Set(operators),
            `${operator}2022-04`,
            isNegated,
          );

          expect(result).toEqual(
            ConditionTreeFactory.union(
              new ConditionTreeLeaf('fieldName', 'After', '2022-05-01'),
              new ConditionTreeLeaf('fieldName', 'Equal', '2022-05-01'),
              new ConditionTreeLeaf('fieldName', 'Missing'),
            ),
          );
        });
      });

      describe('when the search string is a year', () => {
        it('should generate a valid condition', () => {
          const result = buildDateFieldFilter(
            'fieldName',
            new Set(operators),
            `${operator}2022`,
            isNegated,
          );

          expect(result).toEqual(
            ConditionTreeFactory.union(
              new ConditionTreeLeaf('fieldName', 'After', '2023-01-01'),
              new ConditionTreeLeaf('fieldName', 'Equal', '2023-01-01'),
              new ConditionTreeLeaf('fieldName', 'Missing'),
            ),
          );
        });
      });

      it.each(operators.filter(o => o !== 'Missing'))(
        'should generate a match-all when %s is missing',
        missingOperator => {
          const result = buildDateFieldFilter(
            'fieldName',
            new Set(operators.filter(o => o !== missingOperator)),
            `${operator}2022`,
            isNegated,
          );

          expect(result).toEqual(ConditionTreeFactory.MatchAll);
        },
      );

      it('should generate condition without the missing operator when missing', () => {
        const result = buildDateFieldFilter(
          'fieldName',
          new Set(operators.filter(o => o !== 'Missing')),
          `${operator}2022`,
          isNegated,
        );

        expect(result).toEqual(
          ConditionTreeFactory.union(
            new ConditionTreeLeaf('fieldName', 'After', '2023-01-01'),
            new ConditionTreeLeaf('fieldName', 'Equal', '2023-01-01'),
          ),
        );
      });
    });
  });

  describe.each(['>=', '≥'])('with the operator %s', operator => {
    describe('when not negated', () => {
      const isNegated = false;
      const operators: Operator[] = ['After', 'Equal'];

      describe('when the search string is a date', () => {
        it('should generate a valid condition', () => {
          const result = buildDateFieldFilter(
            'fieldName',
            new Set(operators),
            `${operator}2022-04-05`,
            isNegated,
          );

          expect(result).toEqual(
            ConditionTreeFactory.union(
              new ConditionTreeLeaf('fieldName', 'After', '2022-04-05'),
              new ConditionTreeLeaf('fieldName', 'Equal', '2022-04-05'),
            ),
          );
        });
      });

      describe('when the search string is a month', () => {
        it('should generate a valid condition', () => {
          const result = buildDateFieldFilter(
            'fieldName',
            new Set(operators),
            `${operator}2022-04`,
            isNegated,
          );

          expect(result).toEqual(
            ConditionTreeFactory.union(
              new ConditionTreeLeaf('fieldName', 'After', '2022-04-01'),
              new ConditionTreeLeaf('fieldName', 'Equal', '2022-04-01'),
            ),
          );
        });
      });

      describe('when the search string is a year', () => {
        it('should generate a valid condition', () => {
          const result = buildDateFieldFilter(
            'fieldName',
            new Set(operators),
            `${operator}2022`,
            isNegated,
          );

          expect(result).toEqual(
            ConditionTreeFactory.union(
              new ConditionTreeLeaf('fieldName', 'After', '2022-01-01'),
              new ConditionTreeLeaf('fieldName', 'Equal', '2022-01-01'),
            ),
          );
        });
      });

      it.each(operators)('should generate a match-none when %s is missing', missingOperator => {
        const result = buildDateFieldFilter(
          'fieldName',
          new Set(operators.filter(o => o !== missingOperator)),
          `${operator}2022`,
          isNegated,
        );

        expect(result).toEqual(ConditionTreeFactory.MatchNone);
      });
    });

    describe('when negated', () => {
      const isNegated = true;
      const operators: Operator[] = ['Before', 'Missing'];

      describe('when the search string is a date', () => {
        it('should generate a valid condition', () => {
          const result = buildDateFieldFilter(
            'fieldName',
            new Set(operators),
            `${operator}2022-04-05`,
            isNegated,
          );

          expect(result).toEqual(
            ConditionTreeFactory.union(
              new ConditionTreeLeaf('fieldName', 'Before', '2022-04-05'),
              new ConditionTreeLeaf('fieldName', 'Missing'),
            ),
          );
        });
      });

      describe('when the search string is a month', () => {
        it('should generate a valid condition', () => {
          const result = buildDateFieldFilter(
            'fieldName',
            new Set(operators),
            `${operator}2022-04`,
            isNegated,
          );

          expect(result).toEqual(
            ConditionTreeFactory.union(
              new ConditionTreeLeaf('fieldName', 'Before', '2022-04-01'),
              new ConditionTreeLeaf('fieldName', 'Missing'),
            ),
          );
        });
      });

      describe('when the search string is a year', () => {
        it('should generate a valid condition', () => {
          const result = buildDateFieldFilter(
            'fieldName',
            new Set(operators),
            `${operator}2022`,
            isNegated,
          );

          expect(result).toEqual(
            ConditionTreeFactory.union(
              new ConditionTreeLeaf('fieldName', 'Before', '2022-01-01'),
              new ConditionTreeLeaf('fieldName', 'Missing'),
            ),
          );
        });
      });

      it.each(operators.filter(o => o !== 'Missing'))(
        'should generate a match-all when %s is missing',
        missingOperator => {
          const result = buildDateFieldFilter(
            'fieldName',
            new Set(operators.filter(o => o !== missingOperator)),
            `${operator}2022`,
            isNegated,
          );

          expect(result).toEqual(ConditionTreeFactory.MatchAll);
        },
      );

      it('should generate condition without the missing operator when missing', () => {
        const result = buildDateFieldFilter(
          'fieldName',
          new Set(operators.filter(o => o !== 'Missing')),
          `${operator}2022`,
          isNegated,
        );

        expect(result).toEqual(new ConditionTreeLeaf('fieldName', 'Before', '2022-01-01'));
      });
    });
  });

  describe.each(['>', '<', '>=', '<=', '≤', '≥'])('with the operator %s', operator => {
    describe('when not negated', () => {
      const isNegated = false;

      it('should return match-none when the rest is not a valid date', () => {
        const result = buildDateFieldFilter(
          'fieldName',
          new Set(allOperators),
          `${operator}FOO`,
          isNegated,
        );

        expect(result).toEqual(ConditionTreeFactory.MatchNone);
      });
    });

    describe('when negated', () => {
      const isNegated = true;

      it('should return match-all when the rest is not a valid date', () => {
        const result = buildDateFieldFilter(
          'fieldName',
          new Set(allOperators),
          `${operator}FOO`,
          isNegated,
        );

        expect(result).toEqual(ConditionTreeFactory.MatchAll);
      });
    });
  });
});

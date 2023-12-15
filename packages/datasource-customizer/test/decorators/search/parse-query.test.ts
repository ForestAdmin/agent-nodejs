import { ColumnSchema, ConditionTreeFactory } from '@forestadmin/datasource-toolkit';
import parseQuery from '../../../src/decorators/search/parse-query';

describe('search parser', () => {
  const titleField: [string, ColumnSchema] = [
    'title',
    {
      columnType: 'String',
      type: 'Column',
      filterOperators: new Set(['IContains', 'Blank']),
    },
  ];

  const descriptionField: [string, ColumnSchema] = [
    'description',
    {
      columnType: 'String',
      type: 'Column',
      filterOperators: new Set(['IContains']),
    },
  ];

  describe('single word', () => {
    describe('String fields', () => {
      it.each(['foo', 'UNICODE_ÈÉÀÇÏŒÙØåΩÓ¥', '42.43.44'])(
        'should return a unique work with %s',
        word => {
          expect(parseQuery(word, [titleField])).toEqual(
            ConditionTreeFactory.fromPlainObject({
              operator: 'IContains',
              field: 'title',
              value: word,
            }),
          );
        },
      );

      it('should generate a condition tree with each field', () => {
        expect(parseQuery('foo', [titleField, descriptionField])).toEqual(
          ConditionTreeFactory.union(
            ConditionTreeFactory.fromPlainObject({
              operator: 'IContains',
              field: 'title',
              value: 'foo',
            }),
            ConditionTreeFactory.fromPlainObject({
              operator: 'IContains',
              field: 'description',
              value: 'foo',
            }),
          ),
        );
      });
    });

    describe('Number fields', () => {
      const scoreField: [string, ColumnSchema] = [
        'score',
        {
          columnType: 'Number',
          type: 'Column',
          filterOperators: new Set(['Equal', 'GreaterThan', 'LessThan']),
        },
      ];

      it.each([42, 37.5, -199, 0])(
        'should return a valid condition tree if the value is a number (%s)',
        value => {
          expect(parseQuery(`${value}`, [scoreField])).toEqual(
            ConditionTreeFactory.fromPlainObject({
              operator: 'Equal',
              field: 'score',
              value: value,
            }),
          );
        },
      );

      it.each(['foo', '', '42.43.44', '-42.43.44'])(
        'should return null if the value is not a number (%s)',
        value => {
          expect(parseQuery(value, [scoreField])).toEqual(null);
        },
      );

      describe('with operators', () => {
        it('should correctly parse the operator >', () => {
          expect(parseQuery('>42', [scoreField])).toEqual(
            ConditionTreeFactory.fromPlainObject({
              operator: 'GreaterThan',
              field: 'score',
              value: 42,
            }),
          );
        });

        it('should correctly parse the operator >=', () => {
          expect(parseQuery('>=42', [scoreField])).toEqual(
            ConditionTreeFactory.union(
              ConditionTreeFactory.fromPlainObject({
                operator: 'GreaterThan',
                field: 'score',
                value: 42,
              }),
              ConditionTreeFactory.fromPlainObject({
                operator: 'Equal',
                field: 'score',
                value: 42,
              }),
            ),
          );
        });

        it('should correctly parse the operator <', () => {
          expect(parseQuery('<42', [scoreField])).toEqual(
            ConditionTreeFactory.fromPlainObject({
              operator: 'LessThan',
              field: 'score',
              value: 42,
            }),
          );
        });

        it('should correctly parse the operator <=', () => {
          expect(parseQuery('<=42', [scoreField])).toEqual(
            ConditionTreeFactory.union(
              ConditionTreeFactory.fromPlainObject({
                operator: 'LessThan',
                field: 'score',
                value: 42,
              }),
              ConditionTreeFactory.fromPlainObject({
                operator: 'Equal',
                field: 'score',
                value: 42,
              }),
            ),
          );
        });
      });
    });

    describe('Boolean fields', () => {
      const isActive: [string, ColumnSchema] = [
        'isActive',
        {
          columnType: 'Boolean',
          type: 'Column',
          filterOperators: new Set(['Equal']),
        },
      ];

      it.each(['true', 'True', 'TRUE', '1'])(
        'should return a valid condition tree if the value is a boolean (%s)',
        value => {
          expect(parseQuery(`${value}`, [isActive])).toEqual(
            ConditionTreeFactory.fromPlainObject({
              operator: 'Equal',
              field: 'isActive',
              value: true,
            }),
          );
        },
      );

      it.each(['false', 'False', 'FALSE', '0'])(
        'should return a valid condition tree if the value is a boolean (%s)',
        value => {
          expect(parseQuery(`${value}`, [isActive])).toEqual(
            ConditionTreeFactory.fromPlainObject({
              operator: 'Equal',
              field: 'isActive',
              value: false,
            }),
          );
        },
      );

      it('should not generate a condition tree if the value is not a boolean', () => {
        expect(parseQuery('foo', [isActive])).toEqual(null);
      });
    });
  });

  describe('negated word', () => {
    it.each(['-foo', '-42.43.44'])('should return a negated condition tree for value %s', value => {
      expect(parseQuery(value, [titleField])).toEqual(
        ConditionTreeFactory.fromPlainObject({
          operator: 'NotIContains',
          field: 'title',
          value: value.slice(1),
        }),
      );
    });
  });

  describe('quoted text', () => {
    describe('with spaces', () => {
      describe('double quotes', () => {
        it('should return a condition tree with the quoted text', () => {
          expect(parseQuery('"foo bar"', [titleField])).toEqual(
            ConditionTreeFactory.fromPlainObject({
              operator: 'IContains',
              field: 'title',
              value: 'foo bar',
            }),
          );
        });
      });

      describe('simple quotes', () => {
        it('should return a condition tree with the quoted text', () => {
          expect(parseQuery("'foo bar'", [titleField])).toEqual(
            ConditionTreeFactory.fromPlainObject({
              operator: 'IContains',
              field: 'title',
              value: 'foo bar',
            }),
          );
        });
      });
    });
  });

  describe('multiple tokens', () => {
    it('should generate a AND aggregation with a condition for each token', () => {
      expect(parseQuery('foo bar', [titleField])).toEqual(
        ConditionTreeFactory.intersect(
          ConditionTreeFactory.fromPlainObject({
            operator: 'IContains',
            field: 'title',
            value: 'foo',
          }),
          ConditionTreeFactory.fromPlainObject({
            operator: 'IContains',
            field: 'title',
            value: 'bar',
          }),
        ),
      );
    });
  });

  describe('property/value pair', () => {
    const fields = [titleField, descriptionField];

    describe('when the value is a word', () => {
      it('should generate a condition tree with the property and the value', () => {
        expect(parseQuery('title:foo', fields)).toEqual(
          ConditionTreeFactory.fromPlainObject({
            operator: 'IContains',
            field: 'title',
            value: 'foo',
          }),
        );
      });
    });

    describe('special values', () => {
      describe('when the value is NULL', () => {
        it('should generate a condition tree with the property and the value', () => {
          expect(parseQuery('title:NULL', fields)).toEqual(
            ConditionTreeFactory.fromPlainObject({
              operator: 'Blank',
              field: 'title',
            }),
          );
        });
      });
    });

    describe('when the value is quoted', () => {
      it('should generate a condition tree with the property and the value', () => {
        expect(parseQuery('title:"foo bar"', fields)).toEqual(
          ConditionTreeFactory.fromPlainObject({
            operator: 'IContains',
            field: 'title',
            value: 'foo bar',
          }),
        );
      });
    });

    describe('when negated', () => {
      it('should generate a condition tree with the property and the value', () => {
        expect(parseQuery('-title:foo', fields)).toEqual(
          ConditionTreeFactory.fromPlainObject({
            operator: 'NotIContains',
            field: 'title',
            value: 'foo',
          }),
        );
      });

      describe('when the value is NULL', () => {
        it('should generate a condition tree with the property and the value', () => {
          expect(parseQuery('-title:NULL', fields)).toEqual(
            ConditionTreeFactory.fromPlainObject({
              operator: 'Present',
              field: 'title',
            }),
          );
        });
      });
    });

    describe('when the property does not exist', () => {
      it('should consider the search token as a whole', () => {
        expect(parseQuery('foo:bar title:foo', fields)).toEqual(
          ConditionTreeFactory.intersect(
            ConditionTreeFactory.union(
              ConditionTreeFactory.fromPlainObject({
                operator: 'IContains',
                field: 'title',
                value: 'foo:bar',
              }),
              ConditionTreeFactory.fromPlainObject({
                operator: 'IContains',
                field: 'description',
                value: 'foo:bar',
              }),
            ),
            ConditionTreeFactory.fromPlainObject({
              operator: 'IContains',
              field: 'title',
              value: 'foo',
            }),
          ),
        );
      });
    });

    describe('when the value is an empty string', () => {
      it('should generate a condition with an empty string', () => {
        expect(parseQuery('title:""', fields)).toEqual(
          ConditionTreeFactory.fromPlainObject({
            operator: 'Equal',
            field: 'title',
            value: '',
          }),
        );
      });
    });

    describe('when the property name contains a path', () => {
      it('should generate a condition tree with the property and the value', () => {
        const commentTitle: [string, ColumnSchema] = [
          'comment:title',
          {
            columnType: 'String',
            type: 'Column',
            filterOperators: new Set(['IContains']),
          },
        ];

        expect(parseQuery('comment.title:foo', [...fields, commentTitle])).toEqual(
          ConditionTreeFactory.fromPlainObject({
            operator: 'IContains',
            field: 'comment:title',
            value: 'foo',
          }),
        );
      });
    });
  });

  describe('when the syntax is incorrect', () => {
    it('should generate a single condition tree with the default field', () => {
      expect(parseQuery('tit:le:foo bar', [titleField, descriptionField])).toEqual(
        ConditionTreeFactory.union(
          ConditionTreeFactory.fromPlainObject({
            operator: 'IContains',
            field: 'title',
            value: 'tit:le:foo bar',
          }),
          ConditionTreeFactory.fromPlainObject({
            operator: 'IContains',
            field: 'description',
            value: 'tit:le:foo bar',
          }),
        ),
      );
    });
  });

  describe('OR syntax', () => {
    it('should combine multiple conditions in a or statement', () => {
      expect(parseQuery('foo OR bar', [titleField])).toEqual(
        ConditionTreeFactory.fromPlainObject({
          aggregator: 'Or',
          conditions: [
            {
              field: 'title',
              operator: 'IContains',
              value: 'foo',
            },
            {
              field: 'title',
              operator: 'IContains',
              value: 'bar',
            },
          ],
        }),
      );
    });

    it('should combine multiple conditions on multiple fields in a or statement', () => {
      expect(parseQuery('foo OR bar', [titleField, descriptionField])).toEqual(
        ConditionTreeFactory.fromPlainObject({
          aggregator: 'Or',
          conditions: [
            {
              field: 'title',
              operator: 'IContains',
              value: 'foo',
            },
            {
              field: 'description',
              operator: 'IContains',
              value: 'foo',
            },
            {
              field: 'title',
              operator: 'IContains',
              value: 'bar',
            },
            {
              field: 'description',
              operator: 'IContains',
              value: 'bar',
            },
          ],
        }),
      );
    });
  });

  describe('AND syntax', () => {
    it('should combine multiple conditions in a and statement', () => {
      expect(parseQuery('foo AND bar', [titleField])).toEqual(
        ConditionTreeFactory.fromPlainObject({
          aggregator: 'And',
          conditions: [
            {
              field: 'title',
              operator: 'IContains',
              value: 'foo',
            },
            {
              field: 'title',
              operator: 'IContains',
              value: 'bar',
            },
          ],
        }),
      );
    });

    it('should combine multiple conditions on multiple fields in a and statement', () => {
      expect(parseQuery('foo AND bar', [titleField, descriptionField])).toEqual(
        ConditionTreeFactory.fromPlainObject({
          aggregator: 'And',
          conditions: [
            {
              aggregator: 'Or',
              conditions: [
                {
                  field: 'title',
                  operator: 'IContains',
                  value: 'foo',
                },
                {
                  field: 'description',
                  operator: 'IContains',
                  value: 'foo',
                },
              ],
            },
            {
              aggregator: 'Or',
              conditions: [
                {
                  field: 'title',
                  operator: 'IContains',
                  value: 'bar',
                },
                {
                  field: 'description',
                  operator: 'IContains',
                  value: 'bar',
                },
              ],
            },
          ],
        }),
      );
    });
  });

  describe('complex query', () => {
    it('should generate a valid condition tree corresponding to a complex query', () => {
      expect(
        parseQuery('foo title:bar OR title:baz -banana', [titleField, descriptionField]),
      ).toEqual(
        ConditionTreeFactory.fromPlainObject({
          aggregator: 'And',
          conditions: [
            {
              aggregator: 'Or',
              conditions: [
                {
                  field: 'title',
                  operator: 'IContains',
                  value: 'foo',
                },
                {
                  field: 'description',
                  operator: 'IContains',
                  value: 'foo',
                },
              ],
            },
            {
              aggregator: 'Or',
              conditions: [
                {
                  field: 'title',
                  operator: 'IContains',
                  value: 'bar',
                },
                {
                  field: 'title',
                  operator: 'IContains',
                  value: 'baz',
                },
              ],
            },
            {
              field: 'title',
              operator: 'NotIContains',
              value: 'banana',
            },
            {
              field: 'description',
              operator: 'NotIContains',
              value: 'banana',
            },
          ],
        }),
      );
    });
  });
});

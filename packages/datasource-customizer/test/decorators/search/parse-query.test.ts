import type { Caller, ColumnSchema, Operator } from '@forestadmin/datasource-toolkit';

import { ConditionTreeFactory } from '@forestadmin/datasource-toolkit';

import { generateConditionTree, parseQuery } from '../../../src/decorators/search/parse-query';

describe('generateConditionTree', () => {
  const caller: Caller = {
    id: 42,
  } as Caller;
  const titleField: [string, ColumnSchema] = [
    'title',
    {
      columnType: 'String',
      type: 'Column',
      filterOperators: new Set<Operator>([
        'IContains',
        'Missing',
        'NotIContains',
        'Present',
        'Equal',
        'NotEqual',
      ]),
    },
  ];

  const descriptionField: [string, ColumnSchema] = [
    'description',
    {
      columnType: 'String',
      type: 'Column',
      filterOperators: new Set([
        'IContains',
        'Missing',
        'NotIContains',
        'Present',
        'Equal',
        'NotEqual',
      ]),
    },
  ];

  function parseQueryAndGenerateCondition(search: string, fields: [string, ColumnSchema][]) {
    const conditionTree = parseQuery(search);

    return generateConditionTree(caller, conditionTree, fields);
  }

  describe('single word', () => {
    describe('String fields', () => {
      it.each(['foo', 'UNICODE_ÈÉÀÇÏŒÙØåΩÓ¥', '42.43.44'])(
        'should return a unique work with %s',
        word => {
          expect(parseQueryAndGenerateCondition(word, [titleField])).toEqual(
            ConditionTreeFactory.fromPlainObject({
              operator: 'IContains',
              field: 'title',
              value: word,
            }),
          );
        },
      );

      it('should generate a condition tree with each field', () => {
        expect(parseQueryAndGenerateCondition('foo', [titleField, descriptionField])).toEqual(
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

      it('should generate a condition for each token', () => {
        expect(parseQueryAndGenerateCondition('foo 52.53.54', [titleField])).toEqual(
          ConditionTreeFactory.intersect(
            ConditionTreeFactory.fromPlainObject({
              operator: 'IContains',
              field: 'title',
              value: 'foo',
            }),
            ConditionTreeFactory.fromPlainObject({
              operator: 'IContains',
              field: 'title',
              value: '52.53.54',
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
          expect(parseQueryAndGenerateCondition(`${value}`, [scoreField])).toEqual(
            ConditionTreeFactory.fromPlainObject({
              operator: 'Equal',
              field: 'score',
              value,
            }),
          );
        },
      );

      it.each(['foo', '', '42.43.44', '-42.43.44'])(
        'should return null if the value is not a number (%s)',
        value => {
          expect(parseQueryAndGenerateCondition(value, [scoreField])).toEqual({
            aggregator: 'Or',
            conditions: [],
          });
        },
      );

      describe('with operators', () => {
        it('should correctly parse the operator >', () => {
          expect(parseQueryAndGenerateCondition('>42', [scoreField])).toEqual(
            ConditionTreeFactory.fromPlainObject({
              operator: 'GreaterThan',
              field: 'score',
              value: 42,
            }),
          );
        });

        it('should correctly parse the operator >=', () => {
          expect(parseQueryAndGenerateCondition('>=42', [scoreField])).toEqual(
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
          expect(parseQueryAndGenerateCondition('<42', [scoreField])).toEqual(
            ConditionTreeFactory.fromPlainObject({
              operator: 'LessThan',
              field: 'score',
              value: 42,
            }),
          );
        });

        it('should correctly parse the operator <=', () => {
          expect(parseQueryAndGenerateCondition('<=42', [scoreField])).toEqual(
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
          expect(parseQueryAndGenerateCondition(`${value}`, [isActive])).toEqual(
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
          expect(parseQueryAndGenerateCondition(`${value}`, [isActive])).toEqual(
            ConditionTreeFactory.fromPlainObject({
              operator: 'Equal',
              field: 'isActive',
              value: false,
            }),
          );
        },
      );

      it('should not generate a condition tree if the value is not a boolean', () => {
        expect(parseQueryAndGenerateCondition('foo', [isActive])).toEqual({
          aggregator: 'Or',
          conditions: [],
        });
      });
    });
  });

  describe('negated word', () => {
    it.each(['-foo', '-42.43.44'])('should return a negated condition tree for value %s', value => {
      expect(parseQueryAndGenerateCondition(value, [titleField])).toEqual(
        ConditionTreeFactory.fromPlainObject({
          aggregator: 'Or',
          conditions: [
            {
              field: 'title',
              operator: 'NotIContains',
              value: value.slice(1),
            },
            {
              field: 'title',
              operator: 'Missing',
            },
          ],
        }),
      );
    });

    it('should return a negated condition for multiple fields', () => {
      expect(parseQueryAndGenerateCondition('-foo', [titleField, descriptionField])).toEqual(
        ConditionTreeFactory.intersect(
          ConditionTreeFactory.fromPlainObject({
            aggregator: 'Or',
            conditions: [
              {
                field: 'title',
                operator: 'NotIContains',
                value: 'foo',
              },
              {
                field: 'title',
                operator: 'Missing',
              },
            ],
          }),
          ConditionTreeFactory.fromPlainObject({
            aggregator: 'Or',
            conditions: [
              {
                field: 'description',
                operator: 'NotIContains',
                value: 'foo',
              },
              {
                field: 'description',
                operator: 'Missing',
              },
            ],
          }),
        ),
      );
    });
  });

  describe('quoted text', () => {
    describe('with spaces', () => {
      describe('double quotes', () => {
        it('should return a condition tree with the quoted text', () => {
          expect(parseQueryAndGenerateCondition('"foo bar"', [titleField])).toEqual(
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
          expect(parseQueryAndGenerateCondition("'foo bar'", [titleField])).toEqual(
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
      expect(parseQueryAndGenerateCondition('foo bar', [titleField])).toEqual(
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
        expect(parseQueryAndGenerateCondition('title:foo', fields)).toEqual(
          ConditionTreeFactory.fromPlainObject({
            operator: 'IContains',
            field: 'title',
            value: 'foo',
          }),
        );
      });

      it('should correctly detect property names of 1 character', () => {
        expect(parseQueryAndGenerateCondition('t:foo', [['t', titleField[1]]])).toEqual(
          ConditionTreeFactory.fromPlainObject({
            operator: 'IContains',
            field: 't',
            value: 'foo',
          }),
        );
      });

      it('should correctly detect property names of 2 character', () => {
        expect(parseQueryAndGenerateCondition('ti:foo', [['ti', titleField[1]]])).toEqual(
          ConditionTreeFactory.fromPlainObject({
            operator: 'IContains',
            field: 'ti',
            value: 'foo',
          }),
        );
      });
    });

    describe('special values', () => {
      describe('when the value is NULL', () => {
        it('should generate a condition tree with the property and the value', () => {
          expect(parseQueryAndGenerateCondition('title:NULL', fields)).toEqual(
            ConditionTreeFactory.fromPlainObject({
              operator: 'Missing',
              field: 'title',
            }),
          );
        });
      });
    });

    describe('when the value is quoted', () => {
      it('should generate a condition tree with the property and the value', () => {
        expect(parseQueryAndGenerateCondition('title:"foo bar"', fields)).toEqual(
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
        expect(parseQueryAndGenerateCondition('-title:foo', fields)).toEqual(
          ConditionTreeFactory.fromPlainObject({
            aggregator: 'Or',
            conditions: [
              {
                field: 'title',
                operator: 'NotIContains',
                value: 'foo',
              },
              {
                field: 'title',
                operator: 'Missing',
              },
            ],
          }),
        );
      });

      describe('when the value is NULL', () => {
        it('should generate a condition tree with the property and the value', () => {
          expect(parseQueryAndGenerateCondition('-title:NULL', fields)).toEqual(
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
        expect(parseQueryAndGenerateCondition('foo:bar title:foo', fields)).toEqual(
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
        expect(parseQueryAndGenerateCondition('title:""', fields)).toEqual(
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

        expect(
          parseQueryAndGenerateCondition('comment.title:foo', [...fields, commentTitle]),
        ).toEqual(
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
      expect(
        parseQueryAndGenerateCondition('tit:le:foo bar', [titleField, descriptionField]),
      ).toEqual(
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
      expect(parseQueryAndGenerateCondition('foo OR bar', [titleField])).toEqual(
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
      expect(parseQueryAndGenerateCondition('foo OR bar', [titleField, descriptionField])).toEqual(
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
      expect(parseQueryAndGenerateCondition('foo AND bar', [titleField])).toEqual(
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
      expect(parseQueryAndGenerateCondition('foo AND bar', [titleField, descriptionField])).toEqual(
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

  describe('OR and AND combined', () => {
    it('should generate conditions with the correct priority with A OR B AND C', () => {
      expect(parseQueryAndGenerateCondition('foo OR bar AND baz', [titleField])).toEqual(
        ConditionTreeFactory.fromPlainObject({
          aggregator: 'Or',
          conditions: [
            {
              field: 'title',
              operator: 'IContains',
              value: 'foo',
            },
            {
              aggregator: 'And',
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
          ],
        }),
      );
    });

    it('should generate conditions with the correct priority with A OR B C', () => {
      expect(parseQueryAndGenerateCondition('foo OR bar baz', [titleField])).toEqual(
        ConditionTreeFactory.fromPlainObject({
          aggregator: 'Or',
          conditions: [
            {
              field: 'title',
              operator: 'IContains',
              value: 'foo',
            },
            {
              aggregator: 'And',
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
          ],
        }),
      );
    });

    it('should generate conditions with the correct priority with A AND B OR C', () => {
      expect(parseQueryAndGenerateCondition('foo AND bar OR baz', [titleField])).toEqual(
        ConditionTreeFactory.fromPlainObject({
          aggregator: 'Or',
          conditions: [
            {
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
            },
            {
              field: 'title',
              operator: 'IContains',
              value: 'baz',
            },
          ],
        }),
      );
    });

    it('should generate conditions with the correct priority with A B OR C', () => {
      expect(parseQueryAndGenerateCondition('foo bar OR baz', [titleField])).toEqual(
        ConditionTreeFactory.fromPlainObject({
          aggregator: 'Or',
          conditions: [
            {
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
            },
            {
              field: 'title',
              operator: 'IContains',
              value: 'baz',
            },
          ],
        }),
      );
    });

    describe('with parenthesis', () => {
      it('should apply the right priority to (A OR B) AND C', () => {
        expect(parseQueryAndGenerateCondition('(foo OR bar) AND baz', [titleField])).toEqual(
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
                    field: 'title',
                    operator: 'IContains',
                    value: 'bar',
                  },
                ],
              },
              {
                field: 'title',
                operator: 'IContains',
                value: 'baz',
              },
            ],
          }),
        );
      });

      it('should apply the right priority to C AND (A OR B)', () => {
        expect(parseQueryAndGenerateCondition('baz AND (foo OR bar)', [titleField])).toEqual(
          ConditionTreeFactory.fromPlainObject({
            aggregator: 'And',
            conditions: [
              {
                field: 'title',
                operator: 'IContains',
                value: 'baz',
              },
              {
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
              },
            ],
          }),
        );
      });

      it('should correctly interpret nested conditions', () => {
        expect(
          parseQueryAndGenerateCondition('foo AND (bar OR (baz AND foo))', [titleField]),
        ).toEqual(
          ConditionTreeFactory.intersect(
            ConditionTreeFactory.fromPlainObject({
              field: 'title',
              operator: 'IContains',
              value: 'foo',
            }),
            ConditionTreeFactory.union(
              ConditionTreeFactory.fromPlainObject({
                field: 'title',
                operator: 'IContains',
                value: 'bar',
              }),
              ConditionTreeFactory.intersect(
                ConditionTreeFactory.fromPlainObject({
                  field: 'title',
                  operator: 'IContains',
                  value: 'baz',
                }),
                ConditionTreeFactory.fromPlainObject({
                  field: 'title',
                  operator: 'IContains',
                  value: 'foo',
                }),
              ),
            ),
          ),
        );
      });

      it('should work with (A OR B)', () => {
        expect(parseQueryAndGenerateCondition('(foo OR bar)', [titleField])).toEqual(
          ConditionTreeFactory.union(
            ConditionTreeFactory.fromPlainObject({
              field: 'title',
              operator: 'IContains',
              value: 'foo',
            }),
            ConditionTreeFactory.fromPlainObject({
              field: 'title',
              operator: 'IContains',
              value: 'bar',
            }),
          ),
        );
      });

      it('should work if parenthesis are spaced', () => {
        expect(parseQueryAndGenerateCondition('( foo OR bar )', [titleField])).toEqual(
          ConditionTreeFactory.union(
            ConditionTreeFactory.fromPlainObject({
              field: 'title',
              operator: 'IContains',
              value: 'foo',
            }),
            ConditionTreeFactory.fromPlainObject({
              field: 'title',
              operator: 'IContains',
              value: 'bar',
            }),
          ),
        );
      });

      it('should work with trailing spaces', () => {
        expect(parseQueryAndGenerateCondition(' (foo OR bar) ', [titleField])).toEqual(
          ConditionTreeFactory.union(
            ConditionTreeFactory.fromPlainObject({
              field: 'title',
              operator: 'IContains',
              value: 'foo',
            }),
            ConditionTreeFactory.fromPlainObject({
              field: 'title',
              operator: 'IContains',
              value: 'bar',
            }),
          ),
        );
      });

      it('should allow tokens to contain parenthesis if not at the end and beginning', () => {
        expect(parseQueryAndGenerateCondition('foo(bar)baz', [titleField])).toEqual(
          ConditionTreeFactory.fromPlainObject({
            field: 'title',
            operator: 'IContains',
            value: 'foo(bar)baz',
          }),
        );
      });
    });
  });

  describe('complex query', () => {
    it('should generate a valid condition tree corresponding to a complex query', () => {
      expect(
        parseQueryAndGenerateCondition('foo title:bar OR title:baz -banana', [
          titleField,
          descriptionField,
        ]),
      ).toEqual(
        ConditionTreeFactory.union(
          ConditionTreeFactory.intersect(
            ConditionTreeFactory.union(
              ConditionTreeFactory.fromPlainObject({
                field: 'title',
                operator: 'IContains',
                value: 'foo',
              }),
              ConditionTreeFactory.fromPlainObject({
                field: 'description',
                operator: 'IContains',
                value: 'foo',
              }),
            ),
            ConditionTreeFactory.fromPlainObject({
              field: 'title',
              operator: 'IContains',
              value: 'bar',
            }),
          ),
          ConditionTreeFactory.intersect(
            ConditionTreeFactory.fromPlainObject({
              field: 'title',
              operator: 'IContains',
              value: 'baz',
            }),
            ConditionTreeFactory.intersect(
              ConditionTreeFactory.union(
                ConditionTreeFactory.fromPlainObject({
                  field: 'title',
                  operator: 'NotIContains',
                  value: 'banana',
                }),
                ConditionTreeFactory.fromPlainObject({
                  field: 'title',
                  operator: 'Missing',
                }),
              ),
              ConditionTreeFactory.union(
                ConditionTreeFactory.fromPlainObject({
                  field: 'description',
                  operator: 'NotIContains',
                  value: 'banana',
                }),
                ConditionTreeFactory.fromPlainObject({
                  field: 'description',
                  operator: 'Missing',
                }),
              ),
            ),
          ),
        ),
      );
    });
  });
});

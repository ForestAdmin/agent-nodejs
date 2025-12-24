import type { ScalarSubType } from '../../../src/introspection/types';

import { literal } from 'sequelize';

import DefaultValueParser from '../../../src/introspection/helpers/default-value-parser';

describe('DefaultValueParser', () => {
  describe('parse', () => {
    describe('when there is no expression', () => {
      it('should return undefined', () => {
        const defaultValue = DefaultValueParser.parse(
          {
            defaultValue: null,
            isLiteralDefaultValue: false,
            enumValues: null,
          },
          { type: 'scalar', subType: 'STRING' },
        );

        expect(defaultValue).toBeUndefined();
      });
    });

    describe.each(['TEXT', 'STRING'] as ScalarSubType[])('when the data type is %s', subType => {
      describe('when the expression is a string', () => {
        it('should return the valid expression', () => {
          const defaultValue = DefaultValueParser.parse(
            {
              defaultValue: 'default value test',
              isLiteralDefaultValue: false,
              enumValues: null,
            },
            {
              type: 'scalar',
              subType,
            },
          );

          expect(defaultValue).toBe('default value test');
        });
      });
    });

    describe.each(['DATE', 'DATEONLY'] as ScalarSubType[])('when the data type is %s', subType => {
      it('should return the valid expression', () => {
        const defaultValue = DefaultValueParser.parse(
          {
            defaultValue: '2022-01-01',
            isLiteralDefaultValue: false,
            enumValues: null,
          },
          {
            type: 'scalar',
            subType,
          },
        );

        expect(defaultValue).toBe('2022-01-01');
      });
    });

    describe('when the data type is ARRAY', () => {
      it('should return undefined', () => {
        const defaultValue = DefaultValueParser.parse(
          { defaultValue: "ARRAY['happy'::text]", isLiteralDefaultValue: true, enumValues: null },
          {
            type: 'array',
            subType: { type: 'scalar', subType: 'NUMBER' },
          },
        );

        expect(defaultValue).toBeUndefined();
      });
    });

    describe('when the data type is ENUM', () => {
      it('should return the default value', () => {
        const defaultValue = DefaultValueParser.parse(
          {
            defaultValue: 'enum1',
            isLiteralDefaultValue: false,
            enumValues: ['enum1', 'enum2'],
          },
          {
            type: 'enum',
            values: ['enum1', 'enum2'],
          },
        );

        expect(defaultValue).toBe('enum1');
      });
    });

    describe('when the data type is BOOLEAN', () => {
      describe('when the expression is a boolean', () => {
        it('should return the default value', () => {
          const trueDefaultValue = DefaultValueParser.parse(
            {
              defaultValue: 'true',
              isLiteralDefaultValue: false,
              enumValues: null,
            },
            {
              type: 'scalar',
              subType: 'BOOLEAN',
            },
          );
          const falseDefaultValue = DefaultValueParser.parse(
            {
              defaultValue: 'false',
              isLiteralDefaultValue: false,
              enumValues: null,
            },
            {
              type: 'scalar',
              subType: 'BOOLEAN',
            },
          );

          expect(trueDefaultValue).toBe(true);
          expect(falseDefaultValue).toBe(false);
        });
      });

      describe('when the expression is a string', () => {
        it.each([
          [true, 'true'],
          [true, 'TRUE'],
          [true, "b'1'"],
          [true, '1'],
          [false, 'false'],
          [false, 'FALSE'],
          [false, "b'0'"],
          [false, '0'],
        ])('should return %s on %s expression value', (expectedDefaultValue, expression) => {
          const defaultValue = DefaultValueParser.parse(
            {
              defaultValue: expression,
              isLiteralDefaultValue: false,
              enumValues: null,
            },
            {
              type: 'scalar',
              subType: 'BOOLEAN',
            },
          );

          expect(defaultValue).toBe(expectedDefaultValue);
        });
      });
    });

    describe('when the data type is a NUMBER', () => {
      describe('when the expression is a string', () => {
        it.each([
          ['NUMBER', '1', 1],
          ['BIGINT', '1111222233334444', 1111222233334444],
          ['FLOAT', '2.2445', 2.2445],
          ['DOUBLE', '2.24', 2.24],
          ['INTEGER', '2', 2],
          ['DECIMAL', '2.21', 2.21],
          ['REAL', '2.21', 2.21],
        ])(
          'should return the correct default value on data type %s',
          (subType, expression, expectedDefaultValue) => {
            const defaultValue = DefaultValueParser.parse(
              {
                defaultValue: expression,
                isLiteralDefaultValue: false,
                enumValues: null,
              },
              {
                type: 'scalar',
                subType: subType as 'NUMBER',
              },
            );

            expect(defaultValue).toBe(expectedDefaultValue);
          },
        );
      });

      describe('when the expression is a number', () => {
        it.each([
          ['NUMBER', 1],
          ['BIGINT', 1111222233334444],
          ['FLOAT', 2.2445],
          ['DOUBLE', 2.24],
        ])('should return the correct default value on data type %s', (dataType, expression) => {
          const defaultValue = DefaultValueParser.parse(
            {
              defaultValue: `${expression}`,
              isLiteralDefaultValue: false,
              enumValues: null,
            },
            {
              type: 'scalar',
              subType: dataType as 'NUMBER',
            },
          );

          expect(defaultValue).toBe(expression);
        });
      });

      describe('when value is not a number', () => {
        it('should return default value as literal', () => {
          const expression = 'a NaN expression';
          const defaultValue = DefaultValueParser.parse(
            {
              defaultValue: expression,
              isLiteralDefaultValue: false,
              enumValues: null,
            },
            {
              type: 'scalar',
              subType: 'NUMBER',
            },
          );

          expect(defaultValue).toStrictEqual(literal(expression));
        });
      });
    });

    describe('when the data type is DATE', () => {
      describe('when the expression is a date function', () => {
        it('should return default value as literal', () => {
          const expression = 'now()';

          const defaultValue = DefaultValueParser.parse(
            {
              defaultValue: expression,
              isLiteralDefaultValue: true,
              enumValues: null,
            },
            {
              type: 'scalar',
              subType: 'DATE',
            },
          );

          expect(defaultValue).toStrictEqual(literal(expression));
        });
      });

      describe('when the expression is a string', () => {
        it.each([
          ['DATE', '2022-04-14 09:47:26'],
          ['DATEONLY', '2022-04-14'],
          ['DATEONLY', '22:04:14'],
        ])('on $s should return the correct default value %s', (dataType, expression) => {
          const defaultValue = DefaultValueParser.parse(
            {
              defaultValue: expression,
              isLiteralDefaultValue: false,
              enumValues: null,
            },
            {
              type: 'scalar',
              subType: dataType as 'DATE',
            },
          );

          expect(defaultValue).toBe(expression);
        });
      });
    });

    describe('when the data type is JSON', () => {
      describe('when the expression is a invalid json', () => {
        it('should return the default value as literal', () => {
          const expression = 'not a valid JSON';
          const defaultValue = DefaultValueParser.parse(
            {
              defaultValue: expression,
              isLiteralDefaultValue: false,
              enumValues: null,
            },
            {
              type: 'scalar',
              subType: 'JSONB',
            },
          );

          expect(defaultValue).toStrictEqual(literal(expression));
        });
      });

      describe('when the expression is a valid json', () => {
        it.each(['JSON', 'JSONB'])(
          'should return the correct default value on data type %s',
          dataType => {
            const expression = '{"testJson": "a valid property"}';

            const defaultValue = DefaultValueParser.parse(
              {
                defaultValue: expression,
                isLiteralDefaultValue: false,
                enumValues: null,
              },
              {
                type: 'scalar',
                subType: dataType as 'JSON',
              },
            );

            expect(defaultValue).toStrictEqual({ testJson: 'a valid property' });
          },
        );
      });
    });
  });
});

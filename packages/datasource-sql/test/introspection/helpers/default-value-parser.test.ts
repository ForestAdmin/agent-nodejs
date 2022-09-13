import { DataTypes, literal } from 'sequelize';

import DefaultValueParser from '../../../src/introspection/helpers/default-value-parser';

describe('DefaultValueParser', () => {
  describe('when there is no expression', () => {
    it('should return undefined', () => {
      const defaultValueParser = new DefaultValueParser('postgres');

      const defaultValue = defaultValueParser.parse(null, DataTypes.STRING);

      expect(defaultValue).toBeUndefined();
    });
  });

  describe('when the expression is NULL', () => {
    it('should return null', () => {
      const defaultValueParser = new DefaultValueParser('postgres');

      const defaultValue = defaultValueParser.parse('NULL', DataTypes.STRING);

      expect(defaultValue).toBeNull();
    });
  });

  describe('when the data type is STRING', () => {
    describe('when the expression is a string', () => {
      it('should return the valid expression', () => {
        const defaultValueParser = new DefaultValueParser('mssql');

        const defaultValue = defaultValueParser.parse('default value test', DataTypes.STRING);

        expect(defaultValue).toBe('default value test');
      });

      it('should sanitize the expression', () => {
        const defaultValueParser = new DefaultValueParser('mssql');

        const quotedDefaultValue = defaultValueParser.parse(
          "'default value test'",
          DataTypes.STRING,
        );
        const defaultValue = defaultValueParser.parse('(default value test)', DataTypes.STRING);

        expect(quotedDefaultValue).toBe('default value test');
        expect(defaultValue).toBe('default value test');
      });
    });
  });

  describe('when the data type is ARRAY', () => {
    it('should return undefined', () => {
      const defaultValueParser = new DefaultValueParser('postgres');

      const defaultValue = defaultValueParser.parse([1, 2], DataTypes.ARRAY(DataTypes.INTEGER));

      expect(defaultValue).toBeUndefined();
    });
  });

  describe('when the data type is ENUM', () => {
    it('should return the default value', () => {
      const defaultValueParser = new DefaultValueParser('postgres');

      const defaultValue = defaultValueParser.parse('enum1', DataTypes.ENUM('enum1', 'enum2'));

      expect(defaultValue).toBe('enum1');
    });
  });

  describe('when the data type is BOOLEAN', () => {
    describe('when the expression is a boolean', () => {
      it('should return the default value', () => {
        const defaultValueParser = new DefaultValueParser('postgres');

        const trueDefaultValue = defaultValueParser.parse(true, DataTypes.BOOLEAN);
        const falseDefaultValue = defaultValueParser.parse(false, DataTypes.BOOLEAN);

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
        const defaultValueParser = new DefaultValueParser('postgres');

        const defaultValue = defaultValueParser.parse(expression, DataTypes.BOOLEAN);

        expect(defaultValue).toBe(expectedDefaultValue);
      });
    });
  });

  describe('when the data type is a NUMBER', () => {
    describe('when the expression is a string', () => {
      it.each([
        [DataTypes.NUMBER, '1', 1],
        [DataTypes.BIGINT, '1111222233334444', 1111222233334444],
        [DataTypes.FLOAT, '2.2445', 2.2445],
        [DataTypes.DOUBLE, '2.24', 2.24],
      ])(
        'should return the correct default value on data type %s',
        (dataType, expression, expectedDefaultValue) => {
          const defaultValueParser = new DefaultValueParser('postgres');

          const defaultValue = defaultValueParser.parse(expression, dataType);

          expect(defaultValue).toBe(expectedDefaultValue);
        },
      );
    });

    describe('when the expression is a number', () => {
      it.each([
        [DataTypes.NUMBER, 1],
        [DataTypes.BIGINT, 1111222233334444],
        [DataTypes.FLOAT, 2.2445],
        [DataTypes.DOUBLE, 2.24],
      ])('should return the correct default value on data type %s', (dataType, expression) => {
        const defaultValueParser = new DefaultValueParser('postgres');

        const defaultValue = defaultValueParser.parse(expression, dataType);

        expect(defaultValue).toBe(expression);
      });
    });

    describe('when value is not a number', () => {
      it('should return default value as literal', () => {
        const defaultValueParser = new DefaultValueParser('postgres');
        const expression = 'a NaN expression';

        const defaultValue = defaultValueParser.parse(expression, DataTypes.NUMBER);

        expect(defaultValue).toStrictEqual(literal(expression));
      });
    });
  });

  describe('when the data type is DATE', () => {
    describe('when the expression is a date function', () => {
      it('should return default value as literal', () => {
        const defaultValueParser = new DefaultValueParser('postgres');
        const expression = 'now()';

        const defaultValue = defaultValueParser.parse(expression, DataTypes.DATE);

        expect(defaultValue).toStrictEqual(literal(expression));
      });
    });

    describe('when the expression is a string', () => {
      it.each([
        [DataTypes.DATE, '2022-04-14 09:47:26'],
        [DataTypes.DATEONLY, '2022-04-14'],
        [DataTypes.DATEONLY, '22:04:14'],
      ])('on $s should return the correct default value %s', (dataType, expression) => {
        const defaultValueParser = new DefaultValueParser('postgres');

        const defaultValue = defaultValueParser.parse(expression, dataType);

        expect(defaultValue).toBe(expression);
      });
    });
  });

  describe('when the data type is JSON', () => {
    describe('when the expression is a invalid json', () => {
      it('should return the default value as literal', () => {
        const defaultValueParser = new DefaultValueParser('postgres');
        const expression = 'not a valid JSON';

        const defaultValue = defaultValueParser.parse(expression, DataTypes.JSONB);

        expect(defaultValue).toStrictEqual(literal(expression));
      });
    });

    describe('when the expression is a valid json', () => {
      it.each([DataTypes.JSON, DataTypes.JSONB])(
        'should return the correct default value on data type %s',
        dataType => {
          const defaultValueParser = new DefaultValueParser('postgres');
          const expression = '{"testJson": "a valid property"}';

          const defaultValue = defaultValueParser.parse(expression, dataType);

          expect(defaultValue).toStrictEqual({ testJson: 'a valid property' });
        },
      );
    });
  });

  describe('when the data type is not handled', () => {
    it('should return default value as literal', () => {
      const defaultValueParser = new DefaultValueParser('postgres');
      const expression = 'should be literal';

      const defaultValue = defaultValueParser.parse(expression, DataTypes.ABSTRACT);

      expect(defaultValue).toStrictEqual(literal(expression));
    });
  });
});

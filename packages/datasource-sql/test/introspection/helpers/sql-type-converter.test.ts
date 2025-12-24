import type { ColumnDescription } from '../../../src/introspection/dialects/dialect.interface';

import { DataTypes } from 'sequelize';

import SqlTypeConverter from '../../../src/introspection/helpers/sql-type-converter';

const makeColumnDescription = (description: Partial<ColumnDescription>) => {
  return {
    type: 'THIS-SHOULD-NEVER-MATCH',
    allowNull: false,
    defaultValue: '',
    primaryKey: false,
    autoIncrement: false,
    comment: null,
    ...description,
  } as ColumnDescription;
};

const makeColumnDescriptionForType = (type: string): ColumnDescription => {
  return makeColumnDescription({ type });
};

const makeColumnDescriptionForEnum = (
  type: string,
  enumValues: Array<string>,
): ColumnDescription => {
  return makeColumnDescription({ type, special: enumValues, enumValues });
};

describe('SqlTypeConverter', () => {
  describe('convert', () => {
    describe.each([
      ['JSON', DataTypes.JSON, 'JSON'],
      ['TINYINT(1)', DataTypes.BOOLEAN, 'BOOLEAN'],
      ['BIT', DataTypes.BOOLEAN, 'BOOLEAN'],
      ['BIT(1)', DataTypes.BOOLEAN, 'BOOLEAN'],
      ['BOOLEAN', DataTypes.BOOLEAN, 'BOOLEAN'],
      ['BINARY(10)', DataTypes.BLOB, 'BLOB'],
      ['VARBINARY(10)', DataTypes.BLOB, 'BLOB'],
      ['TINYBLOB', DataTypes.BLOB, 'BLOB'],
      ['BLOB', DataTypes.BLOB, 'BLOB'],
      ['MEDIUMBLOB', DataTypes.BLOB, 'BLOB'],
      ['LONGBLOB', DataTypes.BLOB, 'BLOB'],
      ['BYTEA', DataTypes.BLOB, 'BLOB'],
      ['CHARACTER VARYING', DataTypes.STRING, 'STRING'],
      ['TEXT', DataTypes.STRING, 'TEXT'],
      ['NTEXT', DataTypes.STRING, 'STRING'],
      ['SOMETHING TEXT', DataTypes.STRING, 'STRING'],
      ['VARCHAR(255)', DataTypes.STRING, 'STRING'],
      ['CHAR(255)', DataTypes.STRING, 'STRING'],
      ['NVARCHAR', DataTypes.STRING, 'STRING'],
      ['UNIQUEIDENTIFIER', DataTypes.UUID, 'UUID'],
      ['UUID', DataTypes.UUID, 'UUID'],
      ['JSONB', DataTypes.JSONB, 'JSONB'],
      ['INTEGER', DataTypes.NUMBER, 'INTEGER'],
      ['SERIAL', DataTypes.NUMBER, 'NUMBER'],
      ['INT8', DataTypes.NUMBER, 'INTEGER'],
      ['SMALLINT4', DataTypes.NUMBER, 'INTEGER'],
      ['TINYINT2', DataTypes.NUMBER, 'INTEGER'],
      ['MEDIUMINT4', DataTypes.NUMBER, 'INTEGER'],
      ['BIGINT4', DataTypes.BIGINT, 'BIGINT'],
      ['FLOAT8', DataTypes.FLOAT, 'FLOAT'],
      ['NUMERIC', DataTypes.DOUBLE, 'DECIMAL'],
      ['NUMERIC(10,2)', DataTypes.DOUBLE, 'DECIMAL'],
      ['DECIMAL', DataTypes.DOUBLE, 'DECIMAL'],
      ['REAL', DataTypes.DOUBLE, 'REAL'],
      ['DOUBLE', DataTypes.DOUBLE, 'DOUBLE'],
      ['DOUBLE PRECISION', DataTypes.DOUBLE, 'DOUBLE'],
      ['DECIMAL8', DataTypes.DOUBLE, 'DECIMAL'],
      ['DATE', DataTypes.DATEONLY, 'DATEONLY'],
      ['DATETIME', DataTypes.DATE, 'DATE'],
      ['TIMESTAMP', DataTypes.DATE, 'DATE'],
      ['TIME', DataTypes.TIME, 'TIME'],
      ['TIME WITHOUT TIME ZONE', DataTypes.TIME, 'TIME'],
      ['INET', DataTypes.INET, 'INET'],
    ])('from simple type %s', (columnType, dataType, expectedSubType) => {
      it(`should return DataTypes.${dataType.key}`, async () => {
        expect(
          await SqlTypeConverter.convert(
            { tableName: 'test', schema: 'public' },
            makeColumnDescriptionForType(columnType),
          ),
        ).toEqual({ type: 'scalar', subType: expectedSubType });
      });
    });

    describe("from type ENUM('a','b')", () => {
      it('should return a DataTypes.ENUM', async () => {
        expect(
          await SqlTypeConverter.convert(
            { tableName: 'test', schema: 'public' },
            makeColumnDescriptionForEnum("ENUM('a','b')", ['a', 'b']),
          ),
        ).toEqual({ type: 'enum', values: ['a', 'b'] });
      });
    });

    describe('from type USER-DEFINED', () => {
      describe('when the column is an enum', () => {
        it('should return a DataTypes.ENUM', async () => {
          expect(
            await SqlTypeConverter.convert(
              { tableName: 'test', schema: 'public' },
              makeColumnDescriptionForEnum('USER-DEFINED', ['valueA', 'valueB']),
            ),
          ).toEqual({ type: 'enum', values: ['valueA', 'valueB'] });
        });
      });

      describe('when the column cannot be detected', () => {
        it('should return a DataTypes.STRING', async () => {
          expect(
            await SqlTypeConverter.convert(
              { tableName: 'test', schema: 'public' },
              makeColumnDescriptionForEnum('USER-DEFINED', []),
            ),
          ).toEqual({ type: 'scalar', subType: 'STRING' });
        });
      });
    });

    describe('on $name from a table with arrays of integers, strings and enums', () => {
      it('should detect the proper types', async () => {
        const description = makeColumnDescriptionForType('ARRAY');

        expect(
          await SqlTypeConverter.convert(
            { tableName: 'arrayTable', schema: 'public' },
            { ...description, elementType: 'SERIAL' },
          ),
        ).toStrictEqual({
          type: 'array',
          subType: { type: 'scalar', subType: 'NUMBER' },
        });

        expect(
          await SqlTypeConverter.convert(
            { tableName: 'arrayTable', schema: 'public' },
            { ...description, elementType: 'VARCHAR' },
          ),
        ).toStrictEqual({
          type: 'array',
          subType: { type: 'scalar', subType: 'STRING' },
        });

        expect(
          await SqlTypeConverter.convert(
            { tableName: 'arrayTable', schema: 'public' },
            {
              ...description,
              enumValues: ['enum1', 'enum2'],
              elementType: 'enum_arrayTable_arrayEnum',
            },
          ),
        ).toStrictEqual({
          type: 'array',
          subType: {
            type: 'enum',
            schema: 'public',
            name: 'enum_arrayTable_arrayEnum',
            values: ['enum1', 'enum2'],
          },
        });

        expect(
          await SqlTypeConverter.convert(
            { tableName: 'arrayTable', schema: 'public' },
            { ...description, elementType: 'TIME' },
          ),
        ).toStrictEqual({
          type: 'array',
          subType: { type: 'scalar', subType: 'TIME' },
        });
      });
    });

    describe('from an unsupported type', () => {
      it('should ignore the column', async () => {
        await expect(
          SqlTypeConverter.convert(
            { tableName: 'test', schema: 'public' },
            makeColumnDescriptionForType('UNKNOWN'),
          ),
        ).rejects.toThrow('Unsupported type: UNKNOWN');
      });
    });
  });
});

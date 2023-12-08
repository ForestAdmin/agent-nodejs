import { DataTypes, Sequelize } from 'sequelize';

import { ColumnDescription } from '../../../src/introspection/dialects/dialect.interface';
import SqlTypeConverter from '../../../src/introspection/helpers/sql-type-converter';
import CONNECTION_DETAILS from '../../_helpers/connection-details';

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
      ['TEXT', DataTypes.STRING, 'STRING'],
      ['NTEXT', DataTypes.STRING, 'STRING'],
      ['SOMETHING TEXT', DataTypes.STRING, 'STRING'],
      ['VARCHAR(255)', DataTypes.STRING, 'STRING'],
      ['CHAR(255)', DataTypes.STRING, 'STRING'],
      ['NVARCHAR', DataTypes.STRING, 'STRING'],
      ['UNIQUEIDENTIFIER', DataTypes.UUID, 'UUID'],
      ['UUID', DataTypes.UUID, 'UUID'],
      ['JSONB', DataTypes.JSONB, 'JSONB'],
      ['INTEGER', DataTypes.NUMBER, 'NUMBER'],
      ['SERIAL', DataTypes.NUMBER, 'NUMBER'],
      ['INT8', DataTypes.NUMBER, 'NUMBER'],
      ['SMALLINT4', DataTypes.NUMBER, 'NUMBER'],
      ['TINYINT2', DataTypes.NUMBER, 'NUMBER'],
      ['MEDIUMINT4', DataTypes.NUMBER, 'NUMBER'],
      ['BIGINT4', DataTypes.BIGINT, 'BIGINT'],
      ['FLOAT8', DataTypes.FLOAT, 'FLOAT'],
      ['NUMERIC', DataTypes.DOUBLE, 'DOUBLE'],
      ['DECIMAL', DataTypes.DOUBLE, 'DOUBLE'],
      ['REAL', DataTypes.DOUBLE, 'DOUBLE'],
      ['DOUBLE', DataTypes.DOUBLE, 'DOUBLE'],
      ['DOUBLE PRECISION', DataTypes.DOUBLE, 'DOUBLE'],
      ['DECIMAL8', DataTypes.DOUBLE, 'DOUBLE'],
      ['DATE', DataTypes.DATEONLY, 'DATEONLY'],
      ['DATETIME', DataTypes.DATE, 'DATE'],
      ['TIMESTAMP', DataTypes.DATE, 'DATE'],
      ['TIME', DataTypes.TIME, 'TIME'],
      ['TIME WITHOUT TIME ZONE', DataTypes.TIME, 'TIME'],
      ['INET', DataTypes.INET, 'INET'],
    ])('from simple type %s', (columnType, dataType, expectedSubType) => {
      it(`should return DataTypes.${dataType.key}`, async () => {
        const sequelize = new Sequelize('postgres://');
        const sqlTypeConverter = new SqlTypeConverter(sequelize);
        expect(
          await sqlTypeConverter.convert(
            { tableName: 'test', schema: 'public' },
            `column-${columnType}`,
            makeColumnDescriptionForType(columnType),
          ),
        ).toEqual({ type: 'scalar', subType: expectedSubType });
      });
    });

    describe("from type ENUM('a','b')", () => {
      it('should return a DataTypes.ENUM', async () => {
        const sequelize = new Sequelize('postgres://');
        const sqlTypeConverter = new SqlTypeConverter(sequelize);

        expect(
          await sqlTypeConverter.convert(
            { tableName: 'test', schema: 'public' },
            'column-ENUM-a-b',
            makeColumnDescriptionForEnum("ENUM('a','b')", ['a', 'b']),
          ),
        ).toEqual({ type: 'enum', values: ['a', 'b'] });
      });
    });

    describe('from type USER-DEFINED', () => {
      describe('when the column is an enum', () => {
        it('should return a DataTypes.ENUM', async () => {
          const sequelize = new Sequelize('postgres://');
          const sqlTypeConverter = new SqlTypeConverter(sequelize);

          expect(
            await sqlTypeConverter.convert(
              { tableName: 'test', schema: 'public' },
              'column-USER-DEFINED-ENUM',
              makeColumnDescriptionForEnum('USER-DEFINED', ['valueA', 'valueB']),
            ),
          ).toEqual({ type: 'enum', values: ['valueA', 'valueB'] });
        });
      });

      describe('when the column cannot be detected', () => {
        it('should return a DataTypes.STRING', async () => {
          const sequelize = new Sequelize('postgres://');
          const sqlTypeConverter = new SqlTypeConverter(sequelize);

          expect(
            await sqlTypeConverter.convert(
              { tableName: 'test', schema: 'public' },
              'column-USER-DEFINED-ENUM-WITH-NO-VALUES',
              makeColumnDescriptionForEnum('USER-DEFINED', []),
            ),
          ).toEqual({ type: 'scalar', subType: 'STRING' });
        });
      });
    });

    describe.each(CONNECTION_DETAILS.filter(c => c.supports.arrays))(
      'on $name from a table with arrays of integers, strings and enums',
      connectionDetails => {
        it('should detect the proper types', async () => {
          let sequelize: Sequelize | null = null;

          try {
            const database = 'datasource-sql-array-type-getter-test';
            sequelize = new Sequelize(connectionDetails.url(), { logging: false });
            await sequelize.getQueryInterface().dropDatabase(database);
            await sequelize.getQueryInterface().createDatabase(database);
            await sequelize.close();

            sequelize = new Sequelize(connectionDetails.url(database), { logging: false });
            sequelize.define(
              'arrayTable',
              {
                arrayInt: DataTypes.ARRAY(DataTypes.INTEGER),
                arrayString: DataTypes.ARRAY(DataTypes.STRING),
                arrayEnum: DataTypes.ARRAY(DataTypes.ENUM('enum1', 'enum2')),
                arrayTimestamp: DataTypes.ARRAY(DataTypes.TIME),
              },
              { tableName: 'arrayTable', schema: 'public' },
            );

            await sequelize.sync({ force: true });

            const converter = new SqlTypeConverter(sequelize);
            const description = makeColumnDescriptionForType('ARRAY');

            expect(
              await converter.convert(
                { tableName: 'arrayTable', schema: 'public' },
                'arrayInt',
                description,
              ),
            ).toStrictEqual({
              type: 'array',
              subType: { type: 'scalar', subType: 'NUMBER' },
            });

            expect(
              await converter.convert(
                { tableName: 'arrayTable', schema: 'public' },
                'arrayString',
                description,
              ),
            ).toStrictEqual({
              type: 'array',
              subType: { type: 'scalar', subType: 'STRING' },
            });

            expect(
              await converter.convert(
                { tableName: 'arrayTable', schema: 'public' },
                'arrayEnum',
                description,
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
              await converter.convert(
                { tableName: 'arrayTable', schema: 'public' },
                'arrayTimestamp',
                description,
              ),
            ).toStrictEqual({
              type: 'array',
              subType: { type: 'scalar', subType: 'TIME' },
            });
          } finally {
            await sequelize?.close();
          }
        });
      },
    );

    describe('from an unsupported type', () => {
      it('should ignore the column', async () => {
        const sequelize = new Sequelize('postgres://');
        const sqlTypeConverter = new SqlTypeConverter(sequelize);

        await expect(
          sqlTypeConverter.convert(
            { tableName: 'test', schema: 'public' },
            'column-WITH-UNKNOWN-TYPE',
            makeColumnDescriptionForType('UNKNOWN'),
          ),
        ).rejects.toThrow('Unsupported type: UNKNOWN');
      });
    });
  });
});

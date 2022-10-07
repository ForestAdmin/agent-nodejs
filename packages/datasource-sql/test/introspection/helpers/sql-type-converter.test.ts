import { ColumnDescription, DataTypes, Sequelize } from 'sequelize';

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
  };
};

const makeColumnDescriptionForType = (type: string): ColumnDescription => {
  return makeColumnDescription({ type });
};

const makeColumnDescriptionForEnum = (enumValues: Array<string>): ColumnDescription => {
  return makeColumnDescription({ type: 'USER-DEFINED', special: enumValues });
};

describe('SqlTypeConverter', () => {
  describe('convert', () => {
    describe.each([
      ['JSON', DataTypes.JSON, 'JSON'],
      ['TINYINT(1)', DataTypes.BOOLEAN, 'BOOLEAN'],
      ['BIT', DataTypes.BOOLEAN, 'BOOLEAN'],
      ['BOOLEAN', DataTypes.BOOLEAN, 'BOOLEAN'],
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
            'test',
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
            'test',
            'column-ENUM-a-b',
            makeColumnDescriptionForType("ENUM('a','b')"),
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
              'test',
              'column-USER-DEFINED-ENUM',
              makeColumnDescriptionForEnum(['valueA', 'valueB']),
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
              'test',
              'column-USER-DEFINED-ENUM-WITH-NO-VALUES',
              makeColumnDescriptionForEnum([]),
            ),
          ).toEqual({ type: 'scalar', subType: 'STRING' });
        });
      });
    });

    describe('from type ARRAY', () => {
      it('should call arrayTypeGetter.getType and sqlTypeConverter.convert', async () => {
        const sequelize = new Sequelize('postgres://');
        const sqlTypeConverter = new SqlTypeConverter(sequelize);
        jest.spyOn(sqlTypeConverter, 'convert');
        const arrayTypeGetter = {
          getType: jest.fn().mockReturnValue({ type: 'TEXT', special: [] }),
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (sqlTypeConverter as any).arrayTypeGetter = arrayTypeGetter;

        const result = await sqlTypeConverter.convert(
          'test',
          'column-ARRAY',
          makeColumnDescriptionForType('ARRAY'),
        );
        expect(arrayTypeGetter.getType).toHaveBeenCalledWith('test', 'column-ARRAY');
        expect(sqlTypeConverter.convert).toHaveBeenCalledTimes(2);
        expect(result).toEqual({ type: 'array', subType: { type: 'scalar', subType: 'STRING' } });
      });
    });

    describe('from an unsupported type', () => {
      it('should ignore the column', async () => {
        const sequelize = new Sequelize('postgres://');
        const sqlTypeConverter = new SqlTypeConverter(sequelize);

        await expect(
          sqlTypeConverter.convert(
            'test',
            'column-WITH-UNKNOWN-TYPE',
            makeColumnDescriptionForType('UNKNOWN'),
          ),
        ).rejects.toThrow('Unsupported type: UNKNOWN');
      });
    });
  });
});

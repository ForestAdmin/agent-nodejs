import { ColumnDescription, DataTypes, Sequelize } from 'sequelize';

import SqlTypeConverter from '../../src/utils/sql-type-converter';

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
      ['JSON', DataTypes.JSON],
      ['TINYINT(1)', DataTypes.BOOLEAN],
      ['BIT', DataTypes.BOOLEAN],
      ['BOOLEAN', DataTypes.BOOLEAN],
      ['CHARACTER VARYING', DataTypes.STRING],
      ['TEXT', DataTypes.STRING],
      ['NTEXT', DataTypes.STRING],
      ['SOMETHING TEXT', DataTypes.STRING],
      ['VARCHAR(255)', DataTypes.STRING],
      ['CHAR(255)', DataTypes.STRING],
      ['NVARCHAR', DataTypes.STRING],
      ['UNIQUEIDENTIFIER', DataTypes.UUID],
      ['UUID', DataTypes.UUID],
      ['JSONB', DataTypes.JSONB],
      ['INTEGER', DataTypes.NUMBER],
      ['SERIAL', DataTypes.NUMBER],
      ['INT8', DataTypes.NUMBER],
      ['SMALLINT4', DataTypes.NUMBER],
      ['TINYINT2', DataTypes.NUMBER],
      ['MEDIUMINT4', DataTypes.NUMBER],
      ['BIGINT4', DataTypes.BIGINT],
      ['FLOAT8', DataTypes.FLOAT],
      ['NUMERIC', DataTypes.DOUBLE],
      ['DECIMAL', DataTypes.DOUBLE],
      ['REAL', DataTypes.DOUBLE],
      ['DOUBLE', DataTypes.DOUBLE],
      ['DOUBLE PRECISION', DataTypes.DOUBLE],
      ['DECIMAL8', DataTypes.DOUBLE],
      ['DATE', DataTypes.DATEONLY],
      ['DATETIME', DataTypes.DATE],
      ['TIMESTAMP', DataTypes.DATE],
      ['TIME', DataTypes.TIME],
      ['TIME WITHOUT TIME ZONE', DataTypes.TIME],
      ['INET', DataTypes.INET],
    ])('from simple type %s', (columnType, expectedDataType) => {
      it(`should return DataTypes.${expectedDataType.key}`, async () => {
        const sequelize = new Sequelize('postgres://');
        const sqlTypeConverter = new SqlTypeConverter(sequelize);
        expect(
          await sqlTypeConverter.convert(
            'test',
            `column-${columnType}`,
            makeColumnDescriptionForType(columnType),
          ),
        ).toEqual(expectedDataType);
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
        ).toEqual(DataTypes.ENUM('a', 'b'));
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
          ).toEqual(DataTypes.ENUM('valueA', 'valueB'));
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
          ).toEqual(DataTypes.STRING);
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
        expect(result).toEqual(DataTypes.ARRAY(DataTypes.STRING));
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

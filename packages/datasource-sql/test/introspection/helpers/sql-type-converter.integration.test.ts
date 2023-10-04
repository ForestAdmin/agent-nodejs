import { DataTypes, Sequelize } from 'sequelize';

import SqlTypeConverter from '../../../src/introspection/helpers/sql-type-converter';
import CONNECTION_DETAILS from '../../_helpers/connection-details';

const SCALAR_TYPES: [string, string, string[]?][] = [
  // Testing a subset of types
  ['JSON', 'JSON', ['postgres', 'mysql']],
  ['JSON', 'STRING', ['mariadb']],
  ['BIT(1)', 'BOOLEAN', ['mysql', 'mariadb', 'postgres']],
  ['TINYINT(1)', 'BOOLEAN', ['mysql', 'mariadb']],
  ['BIT', 'BOOLEAN', ['mssql']],
  ['BOOLEAN', 'BOOLEAN', ['mysql', 'mariadb', 'postgres']],
  ['CHARACTER VARYING', 'STRING', ['postgres']],
  ['TEXT', 'STRING'],
];

async function setupTestDB(connectionDetails, schema) {
  const initSequelize = new Sequelize({
    dialect: connectionDetails.dialect,
    username: connectionDetails.username,
    password: connectionDetails.password,
    host: connectionDetails.host,
    port: connectionDetails.port,
    logging: false,
  });

  await initSequelize.getQueryInterface().dropDatabase('datasource-sql-introspection-test');
  await initSequelize.getQueryInterface().createDatabase('datasource-sql-introspection-test');

  initSequelize.close();

  const sequelize = new Sequelize({
    dialect: connectionDetails.dialect,
    username: connectionDetails.username,
    password: connectionDetails.password,
    host: connectionDetails.host,
    port: connectionDetails.port,
    logging: false,
    database: 'datasource-sql-introspection-test',
    schema,
  });

  if (schema) {
    await sequelize.getQueryInterface().createSchema(schema);
  }

  return sequelize;
}

describe('Integration > SqlTypeConverter', () => {
  describe.each(CONNECTION_DETAILS)('On $dialect', connectionDetails => {
    describe.each([undefined, ...(connectionDetails.supports.schemas ? ['test_schema'] : [])])(
      'With schema=%s',
      schema => {
        let sequelize: Sequelize;

        beforeEach(async () => {
          sequelize = await setupTestDB(connectionDetails, schema);
        });

        afterEach(async () => {
          sequelize?.close();
        });

        describe.each(
          SCALAR_TYPES.filter(
            ([, , dialects]) => !dialects || dialects.includes(connectionDetails.dialect),
          ),
        )('when converting scalar type %s', (sqlType: string, expectedType) => {
          it(`should return ${expectedType}`, async () => {
            try {
              sequelize.define(
                'test',
                {
                  column: {
                    type: sqlType,
                  },
                },
                { schema, tableName: 'test', timestamps: false },
              );

              await sequelize.sync();

              const sqlTypeConverter = new SqlTypeConverter(sequelize);

              const columnDescriptions = await sequelize.getQueryInterface().describeTable('test');

              const result = await sqlTypeConverter.convert(
                { tableName: 'test', schema },
                'column',
                columnDescriptions.column,
              );

              expect(result).toEqual({ type: 'scalar', subType: expectedType });
            } catch (e) {
              // It helps displaying real errors
              console.error('Error', e);
              throw e;
            }
          });
        });

        describe('when converting an enum', () => {
          it('should return the enum as a subtype', async () => {
            sequelize.define(
              'test',
              {
                column: {
                  type: DataTypes.ENUM({
                    values: ['value1', 'value2'],
                  }),
                },
              },
              { schema, tableName: 'test', timestamps: false },
            );

            await sequelize.sync();

            const sqlTypeConverter = new SqlTypeConverter(sequelize);

            const columnDescriptions = await sequelize.getQueryInterface().describeTable('test');

            const result = await sqlTypeConverter.convert(
              { tableName: 'test', schema },
              'column',
              columnDescriptions.column,
            );

            const expectedResult = connectionDetails.supports.enums
              ? {
                  type: 'enum',
                  values: ['value1', 'value2'],
                }
              : { type: 'scalar', subType: 'STRING' };

            expect(result).toEqual(expectedResult);
          });
        });
      },
    );
  });

  describe.each(CONNECTION_DETAILS.filter(connectionDetails => connectionDetails.supports.arrays))(
    'On $dialect',
    connectionDetails => {
      describe.each([undefined, ...(connectionDetails.supports.schemas ? ['test_schema'] : [])])(
        `With schema=%S`,
        schema => {
          let sequelize: Sequelize;

          beforeEach(async () => {
            sequelize = await setupTestDB(connectionDetails, schema);
          });

          afterEach(async () => {
            sequelize?.close();
          });

          describe('with a basic scalar type', () => {
            it('should return the right type and subtype', async () => {
              sequelize.define(
                'test',
                {
                  column: {
                    type: DataTypes.ARRAY(DataTypes.STRING),
                  },
                },
                { schema, tableName: 'test', timestamps: false },
              );

              await sequelize.sync();

              const sqlTypeConverter = new SqlTypeConverter(sequelize);

              const columnDescriptions = await sequelize.getQueryInterface().describeTable('test');

              const result = await sqlTypeConverter.convert(
                { tableName: 'test', schema },
                'column',
                columnDescriptions.column,
              );

              expect(result).toEqual({
                type: 'array',
                subType: {
                  type: 'scalar',
                  subType: 'STRING',
                },
              });
            });
          });

          describe('with an enum type', () => {
            it('should return the right type and subtype', async () => {
              sequelize.define(
                'test',
                {
                  column: {
                    type: DataTypes.ARRAY(
                      DataTypes.ENUM({
                        values: ['value1', 'value2'],
                      }),
                    ),
                  },
                },
                { schema, tableName: 'test', timestamps: false },
              );

              await sequelize.sync();

              const sqlTypeConverter = new SqlTypeConverter(sequelize);

              const columnDescriptions = await sequelize.getQueryInterface().describeTable('test');

              const result = await sqlTypeConverter.convert(
                { tableName: 'test', schema },
                'column',
                columnDescriptions.column,
              );

              expect(result).toEqual({
                type: 'array',
                subType: {
                  type: 'enum',
                  name: 'enum_test_column',
                  schema: schema || 'public',
                  values: ['value1', 'value2'],
                },
              });
            });
          });
        },
      );
    },
  );
});

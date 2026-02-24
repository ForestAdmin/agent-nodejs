import { DataTypes, Sequelize, literal } from 'sequelize';

import Introspector from '../../src/introspection/introspector';
import {
  CONNECTION_DETAILS,
  MSSQL_DETAILS,
  POSTGRESQL_DETAILS,
} from '../_helpers/connection-details';
import setupEmptyDatabase from '../_helpers/setup-empty-database';

describe('Introspector > Integration', () => {
  /**
   * Bug reproduction: FK relations disappear when another schema has same table names.
   * @see https://community.forestadmin.com/t/missing-related-data/8385
   *
   * Root cause: Sequelize's FK query joins both key_column_usage and constraint_column_usage
   * on constraint_name without schema qualifiers. When two schemas have identical table/column
   * names, PostgreSQL generates identical auto-constraint names (e.g. "xxx_model_code_fkey")
   * in both schemas. The unqualified joins produce extra row matches, which were misdetected
   * as composite foreign keys and filtered out.
   */
  describe('relations with same table names across schemas', () => {
    const db = 'database_introspector_multi_schema_fk';

    describe.each(POSTGRESQL_DETAILS)('on $name', connectionDetails => {
      let sequelize: Sequelize;
      let sequelizeSchema1: Sequelize;

      beforeEach(async () => {
        sequelize = await setupEmptyDatabase(connectionDetails, db);

        await sequelize.query('DROP SCHEMA IF EXISTS schema1 CASCADE');
        await sequelize.query('DROP SCHEMA IF EXISTS schema2 CASCADE');

        await sequelize.getQueryInterface().createSchema('schema1');
        await sequelize.getQueryInterface().createSchema('schema2');

        sequelizeSchema1 = new Sequelize(connectionDetails.url(db), {
          logging: false,
          schema: 'schema1',
        });
      });

      afterEach(async () => {
        await sequelizeSchema1?.close();
        await sequelize?.close();
      });

      it('should not misdetect composite FK when another schema has same constraint names', async () => {
        // Two schemas with matching table names and FK column names cause PostgreSQL to generate
        // identical auto-constraint names, triggering the Sequelize cross-schema join bug.
        await sequelize.query(`
          CREATE TABLE schema1.main_table (
            id SERIAL PRIMARY KEY,
            unique_code TEXT NOT NULL UNIQUE
          );

          CREATE TABLE schema1.xxx_model (
            id SERIAL PRIMARY KEY,
            code TEXT NOT NULL REFERENCES schema1.main_table(unique_code)
          );

          CREATE TABLE schema1.yyy_model (
            id SERIAL PRIMARY KEY,
            code TEXT NOT NULL REFERENCES schema1.main_table(unique_code)
          );

          CREATE TABLE schema1.a_b_c (
            id SERIAL PRIMARY KEY,
            code TEXT NOT NULL REFERENCES schema1.main_table(unique_code)
          );

          -- Schema2: same table names AND same FK column names → same auto-constraint names
          CREATE TABLE schema2.main_table (
            id SERIAL PRIMARY KEY,
            unique_code TEXT NOT NULL UNIQUE
          );

          CREATE TABLE schema2.xxx_model (
            id SERIAL PRIMARY KEY,
            code TEXT NOT NULL REFERENCES schema2.main_table(unique_code)
          );

          CREATE TABLE schema2.yyy_model (
            id SERIAL PRIMARY KEY,
            code TEXT NOT NULL REFERENCES schema2.main_table(unique_code)
          );

          CREATE TABLE schema2.a_b_c (
            id SERIAL PRIMARY KEY,
            code TEXT NOT NULL REFERENCES schema2.main_table(unique_code)
          );
        `);

        const logger = jest.fn();
        const { tables } = await Introspector.introspect(sequelizeSchema1, logger);

        expect(tables).toHaveLength(4);

        const xxxModel = tables.find(t => t.name === 'xxx_model');
        const yyyModel = tables.find(t => t.name === 'yyy_model');
        const abcModel = tables.find(t => t.name === 'a_b_c');

        // All 3 models should preserve their FK constraint to main_table.unique_code
        expect(xxxModel?.columns.find(c => c.name === 'code')?.constraints).toEqual([
          { table: 'main_table', column: 'unique_code' },
        ]);
        expect(yyyModel?.columns.find(c => c.name === 'code')?.constraints).toEqual([
          { table: 'main_table', column: 'unique_code' },
        ]);
        expect(abcModel?.columns.find(c => c.name === 'code')?.constraints).toEqual([
          { table: 'main_table', column: 'unique_code' },
        ]);

        // Should NOT log composite relation warnings for these single-column FKs
        expect(logger).not.toHaveBeenCalledWith(
          'Warn',
          expect.stringContaining('Composite relations are not supported'),
        );
      });

      it('should still detect real composite FKs when another schema has same constraint names', async () => {
        await sequelize.query(`
          CREATE TABLE schema1.target (
            type TEXT NOT NULL,
            code TEXT NOT NULL,
            PRIMARY KEY (type, code)
          );

          CREATE TABLE schema1.source (
            id SERIAL PRIMARY KEY,
            fk_type TEXT NOT NULL,
            fk_code TEXT NOT NULL,
            CONSTRAINT source_composite_fkey FOREIGN KEY (fk_type, fk_code)
              REFERENCES schema1.target(type, code)
          );

          -- Schema2: identical structure produces identical auto-constraint names
          CREATE TABLE schema2.target (
            type TEXT NOT NULL,
            code TEXT NOT NULL,
            PRIMARY KEY (type, code)
          );

          CREATE TABLE schema2.source (
            id SERIAL PRIMARY KEY,
            fk_type TEXT NOT NULL,
            fk_code TEXT NOT NULL,
            CONSTRAINT source_composite_fkey FOREIGN KEY (fk_type, fk_code)
              REFERENCES schema2.target(type, code)
          );
        `);

        const logger = jest.fn();
        const { tables } = await Introspector.introspect(sequelizeSchema1, logger);

        const sourceTable = tables.find(t => t.name === 'source');

        // Composite FKs should be filtered out (not supported by Sequelize)
        expect(sourceTable?.columns.find(c => c.name === 'fk_type')?.constraints).toEqual([]);
        expect(sourceTable?.columns.find(c => c.name === 'fk_code')?.constraints).toEqual([]);

        expect(logger).toHaveBeenCalledWith(
          'Warn',
          expect.stringContaining('Composite relations are not supported'),
        );
      });
    });
  });

  describe('relations to different schemas', () => {
    const db = 'database_introspector';

    describe.each(CONNECTION_DETAILS.filter(connection => connection.supports.schemas))(
      'on $name',
      connectionDetails => {
        let sequelize: Sequelize;
        let sequelizeSchema1: Sequelize;

        beforeEach(async () => {
          sequelize = await setupEmptyDatabase(connectionDetails, db);

          sequelizeSchema1 = new Sequelize(connectionDetails.url(db), {
            logging: false,
            schema: 'schema1',
          });

          await sequelize.getQueryInterface().dropSchema('schema1');
          await sequelize.getQueryInterface().dropSchema('schema2');

          await sequelize.getQueryInterface().createSchema('schema1');
          await sequelize.getQueryInterface().createSchema('schema2');
        });

        afterEach(async () => {
          await sequelize?.close();
          await sequelizeSchema1?.close();
        });

        it('should ignore relations to other schemas and log warnings', async () => {
          sequelize.define(
            'elements',
            {
              userId: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                  model: {
                    schema: 'schema2',
                    tableName: 'users',
                  },
                  key: 'id',
                },
              },
            },
            {
              schema: 'schema1',
              paranoid: false,
              createdAt: false,
              updatedAt: false,
            },
          );

          sequelize.define(
            'users',
            {},
            { schema: 'schema2', paranoid: false, createdAt: false, updatedAt: false },
          );

          await sequelize.sync({ force: true });

          const logger = jest.fn();
          const { tables, version } = await Introspector.introspect(sequelizeSchema1, logger);

          expect(version).toEqual(3);
          expect(tables).toEqual([
            {
              name: 'elements',
              schema: 'schema1',
              unique: [['id']],
              columns: [
                expect.objectContaining({
                  name: 'id',
                }),
                expect.objectContaining({
                  name: 'userId',
                  constraints: [],
                }),
              ],
            },
          ]);
        });
      },
    );
  });

  describe.each(MSSQL_DETAILS)('mssql $name', connectionDetails => {
    const db = 'database_introspector';

    let sequelize: Sequelize;

    beforeEach(async () => {
      sequelize = await setupEmptyDatabase(connectionDetails, db);
    });

    afterEach(async () => {
      await sequelize?.close();
    });

    it('should support MSSQL tables with dots in their names and their relations', async () => {
      await sequelize.query(`
        CREATE TABLE "Employees.oldVersion" (
          "EmployeeID" "int" IDENTITY (1, 1) NOT NULL ,
          "Name" nvarchar (20) NOT NULL ,
          CONSTRAINT "PK_Employees" PRIMARY KEY  CLUSTERED ("EmployeeID"),
        )
      `);
      await sequelize.query(`
        CREATE TABLE "Customers" (
          "CustomerID" nchar (5) NOT NULL ,
          "Name" nvarchar (40) NOT NULL ,
          CONSTRAINT "PK_Customers" PRIMARY KEY  CLUSTERED ("CustomerID")
        )
      `);
      await sequelize.query(`
        CREATE TABLE "Orders" (
          "OrderID" "int" IDENTITY (1, 1) NOT NULL ,
          "CustomerID" nchar (5) NULL ,
          "EmployeeID" "int" NULL ,
          CONSTRAINT "PK_Orders" PRIMARY KEY  CLUSTERED ("OrderID"),
            CONSTRAINT "FK_Orders_Customers" FOREIGN KEY ("CustomerID") REFERENCES "dbo"."Customers" ("CustomerID"),
          CONSTRAINT "FK_Orders_Employees" FOREIGN KEY ("EmployeeID") REFERENCES "dbo"."Employees.oldVersion" ("EmployeeID"),
        )
      `);
      const { tables } = await Introspector.introspect(sequelize);
      expect(tables).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Employees.oldVersion',
          }),
          expect.objectContaining({
            name: 'Customers',
          }),
          expect.objectContaining({
            name: 'Orders',
            columns: expect.arrayContaining([
              expect.objectContaining({
                name: 'OrderID',
              }),
              expect.objectContaining({
                name: 'CustomerID',
                constraints: [
                  {
                    column: 'CustomerID',
                    table: 'Customers',
                  },
                ],
              }),
              expect.objectContaining({
                name: 'EmployeeID',
                constraints: [
                  {
                    column: 'EmployeeID',
                    table: 'Employees.oldVersion',
                  },
                ],
              }),
            ]),
          }),
        ]),
      );
    });
  });

  describe('views', () => {
    describe.each(CONNECTION_DETAILS)('on $name', connectionDetails => {
      let sequelize: Sequelize;
      const db = 'database_introspector_views';

      beforeEach(async () => {
        sequelize = await setupEmptyDatabase(connectionDetails, db);
      });

      afterEach(async () => {
        await sequelize?.close();
      });

      it('should return views', async () => {
        const queryInterface = sequelize.getQueryInterface();

        await queryInterface.createTable('things', {
          id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
          },
          name: {
            type: DataTypes.STRING,
          },
          description: {
            type: DataTypes.STRING,
          },
        });

        try {
          await sequelize.query(`
              CREATE VIEW the_view AS
              SELECT * FROM things
            `);
        } catch (e) {
          console.error('error', e);
          throw e;
        }

        const { views } = await Introspector.introspect(sequelize);

        expect(views).toEqual([
          expect.objectContaining({
            name: 'the_view',
            unique: [],
            schema: connectionDetails.defaultSchema,
            columns: [
              expect.objectContaining({
                name: 'id',
                type: {
                  subType: 'INTEGER',
                  type: 'scalar',
                },
              }),
              expect.objectContaining({
                name: 'name',
                type: {
                  subType: 'STRING',
                  type: 'scalar',
                },
              }),
              expect.objectContaining({
                name: 'description',
                type: {
                  subType: 'STRING',
                  type: 'scalar',
                },
              }),
            ],
          }),
        ]);
      });
    });

    describe('with schemas', () => {
      const db = 'database_introspector_views_schemas';

      describe.each(CONNECTION_DETAILS.filter(c => c.supports.schemas))(
        'on $name',
        connectionDetails => {
          let sequelize: Sequelize;

          beforeEach(async () => {
            await setupEmptyDatabase(connectionDetails, db);
            sequelize = new Sequelize(connectionDetails.url(db), {
              logging: false,
              schema: 'schema1',
            });

            await sequelize.getQueryInterface().createSchema('schema1');
          });

          afterEach(async () => {
            await sequelize?.close();
          });

          it('should return views', async () => {
            sequelize.define(
              'things',
              {
                id: {
                  type: DataTypes.INTEGER,
                  primaryKey: true,
                  autoIncrement: true,
                },
                name: {
                  type: DataTypes.STRING,
                },
                description: {
                  type: DataTypes.STRING,
                },
              },
              {
                schema: 'schema1',
              },
            );

            await sequelize.sync({ force: true });

            try {
              await sequelize.query(`
              CREATE VIEW schema1.the_view AS
              SELECT * FROM schema1.things
            `);
            } catch (e) {
              console.error('error', e);
              throw e;
            }

            const { tables, views } = await Introspector.introspect(sequelize);
            expect(tables).toEqual([
              expect.objectContaining({
                name: 'things',
              }),
            ]);
            expect(views).toEqual([
              expect.objectContaining({
                name: 'the_view',
              }),
            ]);
          });
        },
      );
    });
  });

  describe.each(POSTGRESQL_DETAILS)('$name', connectionDetails => {
    let sequelize: Sequelize;
    const db = 'database_introspector';

    beforeEach(async () => {
      sequelize = await setupEmptyDatabase(connectionDetails, db);
    });

    afterEach(async () => {
      await sequelize?.close();
    });

    it('should support table with multiple sequences', async () => {
      await sequelize.query(`
      CREATE SEQUENCE id_seq;
      CREATE SEQUENCE position_seq;

      CREATE TABLE "elements" (
          "id" integer DEFAULT nextval('id_seq'::regclass),
          "position" integer DEFAULT nextval('position_seq'::regclass),
          "order" SERIAL,
          PRIMARY KEY ("id")
      );`);

      const logger = jest.fn();
      const { tables, version } = await Introspector.introspect(sequelize, logger);

      expect(version).toEqual(3);
      expect(tables).toEqual([
        {
          name: 'elements',
          schema: 'public',
          unique: [['id']],
          columns: [
            expect.objectContaining({
              name: 'id',
              primaryKey: true,
              autoIncrement: true,
              defaultValue: null,
            }),

            expect.objectContaining({
              name: 'position',
              autoIncrement: false,
              defaultValue: literal("nextval('position_seq'::regclass)"),
              isLiteralDefaultValue: true,
            }),

            expect.objectContaining({
              name: 'order',
              autoIncrement: false,
              defaultValue: literal("nextval('elements_order_seq'::regclass)"),
              isLiteralDefaultValue: true,
            }),
          ],
        },
      ]);

      expect(logger).not.toHaveBeenCalled();
    });

    it('should not introspect composite key relations', async () => {
      await sequelize.query(`
CREATE TABLE "TableA" (
    "type" TEXT NOT NULL,
    "fieldA" TEXT NOT NULL,
    "fieldB" TEXT NOT NULL,
    PRIMARY KEY ("type", "fieldA")
);
CREATE TABLE "TableB" (
    "type" TEXT NOT NULL,
    "fieldA" TEXT NOT NULL,
    "fieldB" TEXT NOT NULL,
    PRIMARY KEY ("type", "fieldA")
);

CREATE TABLE "TableC" (
    "type" TEXT NOT NULL,
    "fieldA" TEXT NOT NULL,
    "fieldB" TEXT NOT NULL,
    PRIMARY KEY ("type")
);

ALTER TABLE "TableA" ADD CONSTRAINT "A_fkey_composite" FOREIGN KEY ("type", "fieldA") REFERENCES "TableB"("type", "fieldA");
ALTER TABLE "TableA" ADD CONSTRAINT "A_fkey" FOREIGN KEY ("type") REFERENCES "TableC"("type");

      `);

      const logger = jest.fn();
      const { tables } = await Introspector.introspect(sequelize, logger);

      expect(tables).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'TableA',
            columns: expect.arrayContaining([
              expect.objectContaining({
                name: 'type',
                constraints: [
                  {
                    table: 'TableC',
                    column: 'type',
                  },
                ],
              }),
            ]),
          }),
        ]),
      );

      expect(logger).toHaveBeenCalledTimes(1);
      expect(logger).toHaveBeenCalledWith(
        'Warn',
        "Composite relations are not supported. skipping 'A_fkey_composite' on 'TableA'",
      );
    });
  });
});

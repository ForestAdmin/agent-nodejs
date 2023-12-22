/* eslint-disable max-len */
import { DataTypes, Sequelize } from 'sequelize';

import Introspector from '../../src/introspection/introspector';
import CONNECTION_DETAILS, { MSSQL_DETAILS } from '../_helpers/connection-details';

describe('Introspector > Integration', () => {
  describe('relations to different schemas', () => {
    const db = 'database_introspector_relations_schema';

    describe.each(CONNECTION_DETAILS.filter(connection => connection.supports.schemas))(
      'on $name',
      connectionDetails => {
        let sequelize: Sequelize;
        let sequelizeSchema1: Sequelize;

        beforeEach(async () => {
          await connectionDetails.reinitDb(db);

          sequelize = new Sequelize(connectionDetails.url(db), {
            logging: false,
          });

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
          const { tables } = await Introspector.introspect(sequelizeSchema1, logger);

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
          expect(logger).toHaveBeenCalledWith(
            'Error',
            "Failed to load constraints on relation on table 'elements' referencing 'users.id'. The relation will be ignored.",
          );
        });
      },
    );
  });

  describe.each(MSSQL_DETAILS)('mssql $name', connectionDetails => {
    let sequelize: Sequelize;
    const db = 'database_introspector_mssql';

    beforeEach(async () => {
      await connectionDetails.reinitDb(db);

      sequelize = new Sequelize(connectionDetails.url(db), { logging: false });
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
        await connectionDetails.reinitDb(db);

        sequelize = new Sequelize(connectionDetails.url(db), { logging: false });
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
                  subType: 'NUMBER',
                  type: 'scalar',
                },
              }),
              {
                allowNull: true,
                autoIncrement: false,
                constraints: [],
                defaultValue: undefined,
                isLiteralDefaultValue: false,
                name: 'name',
                primaryKey: false,
                type: {
                  subType: 'STRING',
                  type: 'scalar',
                },
              },
              {
                allowNull: true,
                autoIncrement: false,
                constraints: [],
                defaultValue: undefined,
                isLiteralDefaultValue: false,
                name: 'description',
                primaryKey: false,
                type: {
                  subType: 'STRING',
                  type: 'scalar',
                },
              },
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
            await connectionDetails.reinitDb(db);

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
});

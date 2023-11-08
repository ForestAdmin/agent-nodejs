/* eslint-disable max-len */
import { Sequelize } from 'sequelize';

import Introspector from '../../src/introspection/introspector';
import CONNECTION_DETAILS from '../_helpers/connection-details';

const db = 'database_introspector';
const URL = CONNECTION_DETAILS.find(connection => connection.dialect === 'mssql')?.url() as string;

const dropTableQuery = (tableName, sequelize) => {
  const b = `DROP TABLE IF EXISTS dbo.[${tableName}]`;

  return sequelize.query(b);
};

describe('Introspector > Integration', () => {
  it('should skip MSSQL tables with dots in their names and their relations', async () => {
    let sequelize = new Sequelize(URL, { logging: false });
    await sequelize.getQueryInterface().createDatabase(db);
    sequelize.close();

    sequelize = new Sequelize(`${URL}/${db}`, { logging: false });

    await dropTableQuery('Orders', sequelize);
    await dropTableQuery('Customers', sequelize);
    await dropTableQuery('Employees.oldVersion', sequelize);

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
    const tables = await Introspector.introspect(sequelize);
    expect(tables.length).toBe(2);
    const orders = tables.find(table => table.name === 'Orders');
    expect(orders?.columns[1].constraints).toStrictEqual([
      {
        column: 'CustomerID',
        table: 'Customers',
      },
    ]);
    expect(orders?.columns[2].constraints).toStrictEqual([]);
  });
});

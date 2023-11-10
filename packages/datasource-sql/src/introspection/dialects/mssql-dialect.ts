import { Sequelize } from 'sequelize';

import IntrospectionDialect, { ColumnDescription } from './dialect.interface';
import { SequelizeTableIdentifier } from '../type-overrides';

export default class MsSQLDialect implements IntrospectionDialect {
  listColumns(
    tableNames: SequelizeTableIdentifier[],
    sequelize: Sequelize,
  ): Promise<ColumnDescription[][]> {
    if (!tableNames?.length) return Promise.resolve([]);

    const conditions = `(${tableNames
      .map(
        (_, index) =>
          `(c.table_schema = :schemaName${index}
            AND c.table_name = :tableName${index}
            )`,
      )
      .join(' OR ')})`;

    const query = `
      SELECT 
        c.COLUMN_NAME AS 'Name',
        c.DATA_TYPE AS 'Type',
        c.CHARACTER_MAXIMUM_LENGTH AS 'Length',
        c.IS_NULLABLE as 'IsNull',
        COLUMN_DEFAULT AS 'Default',
        pk.CONSTRAINT_TYPE AS 'Constraint',
        COLUMNPROPERTY(
          OBJECT_ID(c.TABLE_SCHEMA+'.'+c.TABLE_NAME),
          c.COLUMN_NAME, 'IsIdentity'
        ) as 'IsIdentity',
        CAST(prop.value AS NVARCHAR) AS 'Comment'
      FROM INFORMATION_SCHEMA.TABLES t
      INNER JOIN INFORMATION_SCHEMA.COLUMNS c
        ON t.TABLE_NAME = c.TABLE_NAME
        AND t.TABLE_SCHEMA = c.TABLE_SCHEMA
      LEFT JOIN (
        SELECT tc.table_schema, tc.table_name, 
          cu.column_name, tc.CONSTRAINT_TYPE 
        FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc 
        JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE  cu 
          ON tc.table_schema=cu.table_schema
          AND tc.table_name=cu.table_name 
          AND tc.constraint_name=cu.constraint_name 
          AND tc.CONSTRAINT_TYPE='PRIMARY KEY'
        ) pk 
        ON pk.table_schema=c.table_schema 
        AND pk.table_name=c.table_name 
        AND pk.column_name=c.column_name 
      INNER JOIN sys.columns AS sc
      ON sc.object_id = object_id(t.table_schema + '.' + t.table_name) AND sc.name = c.column_name
      LEFT JOIN sys.extended_properties prop ON prop.major_id = sc.object_id
      AND prop.minor_id = sc.column_id
      AND prop.name = 'MS_Description'
      WHERE 
        t.TABLE_CATALOG = :database
        AND ${conditions}`;

    const replacements = tableNames.reduce(
      (acc, tableName, index) => ({
        ...acc,
        [`tableName${index}`]: tableName.tableName,
        [`schemaName${index}`]: tableName.schema || 'public',
      }),
      {
        database: sequelize.getDatabaseName(),
      },
    );
  }
}

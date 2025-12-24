import type IntrospectionDialect from './dialect.interface';
import type { Dialect } from 'sequelize';

import MariadbDialect from './mariadb-dialect';
import MsSQLDialect from './mssql-dialect';
import MySQLDialect from './mysql-dialect';
import PostgreSQLDialect from './postgresql-dialect';
import SQLiteDialect from './sqlite-dialect';

export default function introspectionDialectFactory(dialect: Dialect): IntrospectionDialect {
  switch (dialect) {
    case 'postgres':
      return new PostgreSQLDialect();
    case 'mssql':
      return new MsSQLDialect();
    case 'mysql':
      return new MySQLDialect();
    case 'mariadb':
      return new MariadbDialect();
    case 'sqlite':
      return new SQLiteDialect();
    default:
      throw new Error(`Unsupported dialect: ${dialect}`);
  }
}

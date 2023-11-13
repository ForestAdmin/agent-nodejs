import { Dialect } from 'sequelize';

export type ConnectionDetails = {
  dialect: Dialect;
  username: string;
  password: string;
  host: string;
  port: number;
  supportsSchema: boolean;
};

const CONNECTION_DETAILS = [
  {
    name: 'PostgreSQL',
    dialect: 'postgres',
    url: (dbName?: string) =>
      `postgres://test:password@localhost:5443${dbName ? `/${dbName}` : ''}`,
    options: (dbName?: string) => ({
      dialect: 'postgres' as Dialect,
      username: 'test',
      password: 'password',
      host: 'localhost',
      port: 5443,
      database: dbName,
    }),
    supports: {
      schemas: true,
      enums: true,
      arrays: true,
    },
    defaultSchema: 'public',
  },
  {
    name: 'MySQL',
    dialect: 'mysql',
    url: (dbName?: string) => `mysql://root:password@localhost:3307${dbName ? `/${dbName}` : ''}`,
    options: (dbName?: string) => ({
      dialect: 'mysql' as Dialect,
      username: 'root',
      password: 'password',
      host: 'localhost',
      port: 3307,
      database: dbName,
    }),
    supports: {
      schemas: false,
      enums: true,
      arrays: false,
    },
    defaultSchema: undefined,
  },
  {
    name: 'MS SQL Server',
    dialect: 'mssql',
    url: (dbName?: string) =>
      `mssql://sa:yourStrong(!)Password@localhost:1434${dbName ? `/${dbName}` : ''}`,
    options: (dbName?: string) => ({
      dialect: 'mssql' as Dialect,
      username: 'sa',
      password: 'yourStrong(!)Password',
      host: 'localhost',
      port: 1434,
      database: dbName,
    }),
    supports: {
      schemas: true,
      enums: false,
      arrays: false,
    },
    defaultSchema: 'dbo',
  },
  {
    name: 'MariaDB',
    dialect: 'mariadb',
    url: (dbName?: string) => `mariadb://root:password@localhost:3809${dbName ? `/${dbName}` : ''}`,
    options: (dbName?: string) => ({
      dialect: 'mariadb' as Dialect,
      username: 'root',
      password: 'password',
      host: 'localhost',
      port: 3809,
      database: dbName,
    }),
    supports: {
      schemas: false,
      enums: true,
      arrays: false,
    },
    defaultSchema: undefined,
  },
];

export default CONNECTION_DETAILS;

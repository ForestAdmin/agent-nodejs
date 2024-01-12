import type { Dialect, Sequelize } from 'sequelize';

type Connection = {
  name: string;
  dialect: Dialect;
  uri: (db?: string) => string;
  supports: {
    arrays?: boolean;
  };
  query: {
    createDatabase(sequelize: Sequelize, dbName: string): Promise<void>;
  };
};

function defaultCreateDatabase(sequelize: Sequelize, dbName: string) {
  return sequelize.getQueryInterface().createDatabase(dbName);
}

const CONNECTIONS: Connection[] = [
  {
    name: 'Postgres 16',
    dialect: 'postgres',
    uri: (db?: string) => `postgres://test:password@localhost:5456/${db ?? ''}`,
    supports: { arrays: true },
    query: {
      createDatabase: defaultCreateDatabase,
    },
  },
  {
    name: 'MySQL 8',
    dialect: 'mysql',
    uri: (db?: string) => `mysql://root:password@localhost:3318/${db ?? ''}`,
    supports: {},
    query: {
      createDatabase: defaultCreateDatabase,
    },
  },
  {
    name: 'MariaDB 11',
    dialect: 'mariadb',
    uri: (db?: string) => `mariadb://root:password@localhost:3821/${db ?? ''}`,
    supports: {},
    query: {
      createDatabase: defaultCreateDatabase,
    },
  },
  {
    name: 'MSSQL 2022',
    dialect: 'mssql',
    uri: (db?: string) => `mssql://sa:yourStrong(!)Password@localhost:1432/${db ?? ''}`,
    supports: {},
    query: {
      createDatabase: async (sequelize: Sequelize, dbName: string) => {
        await sequelize.query(`CREATE DATABASE ${dbName} COLLATE SQL_Latin1_General_CP1_CS_AS`, {
          raw: true,
          type: 'RAW',
        });
      },
    },
  },
];

export default CONNECTIONS;

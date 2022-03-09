export default [
  {
    dialect: 'mssql',
    connectionString: 'sa:yourStrong(!)Password@localhost:1433',
    dbName: 'example',
    createDatabase: true,
  },
  {
    dialect: 'mysql',
    connectionString: 'example:password@localhost:3306',
    dbName: 'example',
  },
  {
    dialect: 'postgres',
    connectionString: 'example:password@localhost:5442',
    dbName: 'example',
  },
];

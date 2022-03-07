/* eslint-disable no-console */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Sequelize = require('sequelize');

const connection = new Sequelize('mssql://sa:yourStrong(!)Password@localhost:1433/example');
connection
  .getQueryInterface()
  .createDatabase('example')
  .then(() => {
    connection.close();
    console.log('Seed ok!');
  })
  .catch(console.log);

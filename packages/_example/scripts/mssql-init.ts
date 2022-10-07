import { Sequelize } from 'sequelize';

export default async function initMsSql(): Promise<void> {
  const uri = 'mssql://sa:yourStrong(!)Password@localhost:1433';
  let connection: Sequelize;

  try {
    connection = new Sequelize(uri, { logging: false });
    await connection.getQueryInterface().createDatabase('example');
  } catch (e) {
    console.error(e);
  } finally {
    await connection.close();
  }
}

import { Sequelize } from 'sequelize';

export default async function createDatabaseIfNotExist(baseUri: string, database: string) {
  const sequelize = new Sequelize(baseUri, { logging: false });

  try {
    await sequelize.getQueryInterface().createDatabase(database);
  } catch (e) {
    if (e.message.includes('already exists')) return;

    throw e;
  } finally {
    await sequelize.close();
  }
}

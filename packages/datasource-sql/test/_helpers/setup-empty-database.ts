import { Options, Sequelize } from 'sequelize';

import { ConnectionDetails } from './connection-details';

export default async function setupEmptyDatabase(
  connectionDetails: ConnectionDetails,
  dbName: string,
  optionalSchemaOption: Options = {},
): Promise<Sequelize> {
  if (connectionDetails.supports.multipleDatabases) {
    const sequelize = new Sequelize(connectionDetails.url(), { logging: false });

    try {
      const queryInterface = sequelize.getQueryInterface();

      await queryInterface.dropDatabase(dbName);
      await queryInterface.createDatabase(dbName);
    } catch (e) {
      console.error('Error', e);
      throw e;
    } finally {
      await sequelize.close();
    }
  }

  return new Sequelize(connectionDetails.url(dbName), { logging: false, ...optionalSchemaOption });
}

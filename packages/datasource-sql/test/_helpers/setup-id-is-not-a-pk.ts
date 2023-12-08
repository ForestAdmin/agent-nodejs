import { DataTypes, Sequelize } from 'sequelize';

import { ConnectionDetails } from './connection-details';

export default async (
  connectionDetails: ConnectionDetails,
  database: string,
): Promise<Sequelize> => {
  let sequelize: Sequelize | null = null;

  try {
    if (connectionDetails.supports.multipleDatabases) {
      sequelize = new Sequelize(connectionDetails.url(), { logging: false });
      await sequelize.getQueryInterface().dropDatabase(database);
      await sequelize.getQueryInterface().createDatabase(database);
      await sequelize.close();
      sequelize = new Sequelize(connectionDetails.url(database), { logging: false });
    } else {
      sequelize = new Sequelize(connectionDetails.url(database), { logging: false });
      await sequelize.getQueryInterface().dropTable('person');
    }

    await sequelize.getQueryInterface().createTable('person', {
      id: { type: DataTypes.INTEGER, primaryKey: false },
    });

    return sequelize;
  } catch (e) {
    console.error(e);
    throw e;
  } finally {
    await sequelize?.close();
  }
};

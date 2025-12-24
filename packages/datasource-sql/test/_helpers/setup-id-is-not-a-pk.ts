import type { ConnectionDetails } from './connection-details';
import type { Sequelize } from 'sequelize';

import { DataTypes } from 'sequelize';

import setupEmptyDatabase from './setup-empty-database';

export default async (
  connectionDetails: ConnectionDetails,
  database: string,
): Promise<Sequelize> => {
  let sequelize: Sequelize | null = null;

  try {
    sequelize = await setupEmptyDatabase(connectionDetails, database);

    if (!connectionDetails.supports.multipleDatabases) {
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

import { DataTypes, Sequelize } from 'sequelize';

import { ConnectionDetails } from './connection-details';

export default async (
  connectionDetails: ConnectionDetails,
  database: string,
): Promise<Sequelize> => {
  let sequelize: Sequelize | null = null;

  await connectionDetails.reinitDb(database);

  try {
    sequelize = new Sequelize(connectionDetails.url(database), { logging: false });

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

import type { ConnectionDetails } from './connection-details';
import type { Sequelize } from 'sequelize';

import { DataTypes } from 'sequelize';

import setupEmptyDatabase from './setup-empty-database';

export default async function setupSoftDeleted(
  connectionDetails: ConnectionDetails,
  database: string,
  schema?: string,
): Promise<Sequelize> {
  let sequelize: Sequelize | null = null;

  try {
    const optionalSchemaOption = schema ? { schema } : {};

    sequelize = await setupEmptyDatabase(connectionDetails, database, optionalSchemaOption);

    if (schema) {
      await sequelize.getQueryInterface().dropSchema(schema);
      await sequelize.getQueryInterface().createSchema(schema);
    }

    sequelize.define(
      'softDeleted',
      { name: DataTypes.STRING },
      { tableName: 'softDeleted', ...optionalSchemaOption, timestamps: true, paranoid: true },
    );

    sequelize.define(
      'softDeleted2',
      { name: DataTypes.STRING },
      { tableName: 'softDeleted2', ...optionalSchemaOption, timestamps: true, paranoid: true },
    );

    await sequelize.sync({ force: true, ...optionalSchemaOption });

    return sequelize;
  } catch (e) {
    console.error('Error', e);
    throw e;
  } finally {
    await sequelize?.close();
  }
}

import type { ConnectionDetails } from './connection-details';
import type { Sequelize } from 'sequelize';

import { DataTypes } from 'sequelize';

import setupEmptyDatabase from './setup-empty-database';

export default async function setupSimpleTable(
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
      'thing',
      { name: DataTypes.STRING },
      { tableName: 'thing', ...optionalSchemaOption, timestamps: false },
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

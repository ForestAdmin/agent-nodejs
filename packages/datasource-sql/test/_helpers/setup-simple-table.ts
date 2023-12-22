import { DataTypes, Sequelize } from 'sequelize';

import { ConnectionDetails } from './connection-details';

export default async function setupSimpleTable(
  connectionDetails: ConnectionDetails,
  database: string,
  schema?: string,
): Promise<void> {
  let sequelize: Sequelize | null = null;

  try {
    await connectionDetails.reinitDb(database);

    const optionalSchemaOption = schema ? { schema } : {};
    sequelize = new Sequelize(connectionDetails.url(database), {
      logging: false,
      ...optionalSchemaOption,
    });

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
  } catch (e) {
    console.error('Error', e);
    throw e;
  } finally {
    await sequelize?.close();
  }
}

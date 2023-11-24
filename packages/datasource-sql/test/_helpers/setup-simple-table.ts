import { DataTypes, Sequelize } from 'sequelize';

import { ConnectionDetails } from './connection-details';

export default async function setupSimpleTable(
  connectionDetails: ConnectionDetails,
  database: string,
  schema?: string,
): Promise<Sequelize> {
  let sequelize: Sequelize | null = null;

  try {
    if (connectionDetails.supports.multipleDatabases) {
      sequelize = new Sequelize(connectionDetails.url(), { logging: false });
      const queryInterface = sequelize.getQueryInterface();

      await queryInterface.dropDatabase(database);
      await queryInterface.createDatabase(database);

      await sequelize.close();
    }

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
      'group',
      { name: DataTypes.STRING },
      { tableName: 'group', ...optionalSchemaOption, timestamps: false },
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

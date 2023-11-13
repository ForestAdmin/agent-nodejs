import { DataTypes, Sequelize } from 'sequelize';

export default async function setupSimpleTable(
  baseUri: string,
  database: string,
  schema?: string,
): Promise<Sequelize> {
  let sequelize: Sequelize | null = null;

  try {
    sequelize = new Sequelize(baseUri, { logging: false });
    const queryInterface = sequelize.getQueryInterface();

    await queryInterface.dropDatabase(database);
    await queryInterface.createDatabase(database);

    await sequelize.close();

    const optionalSchemaOption = schema ? { schema } : {};
    sequelize = new Sequelize(`${baseUri}/${database}`, {
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

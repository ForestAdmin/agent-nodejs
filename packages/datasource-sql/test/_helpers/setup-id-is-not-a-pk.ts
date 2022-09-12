import { DataTypes, Sequelize } from 'sequelize';

export default async (
  dialect: string,
  connectionUrl: string,
  database: string,
): Promise<Sequelize> => {
  let sequelize: Sequelize | null = null;

  try {
    let connectionUri = `${dialect}://${connectionUrl}`;
    sequelize = new Sequelize(connectionUri, { logging: false });

    await sequelize.getQueryInterface().dropDatabase(database);
    await sequelize.getQueryInterface().createDatabase(database);
    await sequelize.close();

    connectionUri = `${dialect}://${connectionUrl}/${database}`;
    sequelize = new Sequelize(connectionUri, { logging: false });

    sequelize.define(
      'person',
      {
        anid: {
          type: DataTypes.STRING,
          defaultValue: 'default string',
          primaryKey: true,
        },
      },
      {
        timestamps: false,
        tableName: 'person',
      },
    );

    await sequelize.sync({ force: true });
    await sequelize.query('ALTER TABLE person ADD COLUMN id INTEGER');
    await sequelize.query('ALTER TABLE person DROP COLUMN anid CASCADE');

    return sequelize;
  } catch (error) {
    throw new Error(`Test initialization fail: ${error.message}`);
  } finally {
    await sequelize?.close();
  }
};

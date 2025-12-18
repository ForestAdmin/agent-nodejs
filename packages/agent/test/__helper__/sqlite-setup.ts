import { tmpdir } from 'os';
import path from 'path';
import { DataTypes, Sequelize } from 'sequelize';

export interface SqliteSetupResult {
  sequelize: Sequelize;
  dbPath: string;
  uri: string;
  cleanup: () => Promise<void>;
}

/**
 * Setup an in-memory SQLite database with test tables
 */
export async function setupSqliteDatabase(): Promise<SqliteSetupResult> {
  const dbPath = path.join(
    tmpdir(),
    `forest-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`,
  );
  const uri = `sqlite:${dbPath}`;

  const sequelize = new Sequelize(uri, {
    logging: false,
  });

  // Define test models
  sequelize.define(
    'users',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      firstName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      lastName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: 'users',
      timestamps: false,
    },
  );

  sequelize.define(
    'posts',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: 'posts',
      timestamps: false,
    },
  );

  // Sync models (create tables)
  await sequelize.sync({ force: true });

  // Seed test data
  await sequelize.models.users.bulkCreate([
    { email: 'john@example.com', firstName: 'John', lastName: 'Doe' },
    { email: 'jane@example.com', firstName: 'Jane', lastName: 'Smith' },
    { email: 'bob@example.com', firstName: 'Bob', lastName: 'Wilson' },
  ]);

  await sequelize.models.posts.bulkCreate([
    { title: 'First Post', content: 'Hello World', userId: 1 },
    { title: 'Second Post', content: 'Another post', userId: 1 },
    { title: 'Jane Post', content: 'Post by Jane', userId: 2 },
  ]);

  const cleanup = async () => {
    await sequelize.close();

    // Attempt to delete the file (may fail on Windows)
    try {
      const fs = await import('fs/promises');
      await fs.unlink(dbPath);
    } catch {
      // Ignore cleanup errors
    }
  };

  return { sequelize, dbPath, uri, cleanup };
}

/**
 * Get the collection schema for Forest Admin based on the SQLite tables
 */
export function getTestCollectionsSchema() {
  return [
    {
      name: 'users',
      fields: [
        { field: 'id', type: 'Number' },
        { field: 'email', type: 'String' },
        { field: 'firstName', type: 'String' },
        { field: 'lastName', type: 'String' },
        { field: 'createdAt', type: 'Date' },
      ],
    },
    {
      name: 'posts',
      fields: [
        { field: 'id', type: 'Number' },
        { field: 'title', type: 'String' },
        { field: 'content', type: 'String' },
        { field: 'userId', type: 'Number' },
        { field: 'createdAt', type: 'Date' },
      ],
    },
  ];
}

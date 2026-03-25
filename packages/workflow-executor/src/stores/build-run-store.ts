import type { RunStore } from '../ports/run-store';

import { Sequelize } from 'sequelize';

import DatabaseStore from './database-store';
import InMemoryStore from './in-memory-store';

export interface DatabaseConfig {
  dialect: string;
  uri: string;
}

export async function buildDatabaseRunStore(config: DatabaseConfig): Promise<RunStore> {
  const sequelize = new Sequelize(config.uri, {
    dialect: config.dialect as never,
    logging: false,
  });

  const store = new DatabaseStore({ sequelize });

  try {
    await store.init();
  } catch (error) {
    await sequelize.close();
    throw error;
  }

  return store;
}

export async function buildInMemoryRunStore(): Promise<RunStore> {
  const store = new InMemoryStore();
  await store.init();

  return store;
}

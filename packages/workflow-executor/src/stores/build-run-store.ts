import type { RunStore } from '../ports/run-store';
import type { Options } from 'sequelize';

import { Sequelize } from 'sequelize';

import DatabaseStore from './database-store';
import InMemoryStore from './in-memory-store';

export async function buildDatabaseRunStore(options: Options): Promise<RunStore> {
  const sequelize = new Sequelize({ logging: false, ...options });

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

import { Sequelize } from 'sequelize';

import { sequelizeAttributes } from './data-model';

export const SQLITE_STORAGE = './assets/db.sqlite';

const sequelizeSqlite = new Sequelize({
  dialect: 'sqlite',
  storage: SQLITE_STORAGE,
  logging: false,
});

const MODEL_OPTIONS = { underscored: true, timestamps: false };

sequelizeSqlite.define('alerts', sequelizeAttributes('alerts'), {
  tableName: 'alerts',
  ...MODEL_OPTIONS,
});

sequelizeSqlite.define('investigations', sequelizeAttributes('investigations'), {
  tableName: 'investigations',
  ...MODEL_OPTIONS,
});

sequelizeSqlite.define('sar_reports', sequelizeAttributes('sar_reports'), {
  tableName: 'sar_reports',
  ...MODEL_OPTIONS,
});

export default sequelizeSqlite;

import { Sequelize } from 'sequelize';

import { sequelizeAttributes } from './data-model';
import { sqlUri } from './sql-options';

const sequelize = new Sequelize(sqlUri('mariadb'), { logging: false });

sequelize.define('cards', sequelizeAttributes('cards'), {
  tableName: 'cards',
  underscored: true,
  timestamps: false,
});

export default sequelize;

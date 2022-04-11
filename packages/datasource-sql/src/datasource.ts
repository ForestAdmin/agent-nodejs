import { Sequelize } from 'sequelize';

import { SequelizeDataSource } from '@forestadmin/datasource-sequelize';

export default class SqlDataSource extends SequelizeDataSource {
  constructor(connectionUri: string) {
    super(new Sequelize(connectionUri, { logging: false }));
  }
}

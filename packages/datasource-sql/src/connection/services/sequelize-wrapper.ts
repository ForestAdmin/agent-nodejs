import { Sequelize } from 'sequelize';
import { Options as SequelizeOptions } from 'sequelize/types/sequelize';

import Events from './events';

export default class SequelizeWrapper extends Events {
  private readonly sequelize: Sequelize;

  get sequelizeInstance(): Sequelize {
    return this.sequelize;
  }

  constructor(sequelizeCtorOptions: [SequelizeOptions] | [string, SequelizeOptions]) {
    super();
    this.sequelize =
      sequelizeCtorOptions.length === 1
        ? new Sequelize(sequelizeCtorOptions[0])
        : new Sequelize(sequelizeCtorOptions[0], sequelizeCtorOptions[1]);
  }

  async connect(): Promise<void> {
    await this.sequelize.authenticate();
  }

  async close(): Promise<void> {
    await this.sequelize.close();
    await this.whenClosing();
  }
}

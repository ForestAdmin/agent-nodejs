import { Sequelize } from 'sequelize';
import { Options as SequelizeOptions } from 'sequelize/types/sequelize';

import Events from './events';

export default class SequelizeFactory extends Events {
  build(sequelizeCtorOptions: [SequelizeOptions] | [string, SequelizeOptions]) {
    const sequelize =
      sequelizeCtorOptions.length === 1
        ? new Sequelize(sequelizeCtorOptions[0])
        : new Sequelize(sequelizeCtorOptions[0], sequelizeCtorOptions[1]);

    this.overrideCloseMethod(sequelize);

    return sequelize;
  }

  private overrideCloseMethod(sequelize: Sequelize): void {
    // override close method to ensure to handle the 'close' event
    const whenClosing = this.whenClosing.bind(this);

    sequelize.close = async function close() {
      try {
        await Sequelize.prototype.close.call(this);
      } finally {
        await whenClosing();
      }
    };
  }
}

import { Sequelize } from 'sequelize';
import { Options as SequelizeOptions } from 'sequelize/types/sequelize';

import Service from './service';

export default class SequelizeFactory extends Service {
  build(sequelizeCtorOptions: [SequelizeOptions] | [string, SequelizeOptions]): Sequelize {
    const sequelize =
      sequelizeCtorOptions.length === 1
        ? new Sequelize(sequelizeCtorOptions[0])
        : new Sequelize(sequelizeCtorOptions[0], sequelizeCtorOptions[1]);

    this.overrideCloseMethod(sequelize);

    return sequelize;
  }

  private overrideCloseMethod(sequelize: Sequelize): void {
    const stop = this.stop.bind(this);

    // override close method to ensure to execute the stop
    sequelize.close = async function close() {
      try {
        await Sequelize.prototype.close.call(this);
      } finally {
        await stop();
      }
    };
  }
}

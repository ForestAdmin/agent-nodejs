import type Service from './services/service';
import type { Options as SequelizeOptions } from 'sequelize/types/sequelize';

import { Sequelize } from 'sequelize';

export default class SequelizeFactory {
  static build(
    sequelizeCtorOptions: [SequelizeOptions] | [string, SequelizeOptions],
    stopCallback?: Service['stop'],
  ): Sequelize {
    const sequelize =
      sequelizeCtorOptions.length === 1
        ? new Sequelize(sequelizeCtorOptions[0])
        : new Sequelize(sequelizeCtorOptions[0], sequelizeCtorOptions[1]);

    this.overrideCloseMethod(sequelize, stopCallback);

    return sequelize;
  }

  private static overrideCloseMethod(sequelize: Sequelize, stopCallback?: Service['stop']): void {
    // override close method to ensure to execute the stop
    sequelize.close = async function close() {
      try {
        await Sequelize.prototype.close.call(this);
      } finally {
        if (stopCallback) await stopCallback();
      }
    };
  }
}

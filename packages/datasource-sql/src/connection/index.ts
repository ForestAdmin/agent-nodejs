import { Sequelize } from 'sequelize';

import ConnectionOptions from './connection-options';
import handleErrors from './handle-errors';
import ReverseProxy from './reverse-proxy';

/** Attempt to connect to the database */
export default async function connect(options: ConnectionOptions): Promise<Sequelize> {
  let proxy: ReverseProxy;
  let sequelize: Sequelize;

  try {
    if (options.proxyOptions) {
      // start the proxy
      proxy = new ReverseProxy(options.proxyOptions, options.host, options.port);
      await proxy.start();

      // swap database host and port with the ones from the proxy.
      options.changeHostAndPort(proxy.host, proxy.port);
    }

    const sequelizeCtorOptions = await options.buildSequelizeCtorOptions();
    sequelize =
      sequelizeCtorOptions.length === 1
        ? new Sequelize(sequelizeCtorOptions[0])
        : new Sequelize(sequelizeCtorOptions[0], sequelizeCtorOptions[1]);

    // we want to stop the proxy when the sequelize connection is closed
    sequelize.close = async function close() {
      try {
        await Sequelize.prototype.close.call(this);
      } finally {
        await proxy?.stop();
      }
    };

    await sequelize.authenticate(); // Test connection

    return sequelize;
  } catch (e) {
    await sequelize?.close();
    // if proxy encountered an error, we want to throw it instead of the sequelize error
    handleErrors(proxy?.error ?? e, options);
  }
}

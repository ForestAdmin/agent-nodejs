import { Sequelize } from 'sequelize';

import ConnectionOptions from './connection-options';
import handleErrors from './handle-errors';
import ReverseProxy from './services/reverse-proxy';
import SequelizeFactory from './services/sequelize-factory';
import SocksProxy from './services/socks-proxy';
import SshClient from './services/ssh-client';

/** Attempt to connect to the database */
export default async function connect(options: ConnectionOptions): Promise<Sequelize> {
  let socksProxy: SocksProxy;
  let sshClient: SshClient;
  let reverseProxy: ReverseProxy;
  let sequelize: Sequelize;

  try {
    if (options.proxyOptions || options.sshOptions) {
      reverseProxy = new ReverseProxy();
      await reverseProxy.start();
    }

    if (options.proxyOptions) {
      // destination is the ssh or the database
      const { host, port } = options.sshOptions ?? options;
      socksProxy = new SocksProxy(options.proxyOptions, host, port);
      reverseProxy.bindListeners(socksProxy);
    }

    if (options.sshOptions) {
      const { host, port, sshOptions } = options;
      // database is the destination
      sshClient = new SshClient(sshOptions, reverseProxy.host, reverseProxy.port, host, port);
      // if socksProxy is defined, it means that we are using a proxy
      // so we need to bind the listeners to the socksProxy
      // otherwise, we bind the listeners to the reverseProxy
      (socksProxy ?? reverseProxy).bindListeners(sshClient);
    }

    const sequelizeFactory = new SequelizeFactory();

    if (reverseProxy) {
      options.changeHostAndPort(reverseProxy.host, reverseProxy.port);
      sequelizeFactory.onClose(reverseProxy.stop.bind(reverseProxy));
    }

    sequelize = sequelizeFactory.build(await options.buildSequelizeCtorOptions());
    await sequelize.authenticate(); // Test connection

    return sequelize;
  } catch (e) {
    await sequelize?.close();
    // if ssh or socksProxy or reverseProxy encountered an error,
    // we want to throw it instead of the sequelize error
    handleErrors(sshClient?.error ?? socksProxy?.error ?? reverseProxy?.error ?? e, options);
  }
}

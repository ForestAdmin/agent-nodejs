import { Sequelize } from 'sequelize';

import ConnectionOptions from './connection-options';
import handleErrors from './handle-errors';
import ReverseProxy from './services/reverse-proxy';
import SequelizeFactory from './services/sequelize-factory';
import Service from './services/service';
import SocksProxy from './services/socks-proxy';
import SshClient from './services/ssh-client';

function bindListeners(from: Service, to: Service): void {
  from.onConnect(to.connectListener.bind(to));
  from.onClose(to.closeListener.bind(to));
}

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
      bindListeners(reverseProxy, socksProxy);
    }

    if (options.sshOptions) {
      const socksOrReverseProxy: Service = socksProxy ?? reverseProxy;
      const { host, port, sshOptions } = options;
      // database is the destination
      sshClient = new SshClient(sshOptions, reverseProxy.host, reverseProxy.port, host, port);
      bindListeners(socksOrReverseProxy, sshClient);
    }

    const sequelizeFactory = new SequelizeFactory();

    if (reverseProxy) {
      options.changeHostAndPort(reverseProxy.host, reverseProxy.port);
      sequelizeFactory.onClose(reverseProxy.closeListener.bind(reverseProxy));
    }

    sequelize = sequelizeFactory.build(await options.buildSequelizeCtorOptions());
    await sequelize.authenticate(); // Test connection

    return sequelize;
  } catch (e) {
    await sequelize?.close();
    // if ssh or socksProxy encountered an error, we want to throw it instead of the sequelize error
    handleErrors(sshClient?.error ?? socksProxy?.error ?? reverseProxy?.error ?? e, options);
  }
}

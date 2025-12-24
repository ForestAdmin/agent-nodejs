import type ConnectionOptions from './connection-options';
import type { Sequelize } from 'sequelize';

import testConnectionWithTimeOut from './connection-tester';
import handleErrors from './handle-errors';
import SequelizeFactory from './sequelize-factory';
import ReverseProxy from './services/reverse-proxy';
import SocksProxy from './services/socks-proxy';
import SshTunnel from './services/ssh-tunnel';

/** Attempt to connect to the database */
export default async function connect(options: ConnectionOptions): Promise<Sequelize> {
  let socksProxy: SocksProxy;
  let sshTunnel: SshTunnel;
  let reverseProxy: ReverseProxy;
  let sequelize: Sequelize;

  try {
    if (options.proxyOptions || options.sshOptions) {
      reverseProxy = new ReverseProxy();
      await reverseProxy.start();
    }

    if (options.proxyOptions) {
      // destination is the ssh server or the database
      const { host, port } = options.sshOptions ?? options;
      socksProxy = new SocksProxy(options.proxyOptions, host, port);
      reverseProxy.link(socksProxy);
    }

    if (options.sshOptions) {
      const { host, port, sshOptions } = options;
      // database is the destination
      sshTunnel = new SshTunnel(sshOptions, host, port);
      // if socksProxy is defined, it means that we are using a proxy
      // so we need to link to the socksProxy otherwise to the reverseProxy
      (socksProxy ?? reverseProxy).link(sshTunnel);
    }

    // change the host and port of the sequelize options to point to the reverse proxy
    if (reverseProxy) options.changeHostAndPort(reverseProxy.host, reverseProxy.port);

    sequelize = SequelizeFactory.build(
      await options.buildSequelizeCtorOptions(),
      // stop the reverse proxy when the sequelize connection is closed
      reverseProxy?.stop.bind(reverseProxy),
    );

    await testConnectionWithTimeOut(
      sequelize,
      options.debugDatabaseUri,
      options.connectionTimeoutInMs,
    );

    return sequelize;
  } catch (e) {
    await sequelize?.close();
    // if ssh or socksProxy or reverseProxy encountered an error,
    // we want to throw it instead of the sequelize error
    handleErrors(sshTunnel?.error ?? socksProxy?.error ?? reverseProxy?.error ?? e, options);
  }
}

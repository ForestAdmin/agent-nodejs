import { Sequelize } from 'sequelize';

import ConnectionOptions from './connection-options';
import handleErrors from './handle-errors';
import ReverseProxy from './services/reverse-proxy';
import SequelizeFactory from './services/sequelize-factory';
import Service from './services/service';
import SshClient from './services/ssh-client';
import TcpServer from './services/tcp-server';

function bindListeners(from: Service, to: Service): void {
  from.onConnect(to.connectListener.bind(to));
  from.onClose(to.closeListener.bind(to));
}

/** Attempt to connect to the database */
export default async function connect(options: ConnectionOptions): Promise<Sequelize> {
  let proxy: ReverseProxy;
  let sshClient: SshClient;
  let server: TcpServer;
  let sequelize: Sequelize;

  try {
    if (options.proxyOptions || options.sshOptions) {
      server = new TcpServer();
      await server.start();
    }

    if (options.proxyOptions) {
      // destination is the ssh server or the database
      const { host, port } = options.sshOptions ?? options;
      proxy = new ReverseProxy(options.proxyOptions, host, port);
      bindListeners(server, proxy);
    }

    if (options.sshOptions) {
      // database is the destination
      const sshOptions = { ...options.sshOptions };
      const proxyOrServer: Service = proxy ?? server;
      // ssh host is localhost because the proxy will forward the connection to the ssh server
      if (proxy) sshOptions.host = 'localhost';

      sshClient = new SshClient(sshOptions, server.host, server.port, options.host, options.port);
      bindListeners(proxyOrServer, sshClient);
    }

    // swap database host and port with the ones from the tcp server proxy.
    if (server) options.changeHostAndPort(server.host, server.port);

    const sequelizeFactory = new SequelizeFactory();
    if (server) sequelizeFactory.onClose(server.closeListener.bind(server));

    sequelize = sequelizeFactory.build(await options.buildSequelizeCtorOptions());
    await sequelize.authenticate(); // Test connection

    return sequelize;
  } catch (e) {
    await sequelize?.close();
    // if ssh or proxy encountered an error, we want to throw it instead of the sequelize error
    handleErrors(sshClient?.error ?? proxy?.error ?? e, options);
  }
}

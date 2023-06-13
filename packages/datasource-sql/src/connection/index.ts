import { Sequelize } from 'sequelize';

import ConnectionOptions from './connection-options';
import handleErrors from './handle-errors';
import ReverseProxy from './reverse-proxy';
import SequelizeWrapper from './services/sequelize-wrapper';
import TcpServer from './services/tcp-server';

/** Attempt to connect to the database */
export default async function connect(options: ConnectionOptions): Promise<Sequelize> {
  let proxy: ReverseProxy;
  let tcpServer: TcpServer;
  let sequelizeWrapper: SequelizeWrapper;

  try {
    if (options.proxyOptions) {
      tcpServer = new TcpServer();
      await tcpServer.start();
      proxy = new ReverseProxy(options.proxyOptions, options.host, options.port);
      tcpServer.onConnect(proxy.whenConnecting.bind(proxy));
      tcpServer.onClose(proxy.whenClosing.bind(proxy));
      // swap database host and port with the ones from the proxy.
      options.changeHostAndPort(tcpServer.host, tcpServer.port);
    }

    sequelizeWrapper = new SequelizeWrapper(await options.buildSequelizeCtorOptions());

    if (tcpServer) sequelizeWrapper.onClose(tcpServer.whenClosing.bind(tcpServer));

    await sequelizeWrapper.connect(); // Test connection

    return sequelizeWrapper.sequelizeInstance;
  } catch (e) {
    await sequelizeWrapper?.close();
    // if proxy encountered an error, we want to throw it instead of the sequelize error
    handleErrors(proxy?.error ?? e, options);
  }
}

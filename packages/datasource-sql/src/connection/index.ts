import { Sequelize } from 'sequelize';

import ConnectionOptions from './connection-options';
import handleErrors from './handle-errors';
import ReverseProxy from './services/reverse-proxy';
import SequelizeFactory from './services/sequelize-factory';
import SshClient from './services/ssh-client';
import TcpServer from './services/tcp-server';
import { ProxyOptions, SshOptions } from '../types';

function makeProxy(
  proxyOptions: ProxyOptions,
  targetHost: string,
  targetPort: number,
  tcpServer: TcpServer,
): ReverseProxy {
  const proxy = new ReverseProxy(proxyOptions, targetHost, targetPort);
  tcpServer.onConnect(proxy.whenConnecting.bind(proxy));
  tcpServer.onClose(proxy.whenClosing.bind(proxy));

  return proxy;
}

function makeSshClient(
  sshOptions: SshOptions,
  tcpServer: TcpServer,
  proxy: ReverseProxy,
): SshClient {
  const sshClient = new SshClient(sshOptions, tcpServer.host, tcpServer.port);

  if (proxy) {
    proxy.onConnect(sshClient.whenConnecting.bind(sshClient));
    proxy.onClose(sshClient.whenClosing.bind(sshClient));
  } else {
    tcpServer.onConnect(sshClient.whenConnecting.bind(sshClient));
    tcpServer.onClose(sshClient.whenClosing.bind(sshClient));
  }

  return sshClient;
}

/** Attempt to connect to the database */
export default async function connect(options: ConnectionOptions): Promise<Sequelize> {
  let proxy: ReverseProxy;
  let sshClient: SshClient;
  let tcpServer: TcpServer;
  let sequelize: Sequelize;

  try {
    if (options.proxyOptions || options.sshOptions) {
      tcpServer = new TcpServer();
      await tcpServer.start();
    }

    if (options.proxyOptions) {
      proxy = makeProxy(options.proxyOptions, options.host, options.port, tcpServer);
      // swap database host and port with the ones from the proxy.
      options.changeHostAndPort(tcpServer.host, tcpServer.port);
    }

    if (options.sshOptions) {
      sshClient = await makeSshClient(options.sshOptions, tcpServer, proxy);
      // swap database host and port with the ones from the proxy.
      if (!proxy) options.changeHostAndPort(tcpServer.host, tcpServer.port);
    }

    const sequelizeFactory = new SequelizeFactory();
    if (tcpServer) sequelizeFactory.onClose(tcpServer.whenClosing.bind(tcpServer));

    sequelize = sequelizeFactory.build(await options.buildSequelizeCtorOptions());
    await sequelize.authenticate(); // Test connection

    return sequelize;
  } catch (e) {
    await sequelize?.close();
    // if ssh or proxy encountered an error, we want to throw it instead of the sequelize error
    handleErrors(sshClient?.error ?? proxy?.error ?? e, options);
  }
}

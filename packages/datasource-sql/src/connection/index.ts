import type { ConnectionOptions, ConnectionOptionsObj, ProxySocks } from '../types';
import type { Logger } from '@forestadmin/datasource-toolkit';

import { Sequelize } from 'sequelize';

import handleErrors from './handle-errors';
import preprocessOptions from './preprocess';
import ReverseProxy from './reverse-proxy';
import SequelizeWrapper from './sequelize-wrapper';
import SshClient from './ssh-client';

async function startProxy(options: ConnectionOptionsObj): Promise<ReverseProxy> {
  let proxy: ReverseProxy;

  if (options.ssh) {
    // destination is now the ssh server
    proxy = new ReverseProxy({
      port: options.ssh.port,
      host: options.ssh.dockerHost || options.ssh.host,
      proxySocks: options.proxySocks as ProxySocks,
    });
    // open a ssh connection when the proxy receives a connection
    proxy.onConnect(async socket => {
      await new SshClient(socket, options).connect();
    });
  } else {
    proxy = new ReverseProxy(options);
  }

  await proxy.start();

  return proxy;
}

/** Attempt to connect to the database */
export default async function connect(
  uriOrOptions: ConnectionOptions,
  logger?: Logger,
): Promise<Sequelize> {
  let proxy: ReverseProxy;
  let sequelize: Sequelize;
  let options: ConnectionOptionsObj;

  try {
    options = await preprocessOptions(uriOrOptions);

    if (options.proxySocks) {
      proxy = await startProxy(options);
      options = proxy.updateOptionsToUseProxy(options);
    }

    const sequelizeWrapper = new SequelizeWrapper(options, logger);
    sequelizeWrapper.onClose(() => proxy?.stop());
    await sequelizeWrapper.sequelize.authenticate(); // Test connection

    return sequelizeWrapper.sequelize;
  } catch (e) {
    await sequelize?.close();
    // if proxy encountered an error, we want to throw it instead of the sequelize error
    handleErrors(proxy?.error || e, options, proxy);
  }
}

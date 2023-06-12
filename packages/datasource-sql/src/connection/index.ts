import type { ConnectionOptions, ConnectionOptionsObj } from '../types';
import type { Logger } from '@forestadmin/datasource-toolkit';

import { Sequelize } from 'sequelize';

import handleErrors from './handle-errors';
import preprocessOptions from './preprocess';
import ReverseProxy from './reverse-proxy';
import SequelizeWrapper from './sequelize-wrapper';

/** Attempt to connect to the database */
export default async function connect(
  uriOrOptions: ConnectionOptions,
  logger?: Logger,
): Promise<Sequelize> {
  let proxy: ReverseProxy;
  let sequelizeWrapper: SequelizeWrapper;
  let options: ConnectionOptionsObj;

  try {
    options = await preprocessOptions(uriOrOptions);

    if (options.proxySocks) {
      proxy = new ReverseProxy(options);
      await proxy.start();
      options = proxy.connectionOptions;
    }

    sequelizeWrapper = new SequelizeWrapper(options, logger);
    sequelizeWrapper.onClose(async () => proxy?.stop());
    await sequelizeWrapper.sequelize.authenticate(); // Test connection

    return sequelizeWrapper.sequelize;
  } catch (e) {
    await sequelizeWrapper?.sequelize.close();
    // if proxy encountered an error, we want to throw it instead of the sequelize error
    handleErrors(proxy?.error || e, options, proxy);
  }
}

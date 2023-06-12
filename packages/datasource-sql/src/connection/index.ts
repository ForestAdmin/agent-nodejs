import type { ConnectionOptions, ConnectionOptionsObj } from '../types';
import type { Logger } from '@forestadmin/datasource-toolkit';

import { Sequelize } from 'sequelize';

import handleErrors from './handle-errors';
import preprocessOptions from './preprocess';
import ReverseProxy from './reverse-proxy';
import getLogger from './utils';
import ConnectionOptionsWrapper from '../connection-options-wrapper';

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
      proxy = new ReverseProxy(options);
      await proxy.start();
      options = proxy.connectionOptions;
    }

    const { uri, sslMode, ...opts } = options;
    const logging = logger ? getLogger(logger) : false;
    const wrapper = new ConnectionOptionsWrapper(options);
    const { uriIfValidOrNull, schemaFromUriOrOptions: schema } = wrapper;

    opts.dialectOptions = {
      ...(opts.dialectOptions ?? {}),
      ...wrapper.computeSslConfiguration(opts.dialect, sslMode, uriIfValidOrNull, logger),
    };

    sequelize = uri
      ? new Sequelize(uri, { ...opts, schema, logging })
      : new Sequelize({ ...opts, schema, logging });

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
    handleErrors(proxy?.error || e, options, proxy);
  }
}

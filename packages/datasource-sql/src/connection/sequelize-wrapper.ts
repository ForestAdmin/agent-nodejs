import type { Logger } from '@forestadmin/datasource-toolkit';

import { Sequelize } from 'sequelize';

import getLogger from './utils';
import ConnectionOptionsWrapper from '../connection-options-wrapper';
import { ConnectionOptionsObj } from '../types';

export default class SequelizeWrapper {
  public sequelize: Sequelize;
  private onCloseCallbacks: (() => Promise<void> | null)[] = [];

  constructor(options: ConnectionOptionsObj, logger?: Logger) {
    const logging = logger ? getLogger(logger) : false;
    const wrapper = new ConnectionOptionsWrapper(options);
    const {
      uriIfValidOrNull,
      schemaFromUriOrOptions: schema,
      options: { sslMode, ...opts },
    } = wrapper;

    opts.dialectOptions = {
      ...(opts.dialectOptions ?? {}),
      ...wrapper.computeSslConfiguration(opts.dialect, sslMode, uriIfValidOrNull, logger),
    };

    this.sequelize = uriIfValidOrNull
      ? new Sequelize(uriIfValidOrNull, { ...opts, schema, logging })
      : new Sequelize({ ...opts, schema, logging });
  }

  onClose(callback: () => Promise<void>) {
    this.onCloseCallbacks.push(callback);
    const callbacks = this.onCloseCallbacks;

    this.sequelize.close = async function close() {
      try {
        await Sequelize.prototype.close.call(this);
      } finally {
        // run all callbacks even if one fails
        await Promise.all(callbacks.map(cb => cb()));
      }
    };
  }
}

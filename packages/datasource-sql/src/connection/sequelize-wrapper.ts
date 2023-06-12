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
    const { uri, sslMode, ...opts } = wrapper.options;
    opts.dialectOptions = {
      ...(opts.dialectOptions ?? {}),
      ...wrapper.computeSslConfiguration(opts.dialect, sslMode, uri, logger),
    };
    const config = { ...opts, schema: wrapper.schemaFromUriOrOptions, logging };
    this.sequelize = uri ? new Sequelize(uri, config) : new Sequelize(config);

    this.overrideClose();
  }

  onClose(callback: () => Promise<void>) {
    this.onCloseCallbacks.push(callback);
  }

  private overrideClose() {
    const callbacks = this.onCloseCallbacks;
    let error: Error;

    this.sequelize.close = async function close() {
      try {
        await Sequelize.prototype.close.call(this);
      } catch (e) {
        error = e;
      }

      // run all callbacks even if one fails
      const result = await Promise.allSettled(callbacks.map(cb => cb()));
      if (error) throw error;

      const errors = result.filter(r => r.status === 'rejected');

      if (errors.length > 0) {
        throw new Error(errors.map((e: PromiseRejectedResult) => e.reason).join('\n'));
      }
    };
  }
}

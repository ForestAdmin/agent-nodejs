import { DataSourceFactory, Logger } from '@forestadmin/datasource-toolkit';
import jsonwebtoken from 'jsonwebtoken';
import superagent from 'superagent';

import RpcDataSource from './datasource';
import { RpcDataSourceOptions } from './types';

// eslint-disable-next-line import/prefer-default-export
export function createRpcDataSource(options: RpcDataSourceOptions): DataSourceFactory {
  return async (logger: Logger) => {
    const { authSecret, uri } = options;

    const token = jsonwebtoken.sign({}, authSecret, { expiresIn: '1m' });

    logger('Info', `Getting schema from Rpc agent on ${uri}.`);

    const introRq = superagent.get(`${uri}/forest/rpc-schema`);
    introRq.auth(token, { type: 'bearer' });
    const introResp = await introRq.send();

    const introspection = introResp.body;

    return new RpcDataSource(logger, options, introspection.schema);
  };
}

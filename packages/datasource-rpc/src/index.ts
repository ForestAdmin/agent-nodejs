import { DataSource, DataSourceFactory } from '@forestadmin/datasource-toolkit';
import axios from 'axios';

import { QueryFn } from './types';
import RpcDataSource from './datasource';

export { default as RemoteCollection } from './collection';
export { default as RemoteDatasource } from './datasource';

export function connectRemoteDataSource(url: string): DataSourceFactory {
  const query: QueryFn = async data => {
    const response = await axios.post(url, data);

    return response.data;
  };

  return async (): Promise<DataSource> => {
    const handshake = JSON.parse(
      JSON.stringify(await query({ method: 'handshake' })),
      (key, value) => {
        if (key === 'filter_operators') {
          return new Set(
            value.map(
              v => v[0].toUpperCase() + v.slice(1).replace(/(_\w)/g, k => k[1].toUpperCase()),
            ),
          );
        }

        if (key !== 'fields' && typeof value === 'object' && value?.constructor === Object) {
          const newObj = {};

          for (const [subKey, subValue] of Object.entries(value)) {
            newObj[subKey.replace(/(_\w)/g, k => k[1].toUpperCase())] = subValue;
          }

          return newObj;
        }

        return value;
      },
    );

    return new RpcDataSource(query, handshake);
  };
}

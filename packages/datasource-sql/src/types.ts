import { Options } from 'sequelize/types';

export type ConnectionOptionsObj =
  | { uri?: string; sslMode?: SslMode } & Pick<
      Options,
      | 'database'
      | 'dialect'
      | 'dialectModule'
      | 'dialectModulePath'
      | 'dialectOptions'
      | 'host'
      | 'minifyAliases'
      | 'native'
      | 'password'
      | 'pool'
      | 'port'
      | 'protocol'
      | 'replication'
      | 'schema'
      | 'ssl'
      | 'storage'
      | 'username'
    >;

export type ConnectionOptions = ConnectionOptionsObj | string;

export type SslMode = 'preferred' | 'disabled' | 'required' | 'verify' | 'manual';

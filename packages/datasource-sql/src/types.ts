import { Options } from 'sequelize/types';

export type ProxySocks = {
  host: string;
  port: number;
  userId?: string;
  password?: string;
  version?: 5;
  command?: 'connect';
};

export type Ssh = {
  port: number;
  host: string;
  username: string;
  privateKey: string;
};

export type ProxySocksWithOptionalSsh = {
  proxySocks: ProxySocks;
  ssh?: Ssh;
};

export type NotProxySocks = {
  proxySocks?: void;
  ssh?: void;
};

export type ConnectionOptionsObj =
  | {
      uri?: string;
      sslMode?: SslMode;
    } & (NotProxySocks | ProxySocksWithOptionalSsh) &
      Pick<
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

import type { SupportedIntrospection } from './introspection/types';
import type { Options } from 'sequelize/types';
import type { ConnectConfig } from 'ssh2';

type SupportedSequelizeOptions = Pick<
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

export type ProxyOptions = {
  userId?: string;
  password?: string;
  host: string;
  port: number;
  version?: 5;
  command?: 'connect';
};

export type SshOptions = Omit<ConnectConfig, 'sock'>;

export type PlainConnectionOptions = SupportedSequelizeOptions & {
  uri?: string;
  sslMode?: SslMode;
  proxySocks?: ProxyOptions;
  ssh?: SshOptions;
  connectionTimeoutInMs?: number;
};

export type PlainConnectionOptionsOrUri = PlainConnectionOptions | string;

export type SslMode = 'preferred' | 'disabled' | 'required' | 'verify' | 'manual';

export type SqlDatasourceOptions = {
  introspection?: SupportedIntrospection;
  displaySoftDeleted?: string[] | true;
  liveQueryConnections?: string;
};

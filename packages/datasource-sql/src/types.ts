import { Options } from 'sequelize/types';

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

export type SshOptions = {
  port: number;
  host: string;
  username: string;
  privateKey: Buffer;
};

export type PlainConnectionOptions = SupportedSequelizeOptions & {
  uri?: string;
  sslMode?: SslMode;
  proxySocks?: ProxyOptions;
  ssh?: SshOptions;
};

export type PlainConnectionOptionsOrUri = PlainConnectionOptions | string;

export type SslMode = 'preferred' | 'disabled' | 'required' | 'verify' | 'manual';

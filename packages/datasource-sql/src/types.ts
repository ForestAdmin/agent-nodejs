import { Options } from 'sequelize/types';

export type DatabaseConnectionOptions =
  | string
  | Pick<
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

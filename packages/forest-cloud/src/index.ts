/* eslint-disable import/prefer-default-export */
import type { ConnectionParams } from '@forestadmin/datasource-mongo';
import type { ConnectionOptions } from '@forestadmin/datasource-sql';

import { Agent } from './types';

export type { Agent };
export type { ConnectionParams as MongoConnectionParams, ConnectionOptions as SqlConnectionParams };

import type { ZendeskClient } from './client';
import type { ZendeskClientOptions } from './types';
import type { Logger } from '@forestadmin/datasource-toolkit';

import { createZendeskClient } from './client';

/**
 * A Zendesk client can always be supplied directly, or built on-the-fly from raw
 * credentials. The datasource factory and the smart-action plugins share this
 * contract so users never have to instantiate a client by hand when they don't
 * already have one.
 */
export type ZendeskClientProvider =
  | { client: ZendeskClient }
  | ({ client?: never } & ZendeskClientOptions);

export function resolveZendeskClient(
  options: ZendeskClientProvider,
  logger?: Logger,
): ZendeskClient {
  return 'client' in options && options.client
    ? options.client
    : createZendeskClient(options as ZendeskClientOptions, logger);
}

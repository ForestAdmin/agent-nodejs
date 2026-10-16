import type { CollectionSettings, TableModel } from '../src/types';
import type { DataSource } from '@forestadmin/datasource-toolkit';

import { fakeClient } from './fake-client';
import DynamoDBCollection from '../src/collection';
import { resolveSettings } from '../src/settings';

export function buildCollection(
  model: TableModel,
  handlers: Record<string, ((input: Record<string, any>) => unknown) | unknown[]>,
  settings: Partial<CollectionSettings> = {},
) {
  const client = fakeClient(handlers);
  const logger = jest.fn();
  const collection = new DynamoDBCollection(
    {} as DataSource,
    model,
    client,
    logger,
    resolveSettings(settings),
  );

  return { collection, client, logger };
}

export const caller = { timezone: 'UTC' } as never;

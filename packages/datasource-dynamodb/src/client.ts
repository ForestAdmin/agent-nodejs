import type { DynamoDBClientOptions } from './types';

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

/** The AWS SDK default is 3 attempts: throttling on a busy table is worth more patience. */
const DEFAULT_MAX_ATTEMPTS = 10;

const TRANSLATE_CONFIG = {
  marshallOptions: { removeUndefinedValues: true },
  unmarshallOptions: { wrapNumbers: false },
};

function isLowLevelClient(client: unknown): client is DynamoDBClient {
  return client instanceof DynamoDBClient || client?.constructor?.name === 'DynamoDBClient';
}

export function createDocumentClient(options: DynamoDBClientOptions): DynamoDBDocumentClient {
  if (options.client) {
    return isLowLevelClient(options.client)
      ? DynamoDBDocumentClient.from(options.client, TRANSLATE_CONFIG)
      : (options.client as DynamoDBDocumentClient);
  }

  return DynamoDBDocumentClient.from(
    new DynamoDBClient({
      maxAttempts: DEFAULT_MAX_ATTEMPTS,
      retryMode: 'adaptive',
      region: options.region,
      endpoint: options.endpoint,
      credentials: options.credentials,
      ...options.clientConfig,
    }),
    TRANSLATE_CONFIG,
  );
}
